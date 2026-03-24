# MistakeReviewPlan — 悪手レビューの中間表現

> 作成: context-manager（orchestrator指示に基づく）
> 日付: 2026-03-24
> 前提: DEC-014（ExplanationPlan 中心）、bad-move-coach-mvp.md
> ステータス: 型設計ドキュメント。人間承認後に実装へ進む

---

## 1. 位置づけ

MistakeReviewPlan は ExplanationPlan の「悪手レビュー版」。
ExplanationPlan が「この局面をどう説明するか」を構造化するのに対し、
MistakeReviewPlan は「ユーザーの手がなぜ悪かったか」を構造化する。

```
ExplanationPlan     → 局面解説（What is the best move and why?）
MistakeReviewPlan   → 悪手レビュー（Why was your move bad?）
```

---

## 2. 型定義（案）

```typescript
type MistakeReviewPlan = {
  /** ターゲット棋力 */
  audience: "beginner" | "intermediate";

  /** レビュー対象のユーザーの手 */
  reviewedMove: {
    usi: string;          // "7g7f"
    ja: string;           // "▲７六歩"
    evalBefore: number;   // この手を指す前の評価値
    evalAfter: number;    // この手を指した後の評価値
    evalExpression: string; // "少し先手が有利 → ほぼ互角に" 等
  };

  /** エンジン推奨の最善手 */
  betterMove: {
    usi: string;
    ja: string;
    evalAfter: number;
    evalExpression: string; // "少し先手が有利のまま" 等
    reason: string;         // なぜこの手が良いか（1文）
  };

  /** 差が生まれた因果関係（コード側で事前分析） */
  causalChain: CausalStep[];

  /** 局面の文脈（Planner が盤面分析から生成） */
  context: {
    phase: "opening" | "middle" | "endgame";
    turnSide: string;       // "先手" / "後手"
    keyFeature: string;     // "角頭が弱い" "玉が薄い" 等、この局面の核心
  };

  /** 次に同じ局面が来たら何を見るか（学びの要約） */
  nextLookFor: string;

  /** LLM に伝える事実（盤面から導出） */
  facts: string[];

  /** LLM が言ってはいけない主張 */
  forbiddenClaims: string[];

  /** 用語（将来の知識DB/辞書UIとの接点） */
  keyTerms: string[];

  /** plan の確信度 */
  confidence: "high" | "medium" | "low";
};

/** 因果の1ステップ */
type CausalStep = {
  /** 因果の種別 */
  type: "position_weakness" | "piece_activity" | "king_safety" | "tempo" | "material";
  /** 初心者向けの説明 */
  description: string;
  /** 関連するマス（盤面ハイライト用） */
  relatedSquares?: string[];
};
```

---

## 3. 各フィールドの責務

| フィールド | 誰が生成 | 誰が消費 | 説明 |
|-----------|---------|---------|------|
| reviewedMove | MistakeReviewPlanner | Verbalizer | ユーザーの手の情報。evalExpression は verbalizeEval() で生成 |
| betterMove | MistakeReviewPlanner | Verbalizer | 最善手の情報 |
| causalChain | MistakeReviewPlanner | Verbalizer | **核心**。差の因果をコード側で事前分析 |
| context | MistakeReviewPlanner | Verbalizer | 局面の大枠。Verbalizer が文脈に合った言い回しを選ぶ |
| nextLookFor | MistakeReviewPlanner | Verbalizer | 学びの要約。Verbalizer がそのまま使う |
| facts | MistakeReviewPlanner | Verbalizer + Verifier | 既存の buildFacts() を再利用 |
| forbiddenClaims | MistakeReviewPlanner | Verifier | 既存の buildForbiddenClaims() を再利用 |
| keyTerms | (将来) | (将来) | 知識DB/辞書UI/悪手パターン集計の接点。MVP では空配列 |
| confidence | MistakeReviewPlanner | Verbalizer | エンジンデータの有無で決まる |

---

## 4. causalChain の生成ロジック（概要）

MistakeReviewPlanner は以下の手順で causalChain を生成する:

1. **2局面の差分分析**: userMove 適用後と bestMove 適用後の盤面を比較
2. **feature 差分**: kingSafety, materialBalance, attackMap の変化を計算
3. **差分の因果分類**: 最も大きな変化を CausalStep.type に分類
4. **初心者向け記述**: type に応じたテンプレートで description を生成

```
例: userMove で角頭の守りが消えた場合

causalChain: [
  {
    type: "position_weakness",
    description: "この手で角頭（角の真上の地点）の守りがなくなり、相手に攻められやすくなりました",
    relatedSquares: ["8g"]
  }
]
```

**MVP での制限**: causalChain は最大2ステップ。複雑な因果は初心者には逆効果。

---

## 5. MVPで使わないフィールド

- `reviewedMove.evalBefore` / `evalAfter`: エンジンデータがない一般局面では取得できない。MVPではエンジンデータがある5局面のみ対応
- **keyTerms**: MVPでは空配列。ただし将来の knowledge DB / 辞書UI / ユーザーの悪手パターン集計の接点として予約するフィールドである。削除しないこと。
- `CausalStep.relatedSquares`: MVPではフロントエンドの盤面ハイライトが未実装。将来の boardAnchors と連動予定

---

## 6. ExplanationPlan との共通点・差異

| 観点 | ExplanationPlan | MistakeReviewPlan |
|------|----------------|-------------------|
| 目的 | 局面の最善手を説明 | ユーザーの手がなぜ悪いかを説明 |
| 入力 | 1局面 + エンジンデータ | 2局面（手の前後）+ ユーザーの手 + 最善手 |
| focus | FocusCategory[] | 不要（常に「悪手の因果」が焦点） |
| causalChain | なし | **あり（核心）** |
| bestMove | あり | betterMove として類似 |
| meaningfulAlternative | あり（比較用） | なし（比較対象は reviewedMove 固定） |
| facts | あり | あり（共通ロジック） |
| forbiddenClaims | あり | あり（共通ロジック） |
| teachingPoint | あり | nextLookFor として類似 |

---

## 7. Verbalizer への渡し方

MistakeReviewPlan を Verbalizer に渡す際のプロンプト構造:

```
あなたは将棋の初心者コーチです。
ユーザーが指した手を振り返り、なぜ別の手が良かったのかを説明してください。

## あなたの手
{reviewedMove.ja}
形勢の変化: {reviewedMove.evalExpression}

## より良い手
{betterMove.ja}
この手なら: {betterMove.evalExpression}
理由: {betterMove.reason}

## なぜ差がついたか
{causalChain を初心者向けに展開}

## 局面の事実
{facts}

## 次に同じ局面が来たら
{nextLookFor}

## 禁止事項
{forbiddenClaims}
- 評価値の数字を直接言わない
- ユーザーを責めない（「ダメな手」ではなく「もったいない手」等）
```

---

## verify fail 時の fallback

verify に失敗した場合は unsafe な出力を返さず、安全な短縮レビューに fallback する。

短縮レビューの内容:
- reviewedMove の手名
- context.phase
- nextLookFor
- 「詳細な因果説明はまだ安定しなかったため、要点のみを表示しています」

trust gate の方針（DEC-014 Phase 1.5）を継続する。

---

## 8. 実装順序の提案

1. **MistakeReviewPlan 型定義**（`src/lib/ai/plan.ts` に追加）
2. **MistakeReviewPlanner**（`src/lib/ai/mistake-planner.ts` 新規）
   - 2局面の差分分析 + causalChain 生成
   - 既存の kingSafety(), materialBalance() を再利用
3. **Verbalizer 拡張**（`src/lib/ai/prompt.ts` に `buildMistakeReviewPrompt()` 追加）
4. **Verifier 拡張**（`src/lib/ai/verifier.ts` に悪手レビュー用チェック追加）
5. **API route**（`/api/review-move` 新規 or `/api/explain` にモード追加）
6. **フロントエンド**（「この手をレビュー」ボタン + レビュー表示UI）

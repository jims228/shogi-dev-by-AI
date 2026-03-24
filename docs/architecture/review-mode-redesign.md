# Review Mode 再設計 — 人間監査を踏まえた根本修正

> 作成: context-manager
> 日付: 2026-03-24
> 前提: 人間が5ケースの review mode 出力を将棋的に検証した結果
> ステータス: 再設計方針。P0〜P3 の優先順位で実装へ進む

---

## 1. 監査結果のサマリー

### 3つの根本問題

| # | 問題 | 深刻度 | 影響 |
|---|------|--------|------|
| R1 | **エンジンの読み筋(PV)が主役になっていない** | 致命的 | 「なぜ差がつくか」をLLMが勝手に補っている。mate局面でも3手詰みの具体手順が出ない |
| R2 | **序盤は定跡知識が必要** | 重大 | LLMが「囲いの準備」「柔軟性に欠ける」等と雑に断定。戦型未確定の局面で戦型を断定 |
| R3 | **reviewedMove の grounding に穴がある** | 致命的 | case4: 8八の玉を空きマス扱い、角の手を「6六飛」と出力。USI→駒種の特定が盤面に grounded されていない |

### 5ケースの人間レビュー結果

| case | 局面 | 指し手 vs 最善手 | 判定 | 具体的問題 |
|------|------|-----------------|------|-----------|
| 1 | 序盤 | ▲3八銀 vs ▲7八金 | **NG** | 「囲いの準備」と断定。居飛車なら攻めの手。角頭ケア・入城準備は正しいが戦型による留保が必要 |
| 2 | 序盤 | ▲2六歩 vs ▲7八金 | 概ねOK | 方向は正しいが「飛車の利きを広くする」より「居飛車宣言」が適切な文脈 |
| 3 | 序盤 | ▲5八玉 vs ▲7八金 | **NG** | 「玉を動かすだけ」。角交換後の含み、角打ち筋ケアの文脈が完全に欠落 |
| 4 | 中盤 | 8h6f vs ▲2四歩打 | **最悪** | 8八には玉がいるのに空きマス扱い。角の手を「6六飛」と出力。システムバグ |
| 5 | 終盤 | R*5b vs ▲5一飛打 | 方向OK | 3手詰みの具体手順を出すべき。「逃げ道が残る」だけで終わっている |

---

## 2. 現行パイプラインの問題点

### 2.1 buildMistakeReviewPlan はどこまで engine-grounded か

**現状**（`src/lib/ai/mistake-planner.ts`）:

- **grounded**: 2局面（userMove後/bestMove後）の kingSafety, materialBalance の差分比較
- **grounded でない**:
  - PV/pvJa が plan に含まれていない。bestMove の名前と reason（description）のみ
  - reviewedMove の駒種が plan に含まれていない。USI文字列と ja（あれば）のみ
  - mate 情報が plan に含まれていない。engineData.eval_type === "mate" の分岐がない
  - 序盤の戦型・定跡情報が一切ない。phase === "opening" でも中盤と同じ WhyChain 生成

**結果**: WhyChain が玉安全度と駒割りの2軸のみ。「なぜ差がつくか」の因果の大部分を LLM に丸投げしている。

### 2.2 buildMistakeReviewPrompt はどこで LLM に自由度を与えているか

**現状**（`src/lib/ai/prompt.ts:321-384`）:

```
【出力形式】
1. あなたの手の評価（1文、責めない）
2. なぜ差がついたか（2-3文、因果を具体的に）   ← ここがLLM自由記述
3. より良い手ならどうなったか（1-2文）          ← ここがLLM自由記述
4. 次に同じような場面で何を見るか（1文）
```

- 「なぜ差がついたか」の2-3文は WhyChain の statement を参考にするが、LLM が自由に補足・意訳する
- 「より良い手ならどうなったか」は betterIdea.reason（1文）しかなく、PV に基づく具体手順がない
- **LLM の自由度が高すぎて、将棋的に不正確な補足が入る余地がある**

### 2.3 verifier は何を見逃しているか

**現状**（`src/app/api/review-move/verify.ts`）:

- reviewedMove / betterMove の文字列マッチのみ
- **見逃していること**:
  - 駒種の誤り（角を「飛」と呼ぶ等）→ case4 の致命的問題を検出できない
  - PV と矛盾する手順の検出 → PV 自体が plan にないので検出不可能
  - 戦型の断定（「居飛車」「振り飛車」等）→ 序盤で断定すべきでないケースを検出できない
  - LLM が plan.facts にない将棋的主張をした場合の検出 → facts が薄すぎる

---

## 3. 再設計方針: 3レーン制

局面のフェーズとエンジンデータの性質に応じて、3つの処理レーンに分岐する。

```
                ┌─ レーンA（opening/定跡）: 定跡DB主導、LLM不要 or 最小限
SFEN + move →  ├─ レーンB（詰み/戦術）:   engine PV をそのまま使う、template-first
                └─ レーンC（通常レビュー）: WhyChain + template-first + optional naturalizer
```

### レーンA: opening/定跡

**条件**: phase === "opening"（手数目安: 〜30手目）

**方針**:
- 定跡DB（opening card）から戦型候補を取得
- 戦型が確定していない場合は「まだ戦型が決まっていない段階です」と明示
- 「この手は○○戦法に向かう手です」「この手は○○の準備です」等、定跡に基づく deterministic な説明
- LLM は使わないか、テンプレート文の自然言語化のみ

**必要なデータ**: opening card（定跡の分岐木 + 各手の意味）

### レーンB: 詰み/戦術

**条件**: engineData.eval_type === "mate" または evalDelta が大きい（戦術的局面）

**方針**:
- engine の PV（読み筋）をそのまま主役にする
- 「▲5一飛打 → △1二玉 → ▲2四桂打 で3手詰み」のように具体手順を出力
- LLM は手順の補足説明（「なぜこの手で逃げ道が塞がるか」等）のみ担当
- template-first: 手順はテンプレートで固定し、補足のみ LLM

**必要なデータ**: engineData.pv / pv_ja（既にデータにはある）

### レーンC: 通常レビュー

**条件**: 上記以外

**方針**:
- WhyChain を拡張し、エンジン PV に基づく具体手順を含める
- template-first: レビュー構成はテンプレートで固定
- LLM は WhyChain の statement を自然言語化する optional naturalizer
- 「なぜ差がつくか」は PV の具体手順 + 盤面特徴量の差分で説明

---

## 4. 優先度

| 優先度 | 内容 | 根拠 | 推定サイズ |
|--------|------|------|-----------|
| **P0** | reviewedMove の合法性と駒種特定を直す | case4 の致命的バグ。盤面の駒をUSIから正しく特定する | 小（1PR） |
| **P1** | mate 局面では PV をそのまま主役にする（レーンB） | case5。PV は既にデータにある。plan に渡すだけ | 小（1PR） |
| **P2** | opening レーンを作る（レーンA の骨格） | case1/2/3。定跡 card の最小セットが必要 | 中（1-2PR） |
| **P3** | review mode を template-first にする（レーンC 改善） | 全ケース。LLM の自由記述を減らし、plan の情報を忠実に出力させる | 中（1PR） |

---

## 5. プロダクト定義の更新

### 旧定義
> 「なぜ負けた？に答えて、次に何を見るかを教えるAI」

### 新定義
> 「**エンジンの読み筋・局面文脈・定跡知識に基づいて**悪手を振り返り、次に何を見るかを教えるAI」

**変更の意図**: 「なぜ差がつくか」の根拠を明示する。LLM の将棋知識に依存しないことを定義レベルで宣言。

---

## 6. ExplanationPlan / MistakeReviewPlan の修正方針

### 6.1 PV/pvJa を plan の主役にする

```typescript
// MistakeReviewPlan に追加
betterIdea: {
  usi: string;
  ja: string;
  reason: string;
  evalExpression?: string;
  pv?: string[];       // ← 追加: エンジンの読み筋（USI）
  pvJa?: string[];     // ← 追加: 読み筋の日本語表記
};
```

buildMistakeReviewPlan で engineData.pv / pv_ja を betterIdea に渡す。
Verbalizer / template は pvJa を使って「▲5一飛打 → △1二玉 → ▲2四桂打」と具体手順を出力。

### 6.2 reviewedMove に pieceType（盤面から確定した駒種）を必須にする

```typescript
// ContextWindow.reviewedMove を拡張
reviewedMove: {
  usi: string;
  ja?: string;
  pieceType: AnyPieceType;  // ← 追加: 盤面から確定した駒種
  fromSquare?: string;       // ← 追加: 移動元（駒台からの打ちなら省略）
  toSquare: string;          // ← 追加: 移動先
};
```

buildMistakeReviewPlan で USI 文字列を盤面と照合し、fromSquare の駒種を特定する。
これにより「8h6f で8八には玉がいるのに角扱い」のバグが構造的に防止される。

### 6.3 mate 時は mateSequence を固定出力にする

```typescript
// MistakeReviewPlan に追加（レーンB用）
mateSequence?: {
  moves: string[];     // ["▲5一飛打", "△1二玉", "▲2四桂打"]
  mateIn: number;      // 3
};
```

mate 局面では mateSequence がある場合、Verbalizer は「この手順で詰みです」と固定出力する。LLM に手順を生成させない。

### 6.4 opening 時は openingCard を参照する

```typescript
// MistakeReviewPlan に追加（レーンA用）
openingInfo?: {
  strategyName?: string;       // "矢倉" "四間飛車" （確定時のみ）
  strategyUndecided: boolean;  // 戦型未確定なら true
  moveRole: string;            // "角頭ケア" "入城準備" "居飛車宣言" 等
  caveat?: string;             // "ただし相手が振り飛車なら意味が変わります" 等
};
```

opening card（定跡DB）から情報を引き、戦型が未確定なら strategyUndecided: true にして断定を防ぐ。

---

## 7. 人間の役割

| 領域 | 人間が担当する理由 |
|------|------------------|
| **将棋知識の判定** | LLMは将棋の因果を正しく判断できない（今回の監査で証明済み）。解説の将棋的正しさは人間が最終判定 |
| **golden evaluation corpus** | 5ケース＋今後追加。新しいレビュー出力を人間が将棋的に検証し、合格/不合格を判定する回帰テストの基盤 |
| **序盤の定跡DB監修** | opening card の内容（各手の意味、戦型の分岐条件）は人間が監修。LLM やエンジンだけでは定跡の「意味」は判断できない |

---

## 8. 今やらないこと

| 項目 | 理由 |
|------|------|
| 知識DB / 辞書UI の実装 | P0〜P3 が先。知識DB はレーンA の定跡 card が固まってから設計する |
| Lv.2 / Lv.3 explanation | 初心者向け（Lv.1）の品質を先に確立する |
| 自動悪手検出の高度化 | MVP は手動選択。自動検出は品質が安定してから |
| template-first の完全移行 | P3 でレーンC を template-first にするが、全レーンの完全移行は段階的に |

---

## 9. 次の最小PR案

### PR-P0: reviewedMove の合法性と駒種特定を直す

**変更箇所**: `src/lib/ai/mistake-planner.ts`
- USI 文字列の fromSquare を盤面と照合し、pieceType を確定する
- ContextWindow.reviewedMove に pieceType, fromSquare, toSquare を追加
- 駒台からの打ち（`P*2d` 形式）と盤上の移動（`8h6f` 形式）を正しく分岐
- 合法性チェック: fromSquare に本当にその駒がいるか盤面で確認

**テスト**: case4 相当のテストケース追加（8八に玉がいる状態で 8h6f を渡す）

---

### PR-P1: mate 局面では PV をそのまま主役にする

**変更箇所**: `src/lib/ai/mistake-planner.ts`, `src/lib/ai/prompt.ts`
- buildMistakeReviewPlan: engineData.eval_type === "mate" のとき、mateSequence を生成
- buildMistakeReviewPrompt: mateSequence がある場合はテンプレートで固定出力（「この手順で○手詰みです: ...」）
- betterIdea に pv/pvJa を追加

**テスト**: case5 相当のテストケース追加（3手詰み局面）

---

### PR-P2: opening レーンの骨格

**変更箇所**: `data/opening-cards/`, `src/lib/ai/mistake-planner.ts`, `src/lib/ai/prompt.ts`
- opening card の最小セット（5〜10手目の主要分岐: ▲7六歩系、▲2六歩系）
- buildMistakeReviewPlan: phase === "opening" のとき openingInfo を生成
- buildMistakeReviewPrompt: openingInfo がある場合、戦型の断定を避けた表現を使用
- openingInfo.strategyUndecided === true なら「戦型はまだ決まっていません」を明示

**テスト**: case1/2/3 相当のテストケース追加

---

### PR-P3: review mode を template-first にする

**変更箇所**: `src/lib/ai/prompt.ts`
- buildMistakeReviewPrompt の構造を変更: LLM 自由記述 → plan の情報をテンプレートで埋め込み + LLM は自然言語化のみ
- 「なぜ差がついたか」を WhyChain.statement + PV 手順で構成し、LLM には文の接続と補足のみを許可
- forbiddenClaims に「plan.facts にない将棋的主張をしない」を追加

**テスト**: 全5ケースの回帰テスト

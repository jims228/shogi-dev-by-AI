# Opening Lane 接続設計メモ

> 作成: researcher セッション
> 作成日: 2026-03-24
> 目的: data/opening-cards/ のカードを planner/mistake-planner から参照し、序盤解説を deterministic にする設計を提案する
> 注意: 実装はbuilderの責務。このドキュメントは設計の材料提供

---

## 1. 現状の構造

### 1.1 データフロー

```
CanonicalPosition (moveHistory 付き)
    ↓
buildPlan() / buildMistakeReviewPlan()
    ↓
ExplanationPlan / MistakeReviewPlan
    ↓
LLM (verbalize)
```

### 1.2 opening card が入る位置

```
CanonicalPosition (moveHistory 付き)
    ↓
  ┌─────────────────────────┐
  │ matchOpeningCards()      │  ← 新規: カードマッチング
  │ moveHistory × triggerMoves │
  └──────────┬──────────────┘
             ↓ matched cards
buildPlan() / buildMistakeReviewPlan()
    ↓
ExplanationPlan / MistakeReviewPlan (cards 注入済み)
    ↓
LLM (verbalize)
```

---

## 2. triggerMoves マッチングの最小ロジック

### 2.1 マッチング方式

```typescript
/**
 * moveHistory に card.triggerMoves が「すべて含まれている」場合にマッチ。
 * 順序は問わない（手順の順番は局面によって前後する場合がある）。
 */
function matchOpeningCards(
  moveHistory: string[],
  cards: OpeningCard[]
): OpeningCard[] {
  return cards.filter(card => {
    if (card.triggerMoves.length === 0) return false; // 空配列はマッチしない
    return card.triggerMoves.every(m => moveHistory.includes(m));
  });
}
```

**設計判断**:
- **部分集合マッチ**: `triggerMoves` の全要素が `moveHistory` に含まれていればヒット
- **順序不問**: 「▲7六歩→△3四歩」と「△3四歩→▲7六歩」はどちらもマッチ。先手/後手の手順差を吸収
- **空配列はスキップ**: `opening-undecided` は triggerMoves が空なので、別ルートで参照（後述）

### 2.2 具体例

```
moveHistory = ["7g7f", "3c3d", "2g2f"]

マッチ結果:
  opening-kakugawari-potential  triggerMoves: ["7g7f", "3c3d"]  → ヒット ✓
  opening-static-rook           triggerMoves: ["2g2f"]          → ヒット ✓
  opening-right-silver          triggerMoves: ["3i3h"]          → ミス ✗
  concept-bishop-head           triggerMoves: ["6i7h", "7i6h"]  → ミス ✗
  concept-rook-pawn             triggerMoves: ["2g2f", "2f2e"]  → ミス ✗（2f2e がない）
```

### 2.3 複数ヒット時の優先順位

複数カードがヒットする場合の優先ルール:

```typescript
function prioritizeCards(matched: OpeningCard[]): OpeningCard[] {
  // 1. triggerMoves が多い（より具体的な）カードを優先
  const sorted = [...matched].sort((a, b) =>
    b.triggerMoves.length - a.triggerMoves.length
  );

  // 2. 最大3枚まで（情報過多を防ぐ）
  return sorted.slice(0, 3);
}
```

**理由**: `triggerMoves: ["7g7f", "3c3d"]`（2条件）は `triggerMoves: ["2g2f"]`（1条件）より具体的。具体的なカードが上に来る。

### 2.4 opening-undecided の特別扱い

`opening-undecided` は triggerMoves が空のため通常のマッチには入らない。
代わりに以下の条件で自動注入する:

```typescript
// 手数10手以下 かつ 具体的な opening card がヒットしていない場合
if (position.moveNumber <= 10 && matchedOpeningCards.length === 0) {
  matchedOpeningCards.push(undecidedCard);
}

// または、ヒットしたカードがすべて「含み」系（caution付き）の場合
if (matchedOpeningCards.every(c => c.caution !== null) && position.moveNumber <= 10) {
  matchedOpeningCards.push(undecidedCard);
}
```

---

## 3. planner への接続方法

### 3.1 buildPlan() への注入ポイント

```typescript
// planner.ts の buildPlan() 内

export function buildPlan(
  position: CanonicalPosition,
  engineData?: EngineData,
  openingCards?: OpeningCard[]  // ← 新パラメータ
): ExplanationPlan {
  // ... 既存の phase, focus 判定 ...

  // === Opening Lane 注入 ===
  const matchedCards = openingCards
    ? matchOpeningCards(position.moveHistory, openingCards)
    : [];

  // facts に注入
  const facts = buildFacts(position, engineData);
  for (const card of matchedCards) {
    facts.push(`[序盤知識] ${card.shortDescription}`);
  }

  // forbiddenClaims に caution を注入
  const forbidden = buildForbiddenClaims(position);
  for (const card of matchedCards) {
    if (card.caution) {
      forbidden.push(card.caution);
    }
  }

  // teachingPoint に coachAngle を使用（序盤の場合）
  const phase = estimatePhase(position.moveNumber);
  let teachingPoint = ext?.learning_point ?? "この局面固有の学びを1つ伝えてください。";
  if (phase === "opening" && matchedCards.length > 0) {
    // 最も具体的な（triggerMovesが多い）カードの coachAngle を使用
    teachingPoint = matchedCards[0].coachAngle;
  }

  // ... 残りの plan 構築 ...
}
```

### 3.2 buildMistakeReviewPlan() への注入ポイント

```typescript
// mistake-planner.ts の buildMistakeReviewPlan() 内

export function buildMistakeReviewPlan(
  position: CanonicalPosition,
  userMove: MoveInput,
  bestMove: MoveInput,
  engineData?: EngineData,
  openingCards?: OpeningCard[]  // ← 新パラメータ
): MistakeReviewPlan {
  // ... 既存ロジック ...

  // === Opening Lane 注入 ===
  const matchedCards = openingCards
    ? matchOpeningCards(position.moveHistory, openingCards)
    : [];

  // facts に注入
  const facts = buildSimpleFacts(position, diffs);
  for (const card of matchedCards) {
    facts.push(`[序盤知識] ${card.shortDescription}`);
  }

  // forbiddenClaims に caution を注入
  for (const card of matchedCards) {
    if (card.caution) {
      forbiddenClaims.push(card.caution);
    }
  }

  // keyTerms に card.keyTerms を注入
  const keyTerms: string[] = [];
  for (const card of matchedCards) {
    keyTerms.push(...card.keyTerms);
  }

  // nextLookFor をカードから上書き（序盤の場合）
  if (phase === "opening" && matchedCards.length > 0) {
    nextLookFor = matchedCards[0].coachAngle;
  }
}
```

### 3.3 注入のまとめ

| plan のフィールド | 注入元 | 注入条件 |
|-----------------|--------|---------|
| `facts` | `card.shortDescription` | マッチしたカードすべて |
| `forbiddenClaims` | `card.caution` | caution が null でないカード |
| `teachingPoint` (ExplanationPlan) | `card.coachAngle` | 序盤 + マッチあり |
| `nextLookFor` (MistakeReviewPlan) | `card.coachAngle` | 序盤 + マッチあり |
| `keyTerms` (MistakeReviewPlan) | `card.keyTerms` | マッチしたカードすべて |

---

## 4. 「言わせない」制御の具体案

### 4.1 問題

`card.caution = "この段階では戦型を断定しない"` をどうやって LLM に守らせるか。

### 4.2 現状の forbiddenClaims の使われ方

現在の `forbiddenClaims` はプロンプトに以下のように注入されている（`src/lib/ai/prompt.ts` で確認が必要）:

```
【言ってはいけないこと】
- 評価値の数字（+127等）を直接言わない
- 先手の飛車は２八にいる（これと矛盾する位置を述べてはいけない）
```

### 4.3 caution → forbiddenClaims の変換

caution テキストをそのまま `forbiddenClaims` に入れるのではなく、**否定形に変換**して入れる:

```typescript
function cautionToForbidden(caution: string): string {
  // caution: "この段階では戦型を断定しない。相手の方針次第で変化する。"
  // → forbidden: "戦型を断定してはいけない（角換わり/矢倉/振り飛車と決めつけない）。
  //              「〜含み」「〜の可能性がある」のように留保をつけること"

  // 現時点では手動マッピングが最も確実
  return caution;
}
```

**事実**: 現在の forbiddenClaims は自然言語テキストとしてプロンプトに入っている。caution テキストも同じ形式で入れれば、LLM は理解できる。

**懸念**: forbiddenClaims に入れるだけで十分か？

### 4.4 3段階の防御策（提案）

forbiddenClaims だけでは不十分な場合の段階的な対策:

| レベル | 手段 | コスト | 効果 |
|--------|------|--------|------|
| **L1** | `forbiddenClaims` に caution を入れる | 低 | LLM が「言ってはいけない」リストとして認識 |
| **L2** | `facts` に `[序盤知識]` としてカードの shortDescription を入れる | 低 | LLM が正しい知識を持った上で生成するため、誤った断定が減る |
| **L3** | Verifier で出力をチェック | 中 | 生成後に「矢倉戦です」「角換わりです」の断定表現を検出して弾く |

**提案**: L1 + L2 を同時に実装（コスト低）。L3 は Verifier の拡張として別タスク。

### 4.5 L3: Verifier での断定検出（将来）

```typescript
// verifier の追加ルール案
const OPENING_ASSERTION_PATTERNS = [
  /この局面は(矢倉|角換わり|相掛かり|四間飛車|振り飛車)です/,
  /^(矢倉|角換わり|相掛かり|四間飛車|振り飛車)の(定跡|戦型|形)です/,
  /(矢倉|角換わり)戦法の序盤です/,
];

function checkOpeningAssertion(text: string, moveNumber: number): string | null {
  if (moveNumber > 15) return null; // 15手以降は断定OK
  for (const pat of OPENING_ASSERTION_PATTERNS) {
    if (pat.test(text)) {
      return `序盤（手数${moveNumber}）で戦型を断定しています。「〜含み」「〜の可能性がある」に修正してください`;
    }
  }
  return null;
}
```

---

## 5. カードの読み込み方法

### 5.1 JSON の静的インポート

```typescript
// src/lib/opening/cards.ts（新規ファイル）

import kakugawari from "../../../data/opening-cards/opening-kakugawari-potential.json";
import staticRook from "../../../data/opening-cards/opening-static-rook.json";
import rightSilver from "../../../data/opening-cards/opening-right-silver.json";
import bishopHead from "../../../data/opening-cards/concept-bishop-head.json";
import rookPawn from "../../../data/opening-cards/concept-rook-pawn.json";
import castlingPrep from "../../../data/opening-cards/concept-castling-prep.json";
import undecided from "../../../data/opening-cards/opening-undecided.json";

export type OpeningCard = typeof kakugawari; // JSON から型推論

export const ALL_OPENING_CARDS: OpeningCard[] = [
  kakugawari, staticRook, rightSilver,
  bishopHead, rookPawn, castlingPrep, undecided,
];
```

**利点**: ビルド時に型チェック可能、DBやファイルI/O不要、Vercelデプロイと相性良い
**代替案**: `fs.readFileSync` で動的に読む → SSR では動くが、edge runtime では動かない可能性

### 5.2 API Route からの呼び出し

```typescript
// src/app/api/explain/route.ts 内

import { ALL_OPENING_CARDS } from "@/lib/opening/cards";

// buildPlan に openingCards を渡す
const plan = buildPlan(position, engineData, ALL_OPENING_CARDS);
```

---

## 6. 実装工数の見積もり

| 項目 | 工数 | 依存 |
|------|------|------|
| `matchOpeningCards()` 関数 | 小 | なし |
| `buildPlan()` への注入（L1+L2） | 小 | matchOpeningCards |
| `buildMistakeReviewPlan()` への注入 | 小 | matchOpeningCards |
| カード読み込みモジュール | 小 | カードJSON |
| API Route への接続 | 小 | 上記全部 |
| テスト（マッチングロジック） | 小 | matchOpeningCards |
| **合計** | **小〜中** | |

**所感**: 全体で builder の 1タスク分（30分〜1時間）の工数。新規ファイルは `src/lib/opening/cards.ts` の1つと、テストファイル1つ。既存コードへの変更は `planner.ts` と `mistake-planner.ts` の引数追加と数行の注入のみ。

---

## 未決事項

| # | 質問 | 影響 | 判断者 |
|---|------|------|--------|
| OL1 | triggerMoves の順序を考慮するか（現提案は順序不問） | マッチ精度 | builder |
| OL2 | opening-undecided の自動注入条件（手数10手以下?） | カード選択の挙動 | builder + reviewer |
| OL3 | teachingPoint / nextLookFor をカードで上書きするか、追記するか | 出力の制御 | builder |
| OL4 | Verifier での断定検出（L3）をいつ実装するか | 出力品質 | 人間 |

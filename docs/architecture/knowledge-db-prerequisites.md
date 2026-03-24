# 知識DB導入の前提整理

> 作成: context-manager
> 日付: 2026-03-24
> 目的: 知識DB導入前に、確定済みの設計判断・現状パイプライン・未確定論点・リスクを整理する
> ステータス: 前提整理（実装ではない）

---

## 1. 確定済みの設計判断

### DEC サマリー（関連するもの）

| DEC | 概要 | 知識DBとの関連 |
|-----|------|---------------|
| DEC-002 | 正確性はエンジン事前計算データで検証 | 知識DBもエンジンデータと同様に「事前に正しいと確認された情報」を提供する |
| DEC-003 | clean-room実装。v2のデータファイルの中身はコピー禁止 | 知識カードも新規作成が必要 |
| DEC-005 | MVPは初心者（ウォーズ5級〜3級）限定 | 知識DBの説明レベルは初心者向けに統一 |
| DEC-010 | LLM Provider: Gemini API | 知識DBはLLM非依存。Plannerがコードで参照する |
| DEC-014 | plan-first パイプライン。LLMはverbalizer | **中核方針**。知識DBはPlannerが参照し、ExplanationPlanに情報を含める。LLMは渡された情報を言語化するだけ |

### 現在のパイプライン構造

```
SFEN入力
  ↓
Canonicalize  → CanonicalPosition（盤面・手番・持ち駒・手数・履歴）
  ↓
Engine Lookup → ExtendedEngineData（5局面限定の事前計算キャッシュ）
  ↓
Planner       → ExplanationPlan（focus, facts, bestMove, alternative, forbiddenClaims, ...）
  ├── kingSafety(), materialBalance(), attackMap()  ← feature extraction
  ├── isLegalMove()                                 ← legality gate
  └── verbalizeEval()                               ← 評価値の言語化
  ↓
Prompt Builder → Gemini API（verbalizer）
  ↓
Verifier      → VerifyResult（bestmove一致, 評価値数字漏出, 座標整合性, 切断検出）
  ↓
解説テキスト出力
```

### Trust Gate の状態

| コンポーネント | 状態 | 内容 |
|--------------|------|------|
| Legality Gate | **実装済み** | buildPlan() 内で bestMove, alternative の合法性をチェック。不合法なら手順省略 |
| Verifier | **実装済み** | bestmove言及、評価値数字漏出、禁止事項違反、facts外座標、切断を検出 |
| Verifier API統合 | **未統合** | ライブラリとしては存在するが、ストリーミングフローに未組み込み |
| forbiddenClaims | **実装済み** | 大駒位置の矛盾検出。Planner → Verifier の連携 |

### 現在の ExplanationPlan 型（src/lib/ai/plan.ts）

```typescript
type ExplanationPlan = {
  audience: "beginner" | "intermediate";
  focus: FocusCategory[];          // 解説の焦点（優先順）
  facts: string[];                 // 盤面から導出された客観的情報
  bestMove: { usi, ja, reason, mainLine? };
  meaningfulAlternative?: { usi, ja, whyWorse };
  commonMistake?: { ja, whyTempting, whyBad };
  teachingPoint: string;           // この局面から学べること
  forbiddenClaims: string[];       // LLMが言ってはいけない主張
  retryQuestion?: string;          // 生成後に自問させる質問
  confidence: "high" | "medium" | "low";
};
```

### 知識関連の現状

| 資産 | 状態 | 場所 |
|------|------|------|
| 用語集 | 25語 | `data/glossary.json` — `{ term, reading, explanation, category }` |
| 知識カード | 20枚（4カテゴリ） | `data/knowledge-cards/` — `{ id, category, title, level, content }` |
| エンジンデータ | 5局面 | `data/prompt-examples/` — 事前計算済み |
| 概念語の補足 | **LLM依存** | 「居飛車」「囲い」「角頭」等はプロンプト内でLLMが補足 |

---

## 2. 未確定の論点

### 2.1 知識DBの単位

| 選択肢 | 特徴 | 懸念 |
|--------|------|------|
| **Card（現行の拡張）** | 1概念=1カード。JSON。シンプルで読みやすい | 概念間の関係（「矢倉は居飛車の一種」）が表現しにくい |
| **Table（RDB的）** | 概念テーブル + 関係テーブル。階層構造が自然 | MVPにはオーバー。JSON静的ファイルの原則から外れる |
| **Vector（embedding）** | 類似概念の検索が可能。柔軟 | LLM依存が増える。「正しさの保証」と相性が悪い |

**事実**: 現在の知識カード（20枚）は flat な JSON。関係性の情報はない。
**論点**: Plannerが概念を参照する際に「この局面に関連するカード」をどう選ぶか。カテゴリマッチ? キーワードマッチ? 明示的なルール?

### 2.2 Planner が返すもの: 文か concept id か

| 選択肢 | 特徴 | 懸念 |
|--------|------|------|
| **文（現行）** | `facts: string[]` に自然言語で説明を含める | Verbalizer がさらに意訳するリスク。二重言語化 |
| **concept id** | `conceptCardIds: ["card-yagura", "card-kakugashira"]` を返す | Verbalizer がカードの内容をどう組み込むかのプロンプト設計が必要 |
| **ハイブリッド** | facts は文のまま + conceptCardIds を別フィールドで渡す | Plan が太る。ただし責務は明確 |

**論点**: concept id を返す場合、Verbalizer は「カードの内容を読んで、解説文に自然に組み込む」必要がある。これは verbalizer の責務を超えないか?

### 2.3 click-to-open 辞書: 本文後処理か plan 起点か

| 選択肢 | 特徴 | 懸念 |
|--------|------|------|
| **本文後処理** | LLM出力のテキストから用語を検出し、リンクに変換 | 検出精度に依存。LLMが書いた表現と辞書の見出し語が一致しない可能性 |
| **plan 起点** | Planner が `glossaryTerms: [{ term: "角頭", cardId: "card-kakugashira" }]` を返す | Verbalizer に「この用語を必ず使え」という制約が増える |

**論点**: ユーザー体験としては「解説文中の用語をクリックすると右側に詳細が開く」。この体験は plan 起点のほうが制御しやすいが、Verbalizer への制約が増える。

### 2.4 shogi-extend の位置づけ

| 選択肢 | 意味 | 懸念 |
|--------|------|------|
| **参照元** | shogi-extend の公開データを参考に知識カードを作成。本プロジェクトが独自にデータを保持 | データの二重管理。更新追従が手動 |
| **dependency** | shogi-extend の API やデータファイルを直接参照 | 外部依存。shogi-extend の変更で壊れる。オフライン動作不可 |
| **インスピレーション** | 概念構造を参考にするが、内容は独自作成 | clean-room 原則に最も近い |

**事実**: DEC-003 の clean-room 原則は v2 に対するもの。shogi-extend は別プロジェクトなので直接適用されないが、精神は同じ。
**論点**: shogi-extend のデータ利用条件（ライセンス）の確認が必要。

### 2.5 一般局面へのエンジンデータ供給

| 選択肢 | 特徴 | 懸念 |
|--------|------|------|
| **現状維持（5局面キャッシュ）** | engine-lookup.ts で JSON から読む | ユーザーが任意のSFENを貼り付けると engineData なしで Plan が生成される。confidence: "low" |
| **サーバーサイドエンジン** | Stockfish/やねうら王 をサーバーで動かし、リアルタイム計算 | インフラコスト。Vercel Serverless では動かしにくい |
| **外部API** | Lichess Analysis API 等 | 将棋に対応していない。やねうら王の公開APIは存在しない |
| **クライアントサイド WASM** | ブラウザでやねうら王 WASM を動かす | 実装コスト高。ただしインフラ不要 |

**事実**: 現在の engine-lookup.ts は「5局面限定の応急処置」とコメントされている。
**論点**: 知識DB導入の前に、一般局面対応が先か後か。知識DBがあってもエンジンデータがなければ Plan の confidence は low のまま。

---

## 3. リスク

### 3.1 ExplanationPlan を太らせすぎるリスク

**現状**: ExplanationPlan は 11 フィールド。知識DB導入で +3 フィールド（conceptCardIds, boardAnchors, glossaryTerms）追加すると 14 フィールド。

**リスク**:
- Verbalizer のプロンプトが長大化し、情報の取捨選択ができなくなる（Day 3 の W3 問題の再発）
- Planner の buildPlan() が複雑化し、テストが難しくなる
- Plan の全フィールドを「正しく」埋めるためのエンジンデータ・知識データの前提が増える

**緩和策**: focus フィールドの活用。focus に含まれないカテゴリの情報は Plan に含めても Verbalizer が無視するルールにする。priority フィールドの導入（Day 3 W3 対応として検討済み）。

### 3.2 知識カードを作りすぎるリスク

**現状**: 20枚。将棋の概念は数百〜千単位。全てカード化すると:
- メンテナンスコストが爆発
- カード間の整合性維持が困難
- 「正しいカード」の品質保証が必要（reviewer が全カードを検証?）

**緩和策**: 「解説で実際に使われたカード」のみを増やす。需要駆動。最初は 30〜50 枚を上限とし、ユーザーフィードバックで優先度を決める。

### 3.3 LLM依存を減らしすぎて柔軟性を失うリスク

**現状**: LLM は verbalizer。Plan の情報を言語化するだけ。

**リスク**:
- Plan に含まれない情報は解説に一切出ない → 初心者が本当に知りたいことが Plan にない場合、解説が不自然になる
- 「なぜこの手が良いのか」の直感的な説明は、ルールベースの Planner では生成しにくい
- Q&A で「Plan にない質問」への対応ができない

**緩和策**: confidence フィールドの活用。confidence: "low" の場合は LLM に一定の自由度を与える。Q&A は plan-grounded だが plan-only ではない（DEC-014 方針3）。

---

## 4. ExplanationPlan への想定追加項目

知識DB導入により、以下のフィールドを ExplanationPlan に追加する想定:

```typescript
type ExplanationPlan = {
  // ... 既存フィールド（11個）...

  /** この局面に関連する概念カードのID */
  conceptCardIds: string[];
  // 例: ["card-yagura", "card-kakugashira", "card-sente-initiative"]
  // Planner が局面の特徴・フェーズ・戦型から選択
  // Verbalizer はカードの内容を参照して解説に組み込む

  /** 盤面上の注目マス（UI側で盤面ハイライトに使う） */
  boardAnchors: Array<{
    square: string;   // "7h" (USI形式) or "３七" (日本語形式)
    label: string;    // "角頭" "玉の逃げ道" "飛車の利き"
  }>;
  // 解説と盤面を視覚的に連動させるためのメタデータ
  // LLM は使わない。フロントエンドが直接参照

  /** 解説文中で補足すべき用語（click-to-open 辞書のソース） */
  glossaryTerms: Array<{
    term: string;     // "角頭"
    cardId: string;   // "card-kakugashira"
  }>;
  // Verbalizer に「この用語を使ったら補足を入れよ」と指示
  // or 本文後処理で用語検出 → cardId にリンク
};
```

### 追加フィールドの責務

| フィールド | 誰が生成 | 誰が消費 | LLMが使うか |
|-----------|---------|---------|-----------|
| conceptCardIds | Planner（ルールベース） | Verbalizer（プロンプトにカード内容を含める） | 間接的に（カード内容が prompt に入る） |
| boardAnchors | Planner（盤面分析から） | フロントエンド（盤面ハイライト） | 使わない |
| glossaryTerms | Planner（facts の用語から） | Verbalizer or 後処理 | 場合による（2.3 の論点） |

---

## 5. 次の自然な成果物の提案

知識DB導入に向けて、以下の順序で進めることを提案する:

### Phase A: 型定義と Planner 拡張（小さなdiff）

**成果物**: ExplanationPlan に `conceptCardIds`, `boardAnchors`, `glossaryTerms` を追加。Planner が既存の知識カード（20枚）と用語集（25語）を参照して自動的にIDを選択するロジック。

**前提条件**: なし（既存の知識カード + 用語集で動作）
**リスク**: 低（型追加 + ルールベースロジック）

### Phase B: Verbalizer の対応

**成果物**: prompt builder が conceptCardIds に対応するカードの内容をプロンプトに含める。glossaryTerms に基づいて「用語補足を入れよ」指示を追加。

**前提条件**: Phase A
**リスク**: 中（プロンプトの長大化 → W3 再発の可能性）

### Phase C: フロントエンド — 盤面ハイライト + 辞書UI

**成果物**: boardAnchors に基づく盤面上のマスハイライト。glossaryTerms に基づく click-to-open の辞書パネル（右側）。

**前提条件**: Phase A（API レスポンスに boardAnchors, glossaryTerms が含まれる）
**リスク**: 中（UI実装の工数）

### Phase D: 知識カード拡充（需要駆動）

**成果物**: 実際の解説で使われた概念を元にカードを追加（30〜50枚目標）。

**前提条件**: Phase B（Verbalizer がカードを使えるようになってから）
**リスク**: 低（データ追加のみ）

### 未解決の前提（Phase 前に人間が判断すべき）

1. **shogi-extend の位置づけ**: 参照元? dependency? インスピレーション? → ライセンス確認
2. **一般局面対応の優先度**: 知識DB より先か後か?
3. **click-to-open の実装方式**: plan 起点 vs 本文後処理
4. **Planner の返却単位**: concept id を採用するか、facts 文に知識を埋め込むか

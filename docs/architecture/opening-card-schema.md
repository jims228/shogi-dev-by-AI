# Opening Card Schema

> 作成: researcher セッション
> 作成日: 2026-03-24
> 目的: data/opening-cards/ のJSONファイルの構造を定義する

---

## 1. ファイル配置

```
data/opening-cards/
├── opening-kakugawari-potential.json
├── opening-static-rook.json
├── opening-right-silver.json
├── concept-bishop-head.json
├── concept-rook-pawn.json
├── concept-castling-prep.json
└── opening-undecided.json
```

1ファイル = 1カード。ファイル名はカードの `id` と一致させる。

## 2. Schema 定義

```typescript
interface OpeningCard {
  // === 識別 ===
  id: string;                    // ファイル名と一致。例: "opening-static-rook"
  name: string;                  // 日本語表示名。例: "居飛車含み"
  category: "opening" | "concept";
  parentId: string | null;       // 分類木の親カード ID

  // === 局面マッチング ===
  triggerMoves: string[];        // この概念が関連する手順（USI形式）
  phase: "opening" | "middle" | "endgame";

  // === 説明 ===
  shortDescription: string;      // 1行（40文字以内）。UI プレビュー用
  coachAngle: string;            // 「先生ならこう教える」視点の説明（2-3文）
  caution: string | null;        // 留保・注意点。戦型未確定の場合は必須
  keyTerms: string[];            // 関連する将棋用語

  // === 関連 ===
  relatedCards: string[];        // 関連カード ID

  // === 出典 ===
  sourceRefs: SourceRef[];       // 参照元情報（ingestion policy 準拠）
  status: "permission-cleared" | "original" | "needs-review";
}

interface SourceRef {
  sourceRepo: string;            // リポジトリ名またはURL
  sourcePath: string;            // 参照したファイルパス
  ingestionMode: "copied" | "excerpted" | "adapted" | "original";
  permissionNote: string;        // 許可状況
}
```

## 3. フィールド詳細

### id
- 英語、ハイフン区切り、小文字
- プレフィックス: `opening-`（戦型・序盤）、`concept-`（一般概念）
- 意味が分かる名前にする

### triggerMoves
- USI形式の手順リスト
- この手順が出現したときにカードが関連する
- 空配列の場合は手順ではなく概念として参照される

### coachAngle
- 品質原則準拠: 将棋用語で説明し、LLMの一般論にしない
- 「先生が生徒に教えるなら」の視点で書く
- 戦型未確定の場合は断定を避ける

### caution
- 戦型未確定局面では必須
- 品質原則1: 「この段階では戦型を断定しない」
- 例: "角道を開けただけでは角換わりとは限らない。相手の応手次第で矢倉にも振り飛車にもなる"

### sourceRefs
- ingestion policy (opening-card-ingestion-policy.md) に従う
- 独自作成でも空配列 `[]` を持つ

## 4. 品質原則との対応

| 品質原則 | カードでの対応 |
|---------|-------------|
| 戦型未確定で断定しない | `caution` フィールドで留保を明示 |
| 将棋用語で説明する | `coachAngle` で将棋用語を使用 |
| LLMに意味づけさせない | `shortDescription` / `coachAngle` で正確な説明を事前に用意 |

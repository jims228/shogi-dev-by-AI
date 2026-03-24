# 知識DB設計の材料調査

> 作成: researcher セッション
> 調査日: 2026-03-24
> 目的: 将棋知識をgroundingするためのDB/カード設計の材料を集める

---

## 1. shogi-extend エコシステムの調査

### 1.1 全体構成

shogi-extend は akicho8 (池田彰) 氏が開発する将棋関連ツール群。以下のリポジトリで構成される:

| リポジトリ | URL | 内容 |
|-----------|-----|------|
| **shogi-extend** | https://github.com/akicho8/shogi-extend | メインWebアプリ（Ruby on Rails）。将棋ウォーズ棋譜検索、共有将棋盤、棋譜変換 |
| **bioshogi** | https://github.com/akicho8/bioshogi | コアライブラリ。棋譜読み込み、フォーマット変換、**戦法抽出**、AI |
| **SKK-JISYO.shogi** | https://github.com/akicho8/SKK-JISYO.shogi | 将棋用語辞書（SKK入力用）。戦型名・囲い名等を網羅。CC BY-SA 2.1 |
| **shogi-player** | https://github.com/akicho8/shogi-player | Webブラウザ用の将棋盤コンポーネント |

### 1.2 概念設計として参考になる点

#### 盤面共有の仕組み（共有将棋盤）

- **SFENのURL化**: SFEN文字列をBase64エンコードしてURLパラメータに埋め込む
- **複数フォーマット対応**: KIF/KI2/SFEN/BODの相互変換を内蔵
- **USEN形式**: URL Safe sfen-Extended Notation。36進数3文字で1手を表現（USIの5文字より効率的）
- **参考にすべき点**: 盤面をURLで共有できる仕組みは、「この局面を誰かに見せたい」ときに有用。将来の辞書UIで「この局面を開く」リンクに応用可能

#### 戦法抽出（bioshogi）

- **事実**: bioshogiは棋譜から戦法（戦型）を自動判定する機能を持つ
- **概念**: 駒の配置パターンから「この局面は矢倉」「この局面は四間飛車」と分類する
- **参考にすべき点**: 戦法の分類体系（居飛車系/振り飛車系の大分類→戦型名の小分類）

#### 用語辞書（SKK-JISYO.shogi）

- **事実**: 将棋用語のIME辞書。読み→用語のマッピング
- **事実**: 「将棋ウォーズ系戦法.txt」という戦法名リストファイルが含まれる
- **参考にすべき点**: 用語の網羅性、戦法名の公式名称リスト
- **ライセンス**: CC BY-SA 2.1 Japan — 用語名のリスト程度の参照は可能だが、データファイルの丸コピーは避ける

### 1.3 参照してよいもの / 止まりにすべきもの

| 区分 | 対象 | 理由 |
|------|------|------|
| **参照OK** | 概念設計: 戦法分類の体系（大分類→小分類の階層構造） | 概念レベルの設計パターン |
| **参照OK** | 概念設計: SFENのURL化方式（Base64/USEN） | 技術的アプローチの参考 |
| **参照OK** | 概念設計: 用語辞書のカテゴリ分類の考え方 | 分類体系の参考 |
| **参照OK** | SKK辞書の用語名リスト（固有名詞として） | 「矢倉」「四間飛車」等は一般的な将棋用語 |
| **参照止まり** | bioshogi のソースコード | clean-room原則。戦法判定ロジック等はコピーしない |
| **参照止まり** | SKK辞書のデータファイル全体 | ライセンス遵守のため丸コピーしない |
| **使用しない** | shogi-extend を runtime dependency にすること | 独立したプロダクトとして構築する |
| **使用しない** | shogi-player コンポーネント | 将棋盤は独自実装（clean-room） |

---

## 2. 概念カテゴリの整理

### 2.1 opening（戦型）

将棋の戦型を初心者向けに分類。大分類→小分類の2階層で整理。

| 大分類 | 小分類（カード化候補） | 初心者優先度 |
|--------|---------------------|------------|
| 居飛車 | 相掛かり、角換わり、矢倉戦法、横歩取り | 中 |
| 振り飛車 | 四間飛車、三間飛車、中飛車、向かい飛車 | 高（初心者が多い） |
| 対抗形 | 居飛車 vs 振り飛車（急戦/持久戦） | 高 |
| 特殊 | 嬉野流、筋違い角、鬼殺し | 低（MVP不要） |

**初期セット候補（8項目）**:
1. 居飛車（概念カード）
2. 振り飛車（概念カード）
3. 四間飛車
4. 中飛車
5. 相掛かり
6. 角換わり
7. 矢倉戦法
8. 対抗形（居飛車 vs 振り飛車）

### 2.2 castle（囲い）

**既存カード（5枚）**: 矢倉、美濃、穴熊、舟囲い、雁木

**追加候補（5項目）**:
1. 高美濃 — 美濃の発展形
2. 銀冠 — 美濃からさらに発展
3. 左美濃 — 居飛車での美濃
4. 中住まい — 玉を中央に置く形
5. 金矢倉 — 矢倉の一種

### 2.3 concept（概念）

**既存カード（5枚）**: 角頭の守り、飛車先の突破、大駒の活用、駒の損得、手の価値

**追加候補（7項目）**:
1. 玉の安全度 — 囲いの堅さ、守り駒の数
2. 駒の連結 — 駒同士が守り合っている状態
3. 手番の価値 — 先に動ける有利さ
4. 遊び駒 — 働いていない駒の問題
5. 攻めの拠点 — 相手陣に打ち込んだ歩・駒が攻めの拠点になる
6. 形勢判断 — 駒の損得、玉の安全度、駒の活用度で総合判断
7. と金の価値 — 歩が成ると金と同じ動き、取られても歩の損

### 2.4 tesuji（手筋）

**既存カード（5枚）**: 割り打ちの銀、垂れ歩、端攻め、王手飛車、十字飛車

**追加候補（7項目）**:
1. たたきの歩 — 相手の駒の前に歩を打って動きを制限
2. 底歩 — 一段目に歩を打って飛車の横利きを防ぐ
3. 合駒請求 — 間に駒を打たせて、その駒の種類で有利不利が変わる
4. 頭金 — 玉の頭に金を打って詰ます基本形
5. 田楽刺し — 香車で縦に2枚の駒を貫く
6. 両取り — 1手で2つの駒を同時に狙う
7. ふんどしの桂 — 桂馬で金や飛車と角を同時に狙う

### 2.5 mistake_pattern（初心者の誤り）

**既存カード（5枚）**: 囲い後回し、持ち駒不使用、端歩無視、大駒偏重、受けの軽視

**追加候補（5項目）**:
1. 二歩 — 同じ筋に2枚目の歩を打つ反則（ルール知識）
2. 同じ駒の連続移動 — 1つの駒を何度も動かして手損する
3. 王手の連続 — 王手ばかりかけて攻めが切れる
4. 囲いの形の崩壊 — 自分から囲いの駒を動かしてしまう
5. 終盤の遅い攻め — 詰みや必至がある場面で遠い攻めを選ぶ

---

## 3. Knowledge Card Schema 案

### 3.1 拡張スキーマ

現在の knowledge cards スキーマ（`data/knowledge-cards/`）を拡張した案:

```typescript
interface KnowledgeCard {
  // === 基本情報 ===
  id: string;                    // e.g. "castle-yagura", "tesuji-tarefu"
  kind: CardKind;                // "opening" | "castle" | "concept" | "tesuji" | "mistake_pattern"
  name: string;                  // "矢倉"
  reading: string;               // "やぐら"

  // === 説明 ===
  shortDescription: string;      // 1行（20〜40文字）。辞書UIのプレビューに使用
  longDescription: string;       // 3〜5文。詳細説明。初心者向け言葉遣い

  // === 局面マッチング ===
  triggerRules: TriggerRule[];   // どういう局面特徴でこのカードが選ばれるか
  exampleSfen?: string;          // 代表局面のSFEN（辞書UIで盤面表示に使用）

  // === 盤面アンカー ===
  boardAnchors?: BoardAnchor[];  // 盤面上のどこを見るか（ハイライト用）

  // === 関連 ===
  relatedCardIds: string[];      // 関連カード（e.g. "castle-yagura" → "castle-anaguma"）
  tags: string[];                // 検索用タグ（e.g. ["居飛車", "囲い", "守り"]）

  // === 学習支援 ===
  beginnerTip?: string;          // 初心者向け一言アドバイス
  howToFix?: string;             // mistake_pattern 用: どう直すか
  strengths?: string[];          // castle/opening 用: 長所
  weaknesses?: string[];         // castle/opening 用: 短所
}

// 局面マッチングルール
interface TriggerRule {
  type: "piece_pattern"          // 特定の駒配置パターン
       | "phase"                 // 序盤/中盤/終盤
       | "opening_name"         // 戦型名（SFENパーサーまたは外部判定）
       | "eval_delta"           // 評価値の急変
       | "piece_in_hand"        // 特定の持ち駒がある
       | "king_position";       // 玉が特定の位置にある
  condition: string;             // ルールの条件記述
  // 例: { type: "king_position", condition: "sente_king_file >= 7" }
  // 例: { type: "phase", condition: "opening" }
  // 例: { type: "piece_pattern", condition: "silver_on_77_and_gold_on_67_78" }
}

// 盤面ハイライト
interface BoardAnchor {
  squares: string[];             // ハイライトするマス（e.g. ["7七", "6七", "7八"]）
  label: string;                 // ラベル（e.g. "矢倉の金銀配置"）
}

type CardKind = "opening" | "castle" | "concept" | "tesuji" | "mistake_pattern";
```

### 3.2 現行スキーマとの差分

| フィールド | 現行（data/knowledge-cards/） | 拡張案 | 追加理由 |
|-----------|----------------------------|--------|---------|
| `id` | ✓ | ✓ | — |
| `category` | ✓ | → `kind` に改名 | 型安全のため明示的な名前に |
| `name` | ✓ | ✓ | — |
| `reading` | ✓ | ✓ | — |
| `description` | ✓ | → `shortDescription` + `longDescription` に分割 | 辞書UIのプレビューと詳細ページで使い分け |
| `when_relevant` | ✓ | → `triggerRules` に構造化 | 機械的にマッチング可能にする |
| `beginner_tip` | ✓ | ✓ | — |
| `triggerRules` | なし | **新規** | 局面からカードを自動選択するため |
| `exampleSfen` | なし | **新規** | 辞書UIで盤面を表示するため |
| `boardAnchors` | なし | **新規** | 盤面上のどこを見るか可視化 |
| `relatedCardIds` | なし | **新規** | カード間のナビゲーション |
| `tags` | なし | **新規** | 検索・フィルタリング |

### 3.3 triggerRules の設計例

```json
{
  "id": "castle-yagura",
  "triggerRules": [
    {
      "type": "piece_pattern",
      "condition": "先手: 7七銀・6七金・7八金 が揃っている"
    },
    {
      "type": "phase",
      "condition": "opening"
    },
    {
      "type": "king_position",
      "condition": "先手玉が6九〜7九〜8八あたり"
    }
  ]
}
```

**注意**: triggerRules は現時点では**自然言語記述**。Phase 2以降で機械的にマッチ可能な構造化条件に進化させる。MVP段階ではLLMがtriggerRulesのテキストを読んで「この局面に関連するカードはどれか」を判断する。

---

## 4. click-to-open 辞書UIに必要な情報

### 4.1 最低限必要な項目

解説テキスト中の用語をクリック → 右側に辞書パネルが開く、を実現するために必要な最小情報:

| 項目 | 必要性 | 説明 |
|------|--------|------|
| `name` | 必須 | パネルのタイトル |
| `reading` | 必須 | ふりがな表示 |
| `shortDescription` | 必須 | パネル上部の概要（1行） |
| `longDescription` | 必須 | 詳細説明（パネルの本文） |
| `beginnerTip` | 必須 | 初心者向け一言（パネル下部のハイライト） |

### 4.2 あると良い項目

| 項目 | 用途 |
|------|------|
| `exampleSfen` | パネル内に小さな盤面を表示して「この形です」と見せる |
| `boardAnchors` | 盤面上のどのマスに注目すべきかハイライト |
| `relatedCardIds` | 「関連する用語」リンクでナビゲーション |
| `strengths` / `weaknesses` | 囲いカードで「上からの攻めに強い」等をリスト表示 |
| `tags` | カード一覧ページでのフィルタリング |

### 4.3 盤面表示に必要な情報

辞書パネル内にミニ盤面を表示する場合:

| 情報 | 例 | 用途 |
|------|-----|------|
| `exampleSfen` | `"lnsgkgsnl/..."` | 盤面描画のソース |
| `boardAnchors[].squares` | `["7七", "6七", "7八"]` | 注目マスのハイライト色 |
| `boardAnchors[].label` | `"矢倉の金銀"` | ハイライトの説明 |

### 4.4 UI構成のイメージ

```
┌──────────────────────────┬──────────────────┐
│                          │  📖 矢倉（やぐら） │
│  解説テキスト              │                  │
│                          │  金銀3枚で玉を    │
│  「この局面は[矢倉]の形で │  上部から守る...   │
│   先手が有利です」         │                  │
│                ↑         │  ┌────────────┐  │
│          クリック可能      │  │  ミニ盤面   │  │
│                          │  │  (SFEN描画)  │  │
│                          │  │  ■=注目マス  │  │
│                          │  └────────────┘  │
│                          │                  │
│                          │  💡 初心者向け    │
│                          │  金銀を玉の近くに │
│                          │  集めましょう     │
│                          │                  │
│                          │  関連: 美濃, 穴熊  │
└──────────────────────────┴──────────────────┘
```

---

## 5. 実装の段階案

| Phase | 内容 | 必要データ |
|-------|------|----------|
| **MVP（現在）** | LLMが解説テキスト中で用語を使う際に glossary.json を参照 | `name`, `reading`, `description` |
| **Phase 2** | 解説テキスト中の用語に下線 → ツールチップで短い説明 | `shortDescription`, `beginnerTip` |
| **Phase 3** | クリック → 右パネルに辞書UI + ミニ盤面 | 全フィールド |
| **Phase 4** | 局面から関連カードを自動選択してサジェスト | `triggerRules` の構造化 |

### MVP段階でやること

1. 現行の `data/knowledge-cards/*.json` を維持（現状のスキーマで十分）
2. `data/glossary.json` はbuilderがプロンプトで参照する用語集として引き続き使用
3. 拡張スキーマへの移行は Phase 2 以降

### Phase 2 で移行すべきこと

1. 現行カードに `shortDescription` / `longDescription` を分離追加
2. `triggerRules` を自然言語で追加（機械マッチングは Phase 4）
3. `exampleSfen` を主要カード（囲い5枚）に追加
4. `relatedCardIds` で囲い同士、手筋同士をリンク

---

## 6. カード数の見積もり

| カテゴリ | 現行 | Phase 2 目標 | 最終目標 |
|---------|------|------------|---------|
| opening | 0 | 8 | 15 |
| castle | 5 | 10 | 15 |
| concept | 5 | 12 | 20 |
| tesuji | 5 | 12 | 20 |
| mistake_pattern | 5 | 10 | 15 |
| **合計** | **20** | **52** | **85** |

---

## 未決事項

| # | 質問 | 影響 | 判断者 |
|---|------|------|--------|
| KD1 | 現行カードの `category` を `kind` に改名するか | スキーマの一貫性 | builder |
| KD2 | `triggerRules` をMVPで自然言語のまま入れるか、Phase 2まで待つか | カードの有用性 | 人間 |
| KD3 | `exampleSfen` の盤面をどの程度の精度で用意するか | 辞書UIの品質 | researcher + reviewer |
| KD4 | 辞書UIのPhaseをいつ開始するか | 開発計画 | 人間 |
| KD5 | SKK-JISYO.shogi の用語名リストを参考にして追加カードを作るか | カード網羅性 | 人間 |

---

## Sources

- [shogi-extend (GitHub)](https://github.com/akicho8/shogi-extend)
- [bioshogi (GitHub)](https://github.com/akicho8/bioshogi)
- [SKK-JISYO.shogi (GitHub)](https://github.com/akicho8/SKK-JISYO.shogi)
- [shogi-player (GitHub)](https://github.com/akicho8/shogi-player)
- [SHOGI-EXTEND 共有将棋盤](https://www.shogi-extend.com/share-board)
- [共有将棋盤 使い方](https://www.shogi-extend.com/share-board/help)
- [なんでも棋譜変換](https://www.shogi-extend.com/adapter)
- [将棋の棋譜や局面のフォーマット (Qiita)](https://qiita.com/sunfish-shogi/items/964e139ef3bfd8f738d4)

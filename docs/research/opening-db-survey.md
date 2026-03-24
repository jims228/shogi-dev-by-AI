# 序盤説明DB / 定跡知識ソース / ライセンス整理

> 作成: researcher セッション
> 調査日: 2026-03-24
> 目的: 序盤解説を LLM の一般論に任せず、deterministic な知識ソースで grounding する

---

## 1. 公開されている将棋の戦型/定跡データソース

### 1.1 ソース一覧

| # | ソース名 | URL | データ形式 | 内容 |
|---|---------|-----|----------|------|
| 1 | **Wikibooks 将棋の戦法一覧** | https://ja.wikibooks.org/wiki/将棋の戦法一覧 | Wiki テキスト | 戦法の体系的分類。居飛車/振り飛車の大分類から個別戦法の定跡手順まで |
| 2 | **Wikipedia 将棋の戦法** | https://ja.wikipedia.org/wiki/将棋の戦法 | Wiki テキスト | 戦法の概要説明。居飛車/振り飛車/その他の分類 |
| 3 | **Wikipedia 将棋用語一覧** | https://ja.wikipedia.org/wiki/将棋用語一覧 | Wiki テキスト | 用語の網羅的リスト |
| 4 | **やねうら王 定跡DB** | standard_book.db（ローカル） | 独自バイナリ | SFEN + 手 + 評価値。手順ベースの定跡。説明テキストなし |
| 5 | **Floodgate 棋譜** | wdoor.c.u-tokyo.ac.jp/shogi/ | CSA 形式 | コンピュータ対局棋譜。序盤手順を抽出可能。説明なし |
| 6 | **lishogi** | https://lishogi.org/ (AGPL) | Scala/MongoDB | プロ棋譜opening explorer。API (WIP) あり |
| 7 | **将棋DB2** | https://shogidb2.com/ | Web | プロ棋譜データベース。非商用利用可。APIなし |
| 8 | **SKK-JISYO.shogi** | https://github.com/akicho8/SKK-JISYO.shogi | テキスト辞書 | 将棋用語の読み→表記マッピング。戦法名リスト付き |
| 9 | **shogi.cloud** | https://www.shogi.cloud/en/openings-joseki-joban/ | Web | 英語の戦型解説。初心者向け |
| 10 | **各種ブログ** | (日々頓死、ゼロから始める将棋研究所 等) | Web記事 | 戦法解説。著作権あり |

### 1.2 説明テキストの有無

| ソース | 手順データ | 説明テキスト | 構造化度 |
|--------|----------|------------|---------|
| Wikibooks | あり（手順記載） | **あり**（日本語解説） | 中（Wikiマークアップ） |
| Wikipedia | 概要のみ | **あり**（概要説明） | 中 |
| やねうら王 book | **あり**（SFEN+手+eval） | なし | **高**（バイナリDB） |
| Floodgate | **あり**（CSA棋譜） | なし | 高（CSA形式） |
| lishogi | **あり**（棋譜DB） | なし | 高（API） |
| SKK-JISYO | なし（用語名のみ） | なし | 高（辞書形式） |

**事実**: 「手順データ」と「説明テキスト」の両方を持つ公開ソースは Wikibooks/Wikipedia のみ。
**解釈**: 手順は機械的に取得できるが、「なぜその手順か」の説明は人手で書くか、LLMで生成するかの二択。

---

## 2. ライセンスと再利用可否

| ソース | ライセンス | テキスト引用 | 構造/概念の参考 | 注意点 |
|--------|----------|------------|---------------|--------|
| **Wikibooks** | CC BY-SA 3.0 | **可**（帰属表示+SA） | 可 | 改変物も CC BY-SA にする必要あり |
| **Wikipedia** | CC BY-SA 4.0 | **可**（帰属表示+SA） | 可 | 同上 |
| **やねうら王 book** | GPL（カスタムbook） | N/A（テキストなし） | **可**（フォーマット参考） | bookファイル自体をGPLで配布する場合に注意 |
| **Floodgate** | パブリック（制限なし） | N/A（棋譜データ） | 可 | コンピュータ同士の対局 |
| **lishogi** | AGPL-3.0（コード） | N/A | 可（設計概念） | コード利用はAGPL準拠が必要 |
| **将棋DB2** | 非商用利用可 | 棋譜参照のみ | 可 | 商用利用時は要確認 |
| **SKK-JISYO** | CC BY-SA 2.1 JP | **可**（帰属表示+SA） | 可 | 用語名リスト程度の参照は問題なし |
| **ブログ記事** | All rights reserved | **不可** | 概念のみ可 | 文章のコピーは禁止 |

### 再利用の方針

1. **Wikibooks/Wikipedia**: 戦法名・概要の「事実情報」は引用可能（帰属表示必須）。ただし解説文の丸コピーではなく、knowledge card として独自に再構成する
2. **やねうら王 book**: フォーマット（SFEN + 手 + eval）を参考にするのは問題なし。bookデータ自体の同梱はGPL汚染に注意
3. **各種ブログ**: テキストのコピーは不可。「角換わりとは〜」のような事実記述は独自に書き直す

---

## 3. 構造化DBに落としやすいソース

### 3.1 最も構造化しやすい: やねうら王 定跡DB

```
フォーマット: #YANEURAOU-DB2016 1.00
各行: sfen手順 手 次の手 評価値 深さ 勝率
```

**利点**: SFEN（局面）→ 推奨手 → 評価値 の3つ組が直接取得できる
**限界**: 説明テキストがない。「なぜこの手順か」は別途用意が必要
**用途**: triggerRules の condition 検証に使える（特定のSFENパターンにマッチするか）

### 3.2 次に構造化しやすい: 戦型分類の木構造

Wikibooks + Wikipedia + 各種解説から抽出できる分類木:

```
将棋の戦型
├── 相居飛車
│   ├── 角換わり
│   │   ├── 角換わり腰掛銀
│   │   ├── 角換わり棒銀
│   │   └── 角換わり早繰り銀
│   ├── 相掛かり
│   │   ├── 棒銀
│   │   └── 腰掛銀
│   ├── 矢倉
│   │   ├── 急戦矢倉
│   │   └── 持久戦矢倉
│   └── 横歩取り
│       ├── △3三角戦法
│       └── △4五角戦法
├── 対抗形（居飛車 vs 振り飛車）
│   ├── vs 四間飛車
│   │   ├── 急戦（舟囲い）
│   │   └── 持久戦（穴熊）
│   ├── vs 三間飛車
│   ├── vs 中飛車
│   └── vs 向かい飛車
├── 振り飛車
│   ├── ノーマル振り飛車
│   │   ├── 四間飛車
│   │   ├── 三間飛車
│   │   └── 中飛車
│   └── 角交換振り飛車
│       ├── ゴキゲン中飛車
│       └── 角交換四間飛車
└── 相振り飛車
    ├── 三間 vs 四間
    └── 中飛車 vs 三間
```

**この木構造自体は事実情報**であり、著作権の対象外。独自にJSON化できる。

### 3.3 構造化が難しい: 定跡の「解説テキスト」

「角換わりでは、序盤に角を交換して持ち駒にし…」のような解説文は:
- ブログからコピー → 著作権侵害
- Wikibooks から引用 → CC BY-SA 遵守が必要
- LLM で生成 → 正確性の保証が必要
- **独自に書く → 最もクリーン**だが工数がかかる

**提案**: knowledge card の `shortDescription` / `longDescription` は独自に書く。事実情報（分類、手順）はWikibooks/Wikipediaを参考にしつつ、文面は自分で書き直す。

---

## 4. 初期 MVP 向け Opening Card Schema

### 4.1 提案スキーマ

既存の knowledge card スキーマ（`data/knowledge-cards/`）を拡張:

```typescript
interface OpeningCard {
  id: string;                    // "opening-kakugawari"
  kind: "opening";
  name: string;                  // "角換わり"
  reading: string;               // "かくがわり"
  parentId: string | null;       // "opening-aiibishya" (親カテゴリ)

  // 説明
  shortDescription: string;      // 1行（UI プレビュー用）
  longDescription: string;       // 初心者向け3-5文
  beginnerTip: string;           // 一言アドバイス

  // 序盤判定
  triggerMoves: string[];        // この戦型に入る典型的な手順（SFEN形式）
                                 // 例: ["7g7f", "8c8d", "2g2f", "8d8e", "2f2e"]
  triggerConditions: string[];   // 自然言語の判定条件
                                 // 例: ["両者が角道を開けている", "飛車先の歩を突いている"]

  // 代表局面
  exampleSfen?: string;          // この戦型の代表的な局面

  // 関連概念
  relatedCastles: string[];      // 関連する囲い ["castle-yagura"]
  relatedConcepts: string[];     // 関連する概念 ["concept-kakuatama"]
  relatedCardIds: string[];      // その他の関連カード

  tags: string[];                // ["相居飛車", "角交換", "急戦向き"]
}
```

### 4.2 既存 castle card との違い

| フィールド | castle card | opening card |
|-----------|-------------|-------------|
| `parentId` | なし | あり（分類木のため） |
| `triggerMoves` | なし | **あり**（序盤手順でマッチ） |
| `relatedCastles` | なし | **あり**（この戦型で使う囲い） |
| `strengths/weaknesses` | あり | なし（戦型全体の良し悪しは単純に言えない） |

---

## 5. 初期 Opening Cards 案（序盤局面で役立つ最小カード群）

### 5.1 ケース別に必要なカード

調査対象の序盤概念と、それをカバーするカード:

| 序盤概念 | 必要なカード | 説明 |
|---------|------------|------|
| 角換わり含み | `opening-kakugawari` | 角道を開け合った後、角交換が起きる可能性のある局面 |
| 居飛車含み | `opening-ibisha` | 飛車を2筋に据えて戦う大分類 |
| 右銀活用 | `concept-migi-gin` | 右銀（3七や4六）を攻めに使う考え方 |
| 角頭ケア | `concept-kakuatama`（既存） | 角の頭（8七/2三）を守る重要性 |
| 飛車先の歩 | `concept-hishasakitoppa`（既存） | 飛車先の歩を突いて攻める基本 |

### 5.2 提案する初期 Opening Cards（8枚）

```
1. opening-ibisha        居飛車（大分類）
2. opening-furibisha     振り飛車（大分類）
3. opening-aiibishya     相居飛車（大分類）
4. opening-taikougata    対抗形（大分類）
5. opening-kakugawari    角換わり
6. opening-aigakari      相掛かり
7. opening-yagura-senpo  矢倉戦法
8. opening-shikenbisha   四間飛車
```

### 5.3 追加すべき概念カード（3枚）

既存の概念カード（角頭の守り、飛車先の突破）に加えて:

```
9.  concept-migi-gin      右銀の活用
10. concept-kakumichi      角道（角が利く斜めの筋）
11. concept-senkata-sentaku 戦型選択（序盤の方針決定）
```

### 5.4 合計: 初期11枚で序盤の主要概念をカバー

| 種別 | 枚数 | カバー範囲 |
|------|------|----------|
| opening（大分類） | 4 | 居飛車/振り飛車/相居飛車/対抗形 |
| opening（具体戦型） | 4 | 角換わり/相掛かり/矢倉/四間飛車 |
| concept（新規） | 3 | 右銀/角道/戦型選択 |
| **合計** | **11** | |

---

## 6. 実装の段階

| Phase | 内容 | データソース |
|-------|------|-----------|
| **MVP（現在）** | 既存カード（castle 5, tesuji 5, concept 5, mistake 5 = 20枚）で運用 | 独自作成 |
| **Phase 2a** | opening cards 8枚 + concept 3枚を追加（計31枚） | 分類木はWikibooks参考、テキストは独自 |
| **Phase 2b** | triggerMoves/triggerConditions を追加し、局面から自動選択 | やねうら王 book 参考 |
| **Phase 3** | 個別戦型の深い解説（角換わり腰掛銀、等）を追加 | 独自作成 |

---

## 7. やねうら王 book を活用した序盤判定の案

### 7.1 構想

やねうら王の定跡DB（standard_book.db）は「SFEN → 推奨手 → 評価値」の構造。この手順パターンを使って、ユーザーの棋譜が「どの戦型に入っているか」を判定できる可能性がある。

```
ユーザーの手順: ▲7六歩 △3四歩 ▲2六歩 △8四歩 ▲2五歩
    ↓
定跡DB照合: この手順は「相掛かり」の定跡に一致
    ↓
opening card: "opening-aigakari" を選択
    ↓
プロンプトに注入: 「この局面は相掛かりの序盤です。飛車先の歩を互いに突き合う展開で...」
```

### 7.2 実装上の注意

- standard_book.db はバイナリ形式。パースにはやねうら王のコードを参照する必要があるが、clean-room原則のため独自パーサーが必要
- **代替案**: 主要な戦型の「最初の5-10手の手順パターン」を手動でJSONに起こす。bookファイルのパースは不要
- 手動パターンは正確性に限界があるが、MVP段階では十分

### 7.3 手動パターンの例

```json
{
  "opening-kakugawari": {
    "trigger_sequences": [
      ["7g7f", "8c8d", "2g2f", "3c3d", "7f7e"],
      ["7g7f", "3c3d", "2g2f", "8c8d", "2f2e", "8d8e", "7f7e"]
    ],
    "trigger_description": "両者が角道を開け、角交換が成立する手順"
  }
}
```

---

## 未決事項

| # | 質問 | 影響 | 判断者 |
|---|------|------|--------|
| OD1 | opening cards を Phase 2a で追加するか | カード数の増加 | 人間 |
| OD2 | Wikibooks のテキストを CC BY-SA で引用するか、完全独自で書くか | ライセンス管理の手間 | 人間 |
| OD3 | やねうら王 book のパースを実装するか、手動パターンで済ますか | 序盤判定の精度 vs 工数 | 人間 + builder |
| OD4 | opening card の triggerMoves は SFEN 形式か日本語形式か | パーサーとの連携 | builder |

---

## Sources

- [Wikibooks 将棋の戦法一覧](https://ja.wikibooks.org/wiki/将棋の戦法一覧)
- [Wikipedia 将棋の戦法](https://ja.wikipedia.org/wiki/将棋の戦法)
- [Wikipedia 将棋用語一覧](https://ja.wikipedia.org/wiki/将棋用語一覧)
- [やねうら王 定跡フォーマット提案](https://yaneuraou.yaneu.com/2016/02/05/standard-shogi-book-format/)
- [やねうら王 定跡の作成](https://github.com/yaneurao/YaneuraOu/wiki/定跡の作成)
- [lishogi (GitHub)](https://github.com/WandererXII/lishogi)
- [lishogi API reference](https://lishogi.org/api)
- [SKK-JISYO.shogi (GitHub)](https://github.com/akicho8/SKK-JISYO.shogi)
- [shogi.cloud Openings & Joseki](https://www.shogi.cloud/en/openings-joseki-joban/)
- [日々頓死 戦法一覧](https://hibitonshi.com/2019-02-25-203000/)
- [ゼロから始める将棋研究所 戦法一覧](https://shogi-joutatsu.com/archives/category/sempou)
- [将棋講座ドットコム 居飛車と振り飛車](https://xn--pet04dr1n5x9a.com/初級編/居飛車と振り飛車について.html)
- [Gnu Shogi Database](https://japanesechess.org/gsdb/)

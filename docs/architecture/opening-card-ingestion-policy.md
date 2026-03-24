# Opening Card Ingestion Policy

> 作成: researcher セッション
> 作成日: 2026-03-24
> 目的: 外部ソースから opening card を作成する際のルールを定義する

---

## 1. Ingestion モード

各カードのデータには、どのように取得・加工したかを `ingestionMode` で明示する。

| モード | 定義 | 例 |
|--------|------|-----|
| `copied` | 元データをそのまま保持。分類名、手順、局面条件など事実情報 | 戦型名「角換わり」、手順 `7g7f 3c3d` |
| `excerpted` | 元データから一部を抜粋。文意を変えない | 定跡手順の一部を抜粋 |
| `adapted` | 元データを参考に、初心者向けにリライト・要約 | 概要説明文を短く書き直し |
| `original` | 外部ソースを参照せず独自に作成 | coachAngle、beginnerTip |

## 2. そのまま保持してよいもの（A群）

以下は事実情報であり、そのまま保持する:
- 戦型名（角換わり、相掛かり、矢倉 等）
- 分類木（居飛車→角換わり→腰掛銀 等の階層構造）
- 代表手順（USI形式の手順: `7g7f`, `3c3d` 等）
- 局面条件（「角道が開いている」「飛車が2筋にいる」等）
- SFEN文字列

## 3. 要約・リライトしてカードに落とすもの（B群）

以下は元テキストをそのまま使わず、初心者向けにリライトする:
- 概要説明文 → `shortDescription`, `longDescription`
- 学習ポイント → `coachAngle`, `beginnerTip`
- 注意点 → `caution`

リライトの原則:
- 初心者（ウォーズ5級〜3級）が読んで分かる言葉遣い
- 1文は50文字以内を目安
- 専門用語には補足をつける

## 4. 必ず残すメタデータ（C群）

すべてのカードに `sourceRefs` 配列を持たせ、各参照元ごとに以下を記録:

```json
{
  "sourceRepo": "リポジトリ名またはURL",
  "sourcePath": "参照したファイルのパス",
  "ingestionMode": "copied | excerpted | adapted | original",
  "permissionNote": "許可の状況"
}
```

- 独自作成のカードでも `sourceRefs` を空配列 `[]` で持つ
- 複数ソースを参考にした場合は複数エントリを持つ

## 5. ライセンス別の取り扱い

| ソース | ライセンス | 取り扱い |
|--------|----------|---------|
| 作者許可取得済みリポジトリ | 個別許可 | A/B/C すべて可。`permissionNote` に許可日を記載 |
| Wikibooks | CC BY-SA 3.0 | A群は可。B群はリライトして adapted。帰属表示必須 |
| Wikipedia | CC BY-SA 4.0 | 同上 |
| やねうら王 book | GPL | フォーマット参考は可。データ同梱はGPL準拠 |
| ブログ記事 | All rights reserved | A群（事実情報）のみ。テキストコピー不可 |

## 6. カード ID の命名規則

- 英語で、見て意味が分かるIDにする
- `opening-` プレフィックス: 戦型・序盤概念
- `concept-` プレフィックス: 将棋の一般概念
- ハイフン区切り、小文字
- 日本語のローマ字読みは避ける（`opening-aigomisha` ×）
- 良い例: `opening-static-rook`, `opening-right-silver`, `concept-bishop-head`
- 悪い例: `opening-ibisha`, `opening-kakugawari-fukumi`

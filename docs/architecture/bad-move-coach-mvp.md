# Bad Move Coach — MVP設計

> 作成: context-manager（orchestrator指示に基づく）
> 日付: 2026-03-24
> 前提: DEC-014（plan-first パイプライン）、ユーザーニーズ分析（§1.2, §1.3, §1.5）
> ステータス: 設計ドキュメント。人間承認後に実装へ進む

---

## 1. コンセプト

**「あなたのこの手がなぜ悪かったのか」を、初心者に具体的に説明する。**

既存ツール（棋神解析、ぴよ将棋）は「何が最善手か」を示すが、「なぜあなたの手が悪かったか」は説明しない。
Bad Move Coach は、ユーザーが指した手と最善手を比較し、差が生まれた因果関係を初心者向けに言語化する。

DEC-014 の差別化:「将棋を説明するAI」ではなく「**自分の悪手の理由と次の見方を教えるAI**」

---

## 2. 現在のパイプラインとの関係

```
現在（局面解説）:
  SFEN → Canonicalize → Engine Lookup → Planner → Verbalizer → Verifier

Bad Move Coach（悪手レビュー）:
  SFEN + ユーザーの手 + 最善手
    → Canonicalize（手の前後2局面）
    → Engine Lookup（both positions）
    → MistakeReviewPlanner（新規）
    → Verbalizer（既存を拡張）
    → Verifier（既存を拡張）
```

**差分**: MistakeReviewPlanner が新規。既存の Planner/Verbalizer/Verifier を拡張する形で実装する。

---

## 3. 入力

| フィールド | 型 | 説明 |
|-----------|-----|------|
| sfen | string | ユーザーの手を指す**前**の局面（SFEN） |
| userMove | string | ユーザーが実際に指した手（USI形式） |
| bestMove | string | エンジンが推奨する最善手（USI形式） |
| engineData? | EngineData | 事前計算データ（あれば） |

---

## 4. MVPの体験フロー

1. ユーザーがKIF/SFENを貼り付ける
2. **レビュー対象の1手を選ぶ**（MVP: ユーザーが手動で選択する。局面ナビゲーションの◀▶で手を進め、「この手をレビュー」ボタンを押す。将来: 転換点自動検出）
3. システムが userMove と bestMove を比較し、差の因果を分析
4. 初心者向けの「悪手レビュー」を生成・表示:
   - あなたの手: ○○（評価値がこう変わった）
   - 最善手: ○○（こうすればこうなった）
   - なぜ差がついたか（因果の言語化）
   - 次に同じ局面が来たら何を見るか（学びのポイント）

---

## 5. 出力: MistakeReviewPlan

→ 詳細は `docs/architecture/mistake-review-plan.md` を参照

---

## 6. Verbalizerへの要求

既存の局面解説 Verbalizer を拡張し、MistakeReviewPlan を入力として受け取れるようにする。

テンプレート構造（Verbalizer が生成すべき解説の構成）:

```
1. あなたの手: [reviewedMove.ja]
   → [reviewedMove.evalExpression]

2. より良い手: [betterMove.ja]
   → [betterMove.evalExpression]

3. なぜ差がついたか:
   [causalChain の言語化]

4. 次に同じような局面が来たら:
   [nextLookFor]
```

---

## 7. Verifierへの追加チェック

| チェック項目 | 方法 |
|------------|------|
| reviewedMove が出力に言及されているか | 文字列マッチ |
| betterMove が出力に言及されているか | 文字列マッチ |
| causalChain の要素が1つ以上出力に反映されているか | キーワードマッチ |
| 評価値の数字が直接出力されていないか | 既存チェック |
| forbiddenClaims 違反がないか | 既存チェック |

---

## 8. 成功条件

- ユーザーが「なぜ自分の手が悪かったのか」を理解できる
- 因果関係が具体的（「角頭が弱くなる」等）で、抽象的でない（「形勢が悪くなる」は不可）
- 最善手との差がポイント数ではなく概念で説明されている
- 初心者が知らない用語には補足がある
- 読み終わった後、ユーザーが「次に何を見るか」を1つ言い返せる水準の具体性がある

---

## 9. スコープ（MVP / 将来）

| 機能 | MVP | 将来 |
|------|-----|------|
| ユーザーが手動で1手を選択 | Yes | — |
| 転換点の自動検出 | — | Yes |
| 複数の悪手をまとめてレビュー | — | Yes |
| 悪手パターンの蓄積・傾向分析 | — | Yes |
| 知識カードとの連携 | — | Yes（keyTerms 経由） |
| click-to-open 辞書 | — | Yes |

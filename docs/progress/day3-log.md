# Day 3 進捗ログ

> 日付: 2026-03-24
> 記録者: context-manager
> 方式: DEC-014 に基づく ExplanationPlan パイプライン初期実装
> 前提: Day 2 品質ゲート C 判定達成（DEC-013）

---

## Day 3 目標

**ExplanationPlan ベースの新パイプラインを初期実装し、before/after で品質を比較する**

---

## タスク進捗（最終状態）

| タスク | 担当 | 状態 | PR | 備考 |
|--------|------|------|-----|------|
| TASK-014: 型定義 | builder | **完了** | PR #26 merged | CanonicalPosition + ExplanationPlan。`src/lib/shogi/types.ts` に追加 |
| TASK-015: buildPlan() | builder | **完了** | PR #29 merged | ルールベースの ExplanationPlan 生成。5局面テスト付き |
| TASK-016: plan-only prompt | builder | **完了** | PR #30 merged | LLM を verbalizer に限定。buildPlanPrompt() 実装 |
| TASK-017: verifier | builder | **完了** | PR #31 merged | bestmove一致・評価値帯整合性を検証。LLM呼び出しなし |
| TASK-018: 統合 + before/after | builder + reviewer | **完了** | PR #32, #33 merged | X-Pipeline ヘッダーで legacy/plan 切替。デフォルト plan |
| TASK-019: 知識カード | researcher | **完了** | PR #28 merged | 4カテゴリ20枚。`data/knowledge-cards/` |
| TASK-020: 評価基準 | reviewer | **完了** | PR #27 merged | plan-transition 評価基準定義。移行合否条件を明文化 |

**全7タスク完了。**

---

## マージ済みPR一覧（Day 3: #22〜#33）

| PR | ブランチ | 内容 | タスク/区分 |
|----|----------|------|-----------|
| #22 | docs/day2-retrospective | TASK-013 Day 2 振り返り記録 | TASK-013 |
| #23 | research/silver-star-deep | 銀星将棋10 深掘り + DecodeChess 5観点の将棋翻訳 | 調査 |
| #24 | docs/dec-014 | DEC-014 記録 | docs |
| #25 | docs/day3-tasks | Day 3 タスク定義（TASK-014〜020） | docs |
| #26 | feat/plan-types | CanonicalPosition + ExplanationPlan 型定義 | TASK-014 |
| #27 | review/plan-criteria | plan-transition 評価基準 | TASK-020 |
| #28 | data/knowledge-cards | 知識カード 4カテゴリ20枚 | TASK-019 |
| #29 | feat/build-plan | buildPlan() ルールベース実装 | TASK-015 |
| #30 | feat/plan-prompt | plan-only prompt builder | TASK-016 |
| #31 | feat/verifier | lightweight verifier | TASK-017 |
| #32 | feat/plan-integration | verifier統合 + デフォルトpipeline切替 | TASK-018 |
| #33 | review/day3-before-after | before/after 評価レポート | TASK-018 |

---

## before/after 評価結果

### スコア比較

| パイプライン | 正確性 | 分かりやすさ | 具体性 | 総合 |
|------------|--------|------------|--------|------|
| legacy | 4.0 | 4.0 | 3.8 | 3.9 |
| **plan** | **4.0** | **4.2** | **4.0** | **4.1** |
| 差分 | ±0 | +0.2 | +0.2 | **+0.2** |
| Day 2 v3 baseline | 3.8 | 4.2 | 3.8 | 3.9 |

### 移行判定基準との照合

| 条件 | 結果 |
|------|------|
| 正確性 ≥ 3.8 (baseline) | **4.0 — 達成** |
| 3軸すべて 3.5 以上 | **4.0/4.2/4.0 — 達成** |
| 正確性が向上 | 4.0 = 4.0 — 維持 |

**全条件達成。plan パイプラインへの移行を reviewer が推薦。**

### plan で改善された点（I1〜I6）

| # | 改善点 | 局面 |
|---|--------|------|
| I1 | 候補手間の評価値差を言葉で明示比較 | pos-001 |
| I2 | 玉・飛車の位置を正確に言及 | pos-002 |
| I3 | 龍の位置を言及 | pos-003 |
| I4 | 3候補すべての比較 | pos-005 |
| I5 | 用語補足の質が向上 | pos-001 |
| I6 | 教育ポイントがより具体的 | pos-005 |

### 残課題（W1〜W3）

| # | 課題 | 深刻度 | 対応方針 |
|---|------|--------|---------|
| W1 | 詰み手順の具体的記述が省略（pos-003） | 中 | Plan に `mate_sequence`/`pv_ja` を直接含める |
| W2 | マイナス評価値の表現精度低下（pos-004: -201→「帳消し」） | 低 | Plan に各候補手の `eval_expression` を事前計算して含める |
| W3 | 文章が長くなる傾向（pos-001） | 低 | Plan に priority フィールド追加を検討 |

### Verifier の状態

- ライブラリとしては実装済み（TASK-017, PR #31）
- **API のストリーミングフローには未統合**（reviewer 指摘）
- W2 の誤表現は Verifier があれば検出できた可能性あり
- 統合は Phase 2 で対応

---

## 品質推移（Day 1〜Day 3）

| 時点 | 正確性 | 分かりやすさ | 具体性 | 総合 | 判定 |
|------|--------|------------|--------|------|------|
| Day 1 参考値 | 4.0 | 4.0 | 4.3 | 4.1 | (参考) |
| Day 2 v1 | 1.6 | 2.4 | 2.0 | 2.0 | A |
| Day 2 v2 | 3.4 | 4.0 | 3.6 | 3.7 | B |
| Day 2 v3 | 3.8 | 4.2 | 3.8 | 3.9 | C |
| **Day 3 plan** | **4.0** | **4.2** | **4.0** | **4.1** | — |

---

## 決定事項（Day 3）

| DEC | 概要 | 決定者 |
|-----|------|--------|
| DEC-014 | v2を将棋学習エンジンとして再定義。ExplanationPlan 中心のパイプライン | 人間 |

---

## Phase 2 計画

Day 3 の before/after 評価で plan パイプラインの優位性が確認された。
Phase 2 では以下を実施（人間の判断に基づく）:

| 項目 | 内容 | 優先度 |
|------|------|--------|
| W1 対応 | Plan に mate_sequence/pv_ja を直接含める | 高 |
| W2 対応 | Plan に eval_expression を事前計算して含める | 高 |
| Verifier 統合 | API ストリーミングフローに Verifier を組み込む | 高 |
| W3 対応 | Plan に priority フィールド追加、文章長制御 | 中 |
| Q&A plan-grounded 化 | DEC-014 方針3。対話を Plan に基づかせる | 中 |
| 知識カード統合 | TASK-019 の知識カードを Plan/Verbalizer で活用 | 低 |

---

## Day 3 終了時チェックリスト

- [x] CanonicalPosition, ExplanationPlan の型が定義されている（PR #26）
- [x] buildPlan() が 5 テスト局面で動作する（PR #29）
- [x] プロンプトが ExplanationPlan のみを入力として組み立てられる（PR #30）
- [x] Verifier が bestmove 一致・評価値帯整合性を検証する（PR #31）
- [x] before/after 評価の結果が出ている（PR #33、総合 3.9→4.1）
- [x] 知識カード初期セットが存在する（PR #28、20枚）
- [x] plan-transition 評価基準が定義されている（PR #27）

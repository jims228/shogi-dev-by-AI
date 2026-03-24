# Day 3 進捗ログ（最終版）

> 日付: 2026-03-24
> 記録者: context-manager
> 方式: DEC-014 に基づく ExplanationPlan パイプライン初期実装
> 前提: Day 2 品質ゲート C 判定達成（DEC-013）
> ステータス: **Day 3 完了。review mode の人間監査を経て再設計方針確定（DEC-015）**

---

## Day 3 目標

**ExplanationPlan ベースの新パイプラインを初期実装し、before/after で品質を比較する**

---

## タスク進捗（最終状態）

### Phase 1: plan パイプライン（TASK-014〜020）

| タスク | 担当 | 状態 | PR | 備考 |
|--------|------|------|-----|------|
| TASK-014: 型定義 | builder | **完了** | PR #26 | CanonicalPosition + ExplanationPlan |
| TASK-015: buildPlan() | builder | **完了** | PR #29 | ルールベース。5局面テスト付き |
| TASK-016: plan-only prompt | builder | **完了** | PR #30 | LLM を verbalizer に限定 |
| TASK-017: verifier | builder | **完了** | PR #31 | bestmove一致・評価値帯整合性 |
| TASK-018: 統合 + before/after | builder + reviewer | **完了** | PR #32, #33 | plan 4.1達成 |
| TASK-019: 知識カード | researcher | **完了** | PR #28 | 4カテゴリ20枚 |
| TASK-020: 評価基準 | reviewer | **完了** | PR #27 | plan-transition criteria |

### Phase 1.5: Trust Gate + W1/W2 修正

| 項目 | 状態 | PR | 備考 |
|------|------|-----|------|
| W1: mate sequence 修正 | **完了** | PR #35 | plan に詰み手順を含める |
| W2: eval expression 修正 | **完了** | PR #37 | 評価値を言語化して渡す |
| W1/W2 検証 | **完了** | PR #38 | reviewer 確認済み |
| king safety 設計 | **完了** | PR #36 | 玉安全度計算の設計メモ |
| feature extraction | **完了** | PR #39 | kingSafety, materialBalance, attackMap |
| Trust Gate 実装 | **完了** | PR #40 | 合法手検証 + verify-before-display + truncation guard |
| Trust Gate 検証 | **完了** | PR #41 | reviewer による統合確認 |
| T1/T2 修正 | **完了** | PR #42 | forbiddenClaims座標修正 + fallback表示修正 |
| engine data lookup | **完了** | PR #43 | 事前計算局面のルックアップ |
| verifier strictness 緩和 | **完了** | PR #45 | false-negative fallback を削減 |

### Phase 2: Bad Move Coach

| 項目 | 状態 | PR | 備考 |
|------|------|-----|------|
| Bad Move Coach 設計 | **完了** | PR #49 | MVP設計 + MistakeReviewPlan spec |
| MistakeReviewPlan 中核ライブラリ | **完了** | PR #50 | WhyChain, ContextWindow, mistake-planner |
| /api/review-move API | **完了** | PR #51 | verify-before-display + fallback |
| 「この手をレビュー」ボタン | **完了** | PR #53 | フロントエンドUI |
| 人間レビュー用トレース収集 | **完了** | PR #54 | 5ケースの出力記録 |
| review mode 再設計方針 | **完了** | PR #56 | 3レーン制 + P0〜P3 優先度 |

### 現在のタスク状態

| タスク | 担当 | 状態 | 備考 |
|--------|------|------|------|
| P0: reviewedMove grounding fix | builder | **作業中** | 駒種特定・合法性の修正 |
| opening cards 設計 | researcher | **並行作業中** | 定跡DBの調査・スキーマ設計 |
| P1: mate局面PV主役化 | builder | 待ち | P0 完了後 |
| P2: opening レーン | builder | 待ち | P1 + opening cards 完了後 |
| P3: template-first 化 | builder | 待ち | P2 完了後 |

---

## マージ済みPR一覧（Day 3: #22〜#56）

### plan パイプライン（#22〜#33）

| PR | ブランチ | 内容 | 区分 |
|----|----------|------|------|
| #22 | docs/day2-retrospective | Day 2 振り返り記録 | TASK-013 |
| #23 | research/silver-star-deep | 銀星将棋10 深掘り | 調査 |
| #24 | docs/dec-014 | DEC-014 記録 | docs |
| #25 | docs/day3-tasks | Day 3 タスク定義 | docs |
| #26 | feat/plan-types | CanonicalPosition + ExplanationPlan 型定義 | TASK-014 |
| #27 | review/plan-criteria | plan-transition 評価基準 | TASK-020 |
| #28 | data/knowledge-cards | 知識カード 4カテゴリ20枚 | TASK-019 |
| #29 | feat/build-plan | buildPlan() ルールベース実装 | TASK-015 |
| #30 | feat/plan-prompt | plan-only prompt builder | TASK-016 |
| #31 | feat/verifier | lightweight verifier | TASK-017 |
| #32 | feat/plan-integration | verifier統合 + デフォルト切替 | TASK-018 |
| #33 | review/day3-before-after | before/after 評価レポート | TASK-018 |

### Trust Gate + W1/W2 + feature extraction（#34〜#45）

| PR | ブランチ | 内容 | 区分 |
|----|----------|------|------|
| #34 | docs/day3-progress | Day 3 進捗ログ | docs |
| #35 | fix/plan-mate-sequence | mate sequence を plan に含める | W1 |
| #36 | research/king-safety | 玉安全度の設計メモ | 調査 |
| #37 | fix/plan-eval-verbal | 評価値を言語化して渡す | W2 |
| #38 | review/w1w2-verify | W1/W2 修正検証 | レビュー |
| #39 | feat/feature-extraction | kingSafety, materialBalance, attackMap | 機能 |
| #40 | fix/trust-gate | 合法手検証 + verify-before-display + truncation guard | Trust Gate |
| #41 | review/trust-gate-verify | Trust Gate 検証 | レビュー |
| #42 | fix/trust-gate-t1t2 | forbiddenClaims座標 + fallback表示 | Trust Gate 修正 |
| #43 | fix/engine-data-lookup | 事前計算局面のルックアップ | 機能 |
| #44 | docs/cleanup | docs整理 + index + CLAUDE.md更新 | docs |
| #45 | fix/verifier-strictness | verifier strictness 緩和 | Trust Gate 調整 |

### Bad Move Coach + 調査 + マーケティング（#46〜#56）

| PR | ブランチ | 内容 | 区分 |
|----|----------|------|------|
| #46 | docs/knowledge-db-prereqs | 知識DB導入の前提整理 | docs |
| #47 | research/knowledge-db | 知識DB設計リサーチ | 調査 |
| #48 | research/user-needs | ユーザーニーズ分析 | 調査 |
| #49 | docs/bad-move-coach | Bad Move Coach MVP設計 | docs |
| #50 | feat/mistake-review-plan | MistakeReviewPlan 中核ライブラリ | 実装 |
| #51 | feat/review-api | /api/review-move API | 実装 |
| #52 | marketing/initial-strategy | 初期マーケティング戦略 | マーケティング |
| #53 | feat/review-ui | 「この手をレビュー」ボタン | 実装 |
| #54 | audit/review-trace | review-move 5ケーストレース | 監査 |
| #55 | research/opening-db-survey | 定跡DB調査 | 調査 |
| #56 | docs/review-redesign | review mode 再設計方針 | docs |

---

## before/after 評価結果（plan パイプライン）

| パイプライン | 正確性 | 分かりやすさ | 具体性 | 総合 |
|------------|--------|------------|--------|------|
| legacy | 4.0 | 4.0 | 3.8 | 3.9 |
| **plan** | **4.0** | **4.2** | **4.0** | **4.1** |
| 差分 | ±0 | +0.2 | +0.2 | **+0.2** |

---

## 人間レビュー: review mode 5ケース監査

### 結果サマリー

| case | 局面 | 判定 | 問題 |
|------|------|------|------|
| 1 | 序盤 ▲3八銀 vs ▲7八金 | **NG** | 「囲いの準備」断定。戦型留保なし |
| 2 | 序盤 ▲2六歩 vs ▲7八金 | 概ねOK | 「居飛車宣言」が適切な文脈 |
| 3 | 序盤 ▲5八玉 vs ▲7八金 | **NG** | 角交換後の含み・角打ち筋ケアの文脈欠落 |
| 4 | 中盤 8h6f vs ▲2四歩打 | **最悪** | 玉を空きマス扱い、角の手を「6六飛」 |
| 5 | 終盤 R*5b vs ▲5一飛打 | 方向OK | 3手詰み手順を出すべき |

### 3つの根本問題

1. **エンジンPVが主役になっていない** — 「なぜ差がつくか」をLLMが勝手に補っている
2. **序盤は定跡知識が必要** — LLMが「囲いの準備」等と雑に断定
3. **reviewedMoveのgroundingに穴** — USI→駒種の特定が盤面にgroundedされていない

---

## 品質推移（Day 1〜Day 3）

| 時点 | 正確性 | 分かりやすさ | 具体性 | 総合 | 判定 |
|------|--------|------------|--------|------|------|
| Day 1 参考値 | 4.0 | 4.0 | 4.3 | 4.1 | (参考) |
| Day 2 v1 | 1.6 | 2.4 | 2.0 | 2.0 | A |
| Day 2 v2 | 3.4 | 4.0 | 3.6 | 3.7 | B |
| Day 2 v3 | 3.8 | 4.2 | 3.8 | 3.9 | C |
| Day 3 plan | 4.0 | 4.2 | 4.0 | 4.1 | — |
| review mode | — | — | — | — | **人間監査でNG** |

---

## 決定事項（Day 3）

| DEC | 概要 | 決定者 |
|-----|------|--------|
| DEC-014 | v2を将棋学習エンジンとして再定義。ExplanationPlan 中心のパイプライン | 人間 |
| DEC-015 | review mode 3レーン制再設計。P0〜P3 の優先度 | orchestrator（人間レビューに基づく） |

---

## 再設計方針（DEC-015）

### 3レーン制

```
                ┌─ レーンA（opening）: 定跡DB主導、LLM不要
SFEN + move →  ├─ レーンB（mate/戦術）: engine PV そのまま、template-first
                └─ レーンC（通常）:     WhyChain + template-first + optional naturalizer
```

### 修正優先度

| 優先度 | 内容 | 状態 |
|--------|------|------|
| P0 | reviewedMove の駒種特定・合法性 | builder 作業中 |
| P1 | mate 局面で PV を主役にする | 待ち |
| P2 | opening レーンの骨格 | researcher が定跡DB調査中 |
| P3 | template-first 化 | 待ち |

### プロダクト定義の更新

旧: 「なぜ負けた？に答えて、次に何を見るかを教えるAI」
新: 「**エンジンの読み筋・局面文脈・定跡知識に基づいて**悪手を振り返り、次に何を見るかを教えるAI」

---

## 6セッション体制

Day 3 途中から **marketer** セッションが追加され、6セッション体制に移行。

| Role | 担当 |
|------|------|
| orchestrator | 全体統括、タスク定義 |
| researcher | データ作成、調査 |
| builder | 実装 |
| reviewer | 品質検証 |
| context-manager | 記録、整合性管理 |
| **marketer** | マーケティング戦略（PR #52） |

---

## Day 3 終了時チェックリスト

- [x] plan パイプライン初期実装完了（PR #26〜#33）
- [x] before/after 評価完了（plan 4.1 > legacy 3.9）
- [x] Trust Gate 実装・検証完了（PR #40〜#42, #45）
- [x] W1/W2 修正・検証完了（PR #35, #37, #38）
- [x] feature extraction 実装完了（PR #39）
- [x] Bad Move Coach 実装完了（PR #50, #51, #53）
- [x] 人間レビュー 5ケース完了 → 3根本問題特定
- [x] review mode 再設計方針確定（DEC-015, PR #56）
- [ ] P0〜P3 修正（進行中）

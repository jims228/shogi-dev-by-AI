# docs/ 整理・整合性レポート

> 作成: context-manager
> 日付: 2026-03-24
> 目的: Day 1〜3 で増えたファイルの整理、不要・重複の特定

---

## 1. docs/ ファイル分類（30ファイル）

### 残す（現在も参照される設計ドキュメント）

| ファイル | 用途 | 備考 |
|----------|------|------|
| `architecture.md` | アーキテクチャ概要 | plan パイプライン追加で更新が必要（後述） |
| `architecture-principles.md` | 設計原則 | 現行有効 |
| `requirements.md` | 要件定義 | 現行有効 |
| `explanation-quality.md` | 解説品質の定義・合格ライン | 現行有効 |
| `decisions.md` | 意思決定ログ（DEC-001〜014） | 追記のみ。現行有効 |
| `context-system.md` | コンテキスト管理ルール + Day 1-2 振り返り | 現行有効 |
| `review-loop.md` | レビュー体制 | 現行有効 |
| `session-prompts/*.md` (5件) | 各role用セッションプロンプト | 現行有効 |

### 残す（進捗記録 — 各Dayの最終版）

| ファイル | 用途 | 備考 |
|----------|------|------|
| `progress/day1-log.md` | Day 1 最終進捗 | 完了済み。履歴として保持 |
| `progress/day2-log.md` | Day 2 最終進捗 | 完了済み。履歴として保持 |
| `progress/day3-log.md` | Day 3 最終進捗 | 完了済み。履歴として保持 |

### 残す（タスク定義 — 各Dayのタスク指示書）

| ファイル | 用途 | 備考 |
|----------|------|------|
| `tasks/day1.md` | Day 1 タスク (TASK-001〜007) | 全完了。履歴として保持 |
| `tasks/day2.md` | Day 2 タスク (TASK-008〜013) | 全完了。履歴として保持 |
| `tasks/day3.md` | Day 3 タスク (TASK-014〜020) | 全完了。履歴として保持 |

### 残す（最終レビュー・調査）

| ファイル | 用途 | 備考 |
|----------|------|------|
| `reviews/day2-quality-gate-v3.md` | Day 2 品質ゲート最終版（C判定） | **最終版。これが正式レポート** |
| `reviews/day3-before-after.md` | Day 3 legacy vs plan 比較 | 最新の品質評価 |
| `reviews/day3-plan-transition-criteria.md` | plan移行の評価基準 | 現行有効 |
| `reviews/day3-w1w2-verification.md` | W1/W2 修正検証 | 最新のレビュー |
| `reviews/day3-trust-gate-verification.md` | Trust gate 検証 | 最新のレビュー |
| `reviews/day2-retrospective.md` | セキュリティ・コード品質チェック | CODE-1/CODE-2 指摘あり。対応用に保持 |
| `research/competitive-analysis.md` | 競合・先行研究 | 現行有効 |
| `research/silver-star-analysis.md` | 銀星将棋10 深掘り分析 | 現行有効 |
| `research/king-safety-design.md` | 玉安全度の設計メモ | 将来実装用の参考資料 |

### アーカイブ候補（古い中間レビュー）

| ファイル | 理由 | 推薦 |
|----------|------|------|
| `reviews/day1-prompt-v1-review.md` | Day 1 の参考スコア。v3 で上書きされた | `reviews/archive/` に移動 |
| `reviews/day2-quality-gate.md` | v1 レポート（A判定）。v3 が最終版 | `reviews/archive/` に移動 |
| `reviews/day2-quality-gate-v2.md` | v2 レポート（B判定）。v3 が最終版 | `reviews/archive/` に移動 |

**推薦**: 3ファイルを `docs/reviews/archive/` に移動。削除ではなく移動とし、履歴を保持する。

---

## 2. src/ 未使用ファイル・型重複

### CODE-1: ExplainForm.tsx が未使用

- **ファイル**: `src/components/ExplainForm.tsx`
- **状態**: `export default function ExplainForm()` が定義されているが、他のファイルからの import なし
- **経緯**: Day 1 で作成されたが、Day 2 で Chat.tsx に置き換えられた
- **推薦**: **削除**（builder が対応）

### CODE-2: Message 型と ChatMessage 型の重複

- **ファイル1**: `src/app/api/explain/route.ts:27` — `interface Message { role: string; content: string }`
- **ファイル2**: `src/components/Chat.tsx:10` — `interface ChatMessage { role: "user" | "assistant"; content: string }`
- **状態**: ほぼ同一の型が2箇所で独立定義。Chat.tsx の方が role の型が厳密
- **推薦**: 共通型を `src/lib/types.ts` 等に定義し、両ファイルからインポート（builder が対応）

---

## 3. CLAUDE.md の実態チェック

| セクション | 実態との整合性 | 対応 |
|-----------|--------------|------|
| プロダクトの核 | 整合。競合情報あり | 問題なし |
| 絶対ルール | 整合 | 問題なし |
| 開発方針 | 整合。ただし「2日完成」はDay 2で完了済み | Day 3以降の方針を追記すべき |
| 合格ライン | 整合 | 問題なし |
| Web公開前提 | 整合 | 問題なし |
| 技術スタック | **Gemini API — 整合** | 問題なし |
| ファイル構成の原則 | 整合 | 問題なし |
| v2参考ルール | 整合 | 問題なし |
| **パイプライン説明** | **欠落** | DEC-014 の plan-first パイプラインの記述がない。追加すべき |
| 詳細ドキュメント | docs/index.md への参照がない | 追加すべき |

### CLAUDE.md への追記提案

1. **パイプライン説明の追加**: DEC-014 の plan-first アーキテクチャ（Canonicalize → Plan → Verbalize → Verify）を開発方針または技術スタックに追記
2. **開発フェーズの現状**: 「Day 2 品質ゲート C 判定達成。Day 3 で plan パイプライン実装完了」

---

## 4. decisions.md の読みやすさ

- 現在 DEC-001〜014 + REVIEW-001 で 167 行
- フォーマットは統一されており、検索しやすい
- **問題なし**。ただし DEC-020 を超えたら目次（TOC）の追加を検討

---

## 対応まとめ

| # | 対応 | 担当 | 優先度 |
|---|------|------|--------|
| C1 | `reviews/archive/` に古いレビュー3件を移動 | context-manager | 低 |
| C2 | `ExplainForm.tsx` を削除 | builder | 中 |
| C3 | Message/ChatMessage 型を統合 | builder | 低 |
| C4 | CLAUDE.md に plan-first パイプライン説明を追記 | context-manager（人間承認） | 中 |
| C5 | `docs/index.md` を新規作成 | context-manager | 中（本PR） |

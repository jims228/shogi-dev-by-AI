# ドキュメント一覧

> docs/ 配下のナビゲーション。新規ファイル追加時にここも更新すること。

---

## 設計

| ファイル | 内容 |
|----------|------|
| [architecture.md](architecture.md) | アーキテクチャ概要（パイプライン構成、ディレクトリ構造） |
| [architecture-principles.md](architecture-principles.md) | 設計原則（9原則） |
| [requirements.md](requirements.md) | 要件定義 v0.5 |
| [explanation-quality.md](explanation-quality.md) | 解説品質の定義・合格ライン・3軸評価 |

## 運用

| ファイル | 内容 |
|----------|------|
| [review-loop.md](review-loop.md) | レビュー体制（5セッション間の検証フロー） |
| [context-system.md](context-system.md) | コンテキスト管理ルール + Day 1-2 振り返り |
| [decisions.md](decisions.md) | 意思決定ログ（DEC-001〜014, REVIEW-001） |
| [cleanup-report.md](cleanup-report.md) | docs/src 整理レポート |

## セッション初期プロンプト

| ファイル | Role |
|----------|------|
| [session-prompts/orchestrator.md](session-prompts/orchestrator.md) | orchestrator |
| [session-prompts/researcher.md](session-prompts/researcher.md) | researcher |
| [session-prompts/builder.md](session-prompts/builder.md) | builder |
| [session-prompts/reviewer.md](session-prompts/reviewer.md) | reviewer |
| [session-prompts/context-manager.md](session-prompts/context-manager.md) | context-manager |

## タスク定義

| ファイル | 内容 | 状態 |
|----------|------|------|
| [tasks/day1.md](tasks/day1.md) | TASK-001〜007（基盤構築 + 解説エンジン初版） | 全完了 |
| [tasks/day2.md](tasks/day2.md) | TASK-008〜013（UI + デプロイ + 品質ゲート） | 全完了 |
| [tasks/day3.md](tasks/day3.md) | TASK-014〜020（ExplanationPlan パイプライン） | 全完了 |

## 進捗ログ

| ファイル | 内容 | 結果 |
|----------|------|------|
| [progress/day1-log.md](progress/day1-log.md) | Day 1 進捗（7タスク完了） | 参考スコア: 4.0/4.0/4.3 |
| [progress/day2-log.md](progress/day2-log.md) | Day 2 進捗（品質ゲート v1→v2→v3） | C判定: 3.8/4.2/3.8 |
| [progress/day3-log.md](progress/day3-log.md) | Day 3 進捗（plan パイプライン） | plan: 4.0/4.2/4.0 |

## レビュー

| ファイル | 内容 | 備考 |
|----------|------|------|
| [reviews/day2-quality-gate-v3.md](reviews/day2-quality-gate-v3.md) | Day 2 品質ゲート最終版 | **正式レポート（C判定）** |
| [reviews/day3-before-after.md](reviews/day3-before-after.md) | legacy vs plan 比較 | plan +0.2 |
| [reviews/day3-plan-transition-criteria.md](reviews/day3-plan-transition-criteria.md) | plan 移行の評価基準 | 移行合格条件 |
| [reviews/day3-w1w2-verification.md](reviews/day3-w1w2-verification.md) | W1/W2 修正検証 | 修正効果確認済み |
| [reviews/day3-trust-gate-verification.md](reviews/day3-trust-gate-verification.md) | Trust gate 検証 | 合法性・Verifier検証 |
| [reviews/day2-retrospective.md](reviews/day2-retrospective.md) | セキュリティ・コード品質チェック | CODE-1/CODE-2 指摘あり |

### アーカイブ（古い中間レビュー）

| ファイル | 内容 | 理由 |
|----------|------|------|
| [reviews/day1-prompt-v1-review.md](reviews/day1-prompt-v1-review.md) | Day 1 参考スコア | v3 で上書き済み |
| [reviews/day2-quality-gate.md](reviews/day2-quality-gate.md) | 品質ゲート v1（A判定） | v3 が最終版 |
| [reviews/day2-quality-gate-v2.md](reviews/day2-quality-gate-v2.md) | 品質ゲート v2（B判定） | v3 が最終版 |

## 調査

| ファイル | 内容 |
|----------|------|
| [research/competitive-analysis.md](research/competitive-analysis.md) | 競合・先行研究（棋神解析、銀星将棋10、水匠、Leela Chess Zero等） |
| [research/silver-star-analysis.md](research/silver-star-analysis.md) | 銀星将棋10 深掘り + DecodeChess 5観点の将棋翻訳 |
| [research/king-safety-design.md](research/king-safety-design.md) | 玉安全度の計算ロジック設計メモ |

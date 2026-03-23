# コンテキスト管理システム（5セッション構成）

> 5つのAIセッションがプロジェクトの「現在地」を常に把握できるよう、
> コンテキスト情報を構造化して管理する。

---

## 1. 保存するコンテキストの種類

### プロジェクト状態

| ファイル | 内容 |
|----------|------|
| `CLAUDE.md` | プロジェクト全体のルール |
| `docs/requirements.md` | 要件定義 |
| `docs/architecture.md` | アーキテクチャ設計 |
| `docs/architecture-principles.md` | 設計原則 |
| `docs/decisions.md` | 意思決定ログ |
| `docs/explanation-quality.md` | 解説品質の定義・合格ライン |
| `docs/tasks/` | タスク指示書 |

### 将棋知識

| ファイル | 内容 |
|----------|------|
| `data/glossary.json` | 将棋用語 → 平易な説明 |
| `data/sample-kifu/` | テスト用棋譜ファイル |
| `data/prompt-examples/` | エンジン事前計算付きテスト局面（JSON） |

### レビュー・学習

| ファイル | 内容 |
|----------|------|
| `docs/reviews/` | 品質レポート |
| `docs/learnings.md` | 試行錯誤の記録 |
| `docs/research/` | 調査レポート |

---

## 2. いつ・誰が・どのファイルを更新するか

| ファイル | いつ | 誰が | 承認 |
|----------|------|------|------|
| `docs/requirements.md` | 要件変更時 | context-manager | **人間** |
| `docs/architecture.md` | 設計変更時 | context-manager（builderの提案を元に） | **人間** |
| `docs/architecture-principles.md` | 原則変更時 | context-manager | **人間** |
| `docs/decisions.md` | 判断が下されたとき | context-manager | 自動（追記のみ） |
| `docs/explanation-quality.md` | 品質基準変更時 | context-manager（人間判断を元に） | **人間** |
| `docs/tasks/*.md` | 新タスク発生時 | orchestrator | 自動 |
| `docs/reviews/*.md` | レビュー完了時 | reviewer | 自動 |
| `docs/research/*.md` | 調査完了時 | researcher | 自動 |
| `docs/learnings.md` | 実験・試行後 | 全role | 自動 |
| `data/glossary.json` | 用語追加時 | researcher | reviewer検証 |
| `data/sample-kifu/` | 棋譜収集時 | researcher | 自動 |
| `data/prompt-examples/` | テスト局面追加時 | researcher（作成）→ reviewer（検証） | **人間** |
| `prompts/` | プロンプト変更時 | builder | **人間**（reviewer検証後） |
| `src/` | 実装時 | builder | **人間**（reviewer検証後） |
| `CLAUDE.md` | ルール変更時 | context-manager | **人間** |

### タイミング詳細

| イベント | トリガー | 誰が動くか |
|----------|----------|-----------|
| PRがmergeされた | 人間がmerge | context-manager → decisions.md記録 |
| PRがcloseされた | 人間がclose | context-manager → decisions.md却下記録 |
| 要件が変わった | 人間の指示 | context-manager → requirements.md更新 |
| レビュー完了 | reviewerがPRコメント投稿 | reviewer → docs/reviews/、context-manager → decisions.md |
| Day切り替え | 毎日の開始時 | orchestrator → tasks/当日分、context-manager → learnings.md |
| データ追加 | researcher PRのmerge後 | context-manager → データ概要をdocs記録 |

---

## 3. 各roleが読むべきファイル

| Role | セッション開始時に必ず読む | 必要に応じて読む |
|------|--------------------------|-----------------|
| orchestrator | requirements.md, architecture-principles.md, tasks/ | decisions.md |
| researcher | requirements.md, tasks/, glossary.json | architecture.md |
| builder | requirements.md, architecture.md, **explanation-quality.md**, tasks/, data/prompt-examples/ | decisions.md, glossary.json |
| reviewer | requirements.md, architecture-principles.md, **explanation-quality.md**, data/prompt-examples/ | reviews/（過去分） |
| context-manager | 全docs/ | data/prompt-examples/（概要のみ） |

---

## 4. 更新の原則

1. **上書きではなく追記** — 過去の判断を消さない。変更理由を残す
2. **変更には理由を書く** — 「何を変えたか」だけでなく「なぜ変えたか」
3. **人間承認が必要なものは勝手に変えない** — 提案として出し、人間が判定
4. **コンフリクトは人間が解決** — AI同士で意見が割れたら人間に聞く
5. **decisions.md は追記のみ** — 過去のエントリを編集・削除しない

---

## 5. Day 1-2 振り返り（2026-03-23〜24）

### 5セッション体制: うまくいったこと

- **責務分離の効果**: builder/reviewer/researcherが独立して動くことで、品質ゲートv1→v2→v3の改善ループが高速に回った。reviewerの指摘(R1-R5)をbuilder/researcherが即座に反映し、1日で3回のテストサイクルを完了
- **orchestratorの判断**: v1でreviewerがA判定を推薦した際、orchestratorがUSI未変換（技術的バグ）と原因分析しB判定に変更。結果としてピンポイント修正でC判定に到達（DEC-012→DEC-013）
- **context-managerの記録**: decisions.md（DEC-001〜013）と進捗ログにより、判断の経緯が追跡可能。後からA→B→Cの判断根拠を確認できる
- **researcherのデータ品質**: エンジン事前計算データ（5局面）がreviewer検証の客観的根拠として機能。king_positions, move_ja, pv_jaの段階的追加で品質改善を支えた

### 5セッション体制: 改善点

- **セッション間のブランチ競合**: 複数セッションが同時にブランチを切ると、意図しないブランチにコミットが入る事故が複数回発生。ブランチ切り替え前に`git branch`で確認する運用が必要
- **docs更新の頻度**: context-managerのdocs更新PRが多く（#4, #10, #11, #13, #15）、人間のmerge負荷が高い。重要な判断記録以外はバッチ化を検討
- **reviewer↔builder間の直接ハンドオフがない**: reviewerの指摘をbuilderに伝える際、orchestratorを経由するかdocsを経由するしかない。指摘→修正のサイクルが間接的

### Git運用で起きた問題と対策

| 問題 | 原因 | 対策 |
|------|------|------|
| 誤ったブランチにコミット | `git checkout -b`でブランチ作成したはずが別ブランチにいた | コミット前に`git branch`で現在ブランチを確認する |
| cherry-pick + reset --hard で修復 | 上記の事後対応 | 発生頻度を下げることが優先。発生時の手順は確立済み |
| PR番号の欠番なし | 全21 PRが連番で管理できた | PRタイトルにタスク番号を含める運用が有効だった |

### コンテキスト管理で学んだこと

- **decisions.mdの追記ルールは有効**: 過去の判断を消さないことで、A→B→Cの推移が記録として残った
- **進捗ログは「決定事項/未決事項/ブロッカー」の3分類が効果的**: orchestratorとreviewerが現在地を素早く把握できた
- **品質ゲートスコアの推移記録が重要**: v1→v2→v3の数値推移により、各修正の効果を定量的に検証できた
- **競合調査（PR #20）は早期に実施すべきだった**: Day 2後半で実施したが、Day 1で方針に組み込めた可能性がある

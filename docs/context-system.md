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

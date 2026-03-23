# アーキテクチャ原則

> このプロジェクトのすべての設計・実装判断はこの文書に従う。

---

## 1. Clean-Room Implementation

**v2（/home/jimjace/shogi-commentary-ai-v2）は参考アーキテクチャであり、ソースコードベースではない。**

### 参考にしてよいもの
- 責務分割の考え方（engine → features → retrieval → planner → generator → verifier）
- API設計のインターフェース構造（PositionInput, ExplainResponseV2等のフィールド設計）
- 評価観点（flow_score, keyword_score, depth_score, readability_score の4軸）
- 局面特徴量の概念（king_safety, piece_activity, attack_pressure, phase, move_intent等）
- ExplanationPlanの構造（summary, primary_claim, bestmove_reason, teaching_point）
- ベンチマーク局面の設計思想（expected feature ranges付きのテスト局面）
- 品質評価のルールベース方式（explanation_evaluator.pyの設計思想）

### 参考にしないもの（コピー禁止）
- ソースコード（Python, TypeScript, Ruby いずれも）
- プロンプトの文面（diverse_prompts.py, ai_service.pyのプロンプト等）
- 学習済みMLモデル（data/models/）
- データファイルの中身（annotated/, human_eval/, benchmark_positions.json等）
- 設定ファイルの値（.env, collection_config.json等）
- テンプレート文面（template_commentary.pyのテンプレート）

### 判断基準
「v2のREADME.mdとdocs/だけを読んだ人が書くコード」であること。
ソースコードを見て得た知識は「設計概念」として参考にするが、実装をコピーしない。

---

## 2. True Parallel Claude Sessions（5セッション）

**5つの独立したClaude Codeセッションが並列稼働する。**

### 原則
- subagentの疑似分担ではない
- 各roleは独立したClaude Code CLIプロセスとして起動する
- researcher, builder, reviewerは専用のworktreeで作業する
- orchestrator, context-managerはmainブランチで作業する
- セッション間の直接通信はない
- 情報伝達はdocsとPRコメントのみで行う

### 5つのRole

| Role | 責務 | 作業場所 |
|------|------|----------|
| orchestrator | タスク分解、優先順位付け、進捗管理 | main |
| researcher | 将棋知識収集、データ取得、エンジン事前計算 | worktree (research/*) |
| builder | コード実装、プロンプト設計 | worktree (feat/*) |
| reviewer | コードレビュー、品質検証 | worktree (review/*) |
| context-manager | ドキュメント更新、決定事項記録 | main |

### ハンドオフ
- **入力**: docs/tasks/ のタスクファイル、PRの内容
- **出力**: PR、docs/への書き込み、PRコメント
- **決定**: 人間だけがmerge/採択を決める

---

## 3. 人間が最終意思決定者

**AIは提案する。人間が決める。**

### 人間だけができること
- PRのmerge
- 要件の変更・確定
- 設計方針の選択
- 解説品質の最終判定
- AI間の意見対立の裁定
- MVPスコープの判断

---

## 4. 核をぶらさない

**このプロダクトの核は「将棋を言語化する能力」である。**

### 優先順位（不変）
1. 解説プロンプトの品質
2. 解説エンジンの動作
3. 最小限のUI
4. その他すべて

---

## 5. 2日完成 + 品質ゲート

**2日で完成レベルまで持っていき、品質で継続判断する。**（DEC-008）

| Day | 目標 |
|-----|------|
| 1 | 全roleが動き始め、SFENパーサー + プロンプトv1 + エンジンデータ3局面 + 初回検証 |
| 2 | 解説API + チャットUI + 対話Q&A + デプロイ + **品質ゲート判定** |

Day 2終了時に人間が品質判定:
- **A: 作り直し** — 正確性2以下 or 2軸以上が3.0未満
- **B: 洗練** — 3軸すべて3.0以上、総合3.5未満
- **C: 拡張検討** — 3軸すべて3.5以上

詳細は `docs/review-loop.md` セクション7を参照。

---

## 6. Web公開前提の設計原則

**このプロダクトは一般公開を前提としたWebアプリケーションである。**（DEC-009）

### 原則

| # | 原則 | 内容 |
|---|------|------|
| W1 | Web-First Product | ローカルツールではなく、ブラウザでアクセスするWebプロダクトとして設計する |
| W2 | Browser-Based UI | フロントエンドはブラウザで動作するReact UIとして構築する |
| W3 | Server-Side API Boundary | LLM API（Gemini等）呼び出し等の外部サービス通信はすべてサーバーサイド（API Routes）で行う |
| W4 | API Key Never on Client | API Key（`GEMINI_API_KEY`等）は環境変数でサーバーサイドのみに保持。クライアントJSに一切含めない |
| W5 | Anonymous First, Auth Later | MVP時点では認証なし。ただし後から認証レイヤーを差し込める構造にする |
| W6 | Manual Input First | 入力はSFEN/KIFの手動貼り付けから始める。自動取得は後回し |
| W7 | Public Release Ready Structure | ディレクトリ構成・APIインターフェース・エラーハンドリングは公開プロダクト水準で設計する |
| W8 | Future-Aware (Logging/Analytics/Privacy) | MVP時点では実装しないが、後から追加できる構造にする。ミドルウェア挿入点を意識する |

### MVP時点で守る具体策
- `GEMINI_API_KEY` は `.env.local` + Vercel環境変数で管理
- `src/app/api/` 配下のRoute Handlersのみが外部APIを呼ぶ
- クライアントコンポーネントは `/api/explain` 等の内部APIのみを呼ぶ
- エラーメッセージにAPIキーやスタックトレースを含めない
- `next.config.ts` で不要な情報のクライアント露出を防ぐ

### MVP後に対応するもの
- 認証ミドルウェア（NextAuth.js等）
- レートリミットミドルウェア
- アクセスログ・分析（PostHog, Vercel Analytics等）
- プライバシーポリシー / 利用規約ページ

---

## 7. ファイルベースのコミュニケーション

| 情報の種類 | 場所 |
|-----------|------|
| タスク指示 | docs/tasks/*.md |
| 設計判断 | docs/decisions.md |
| 調査結果 | docs/research/*.md |
| レビュー結果 | docs/reviews/*.md + PRコメント |
| 要件 | docs/requirements.md |
| アーキテクチャ | docs/architecture.md |
| データ | data/ |
| コード | src/ (PRを通す) |

---

## 8. 評価駆動

### 3軸評価
| 軸 | 定義 | 検証根拠 |
|----|------|----------|
| 正確性 | 将棋の事実として正しいか | エンジン事前計算データ |
| 分かりやすさ | 初心者（ウォーズ5級〜3級）が読んで理解できるか | reviewer AIの判断 |
| 具体性 | この局面固有の解説になっているか | 局面データとの照合 |

合格ライン:
- **出荷可の最低条件**: 3軸すべて **3.0/5** 以上
- **目標品質**: 3軸の総合平均 **3.5/5** 以上
- **即不合格**: 正確性が **2.0以下** → 他軸に関係なく不合格

詳細な採点基準は `docs/explanation-quality.md` を参照。

### v2の評価観点（参考）
v2は4軸評価（flow_score, keyword_score, depth_score, readability_score）を採用。
本プロジェクトではこれを「初心者向け」に再定義し3軸に集約した。

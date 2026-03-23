# 将棋解説AI — プロジェクトルール

> このファイルはすべてのClaude Codeセッションが読む。
> 変更は context-manager が提案し、人間が承認する。

---

## プロダクトの核

**将棋の局面・棋譜・変化を、初心者にも分かる形で説明するAI。**

- **MVPターゲット**: 初心者（ウォーズ5級〜3級前後）
- **入力方法**: ユーザーが手動でSFEN/KIFをテキスト貼り付け
- 「将棋を言語化する能力」そのものがプロダクト
- UIの洗練度やデータ量ではなく、**解説の品質**が最重要
- **競合**: 銀星将棋10（2026/4/3発売）が直接競合。対話型×Web×初心者特化で差別化

---

## 絶対ルール

1. **Clean-Room Implementation** — v2（`/home/jimjace/shogi-commentary-ai-v2`）は参考アーキテクチャのみ。ソースコード・プロンプト文面・データの中身のコピーは禁止
2. **人間が最終決定者** — PRのmerge、要件変更、設計方針の選択、品質の最終判定はすべて人間が行う
3. **5セッション並列** — orchestrator / researcher / builder / reviewer / context-manager の5つの独立したCLIセッション
4. **正確性はエンジンデータで検証** — reviewer AIは将棋知識を単独で判断しない。`data/prompt-examples/` の事前計算データを根拠にする
5. **事実と推測を分離する** — 事実（ファクト）、解釈、仮説、提案を明確に区別して書く

---

## 開発方針

- **2日完成 + 品質ゲート** — Day 1-2で完成レベルを目指し、Day 2終了時に人間が品質判定して分岐する
- **小さく作る** — 小さなdiff、小さな判断、小さなPR
- **解説品質が最優先** — 「この変更は解説品質の向上に貢献するか？」を常に問う
- **慎重に正確に** — 将棋の事実に関わる部分は特に慎重に。間違いは後で致命的になる

---

## 合格ライン（解説品質）

| 条件 | 基準 |
|------|------|
| 出荷可の最低条件 | 3軸（正確性・分かりやすさ・具体性）すべて **3.0/5** 以上 |
| 目標品質 | 総合平均 **3.5/5** 以上 |
| 即不合格 | 正確性 **2.0以下** → 他軸に関係なく不合格 |

詳細: `docs/explanation-quality.md`

---

## Web公開前提（DEC-009）

- **ローカル実験用ではなく、一般公開を前提としたWebアプリ**
- API Key（`GEMINI_API_KEY`）は**サーバーサイドのみ**。クライアントJSに一切含めない
- LLM API呼び出しは `src/app/api/` のRoute Handlersのみ
- エラーメッセージにAPIキーやスタックトレースを含めない
- 認証・レートリミット・ログは後付け。ただし構造は最初から対応可能にする

## 技術スタック

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **Gemini API** (`@google/genai`, gemini-2.5-flash) — **サーバーサイドのみ**（DEC-010）
- JSON静的ファイル（DB不要）
- Vercelデプロイ

---

## ファイル構成の原則

| ディレクトリ | 内容 | 書く人 |
|-------------|------|--------|
| `docs/` | 設計文書、タスク、レビュー | orchestrator, reviewer, context-manager |
| `src/` | アプリケーションコード | builder のみ |
| `prompts/` | 解説プロンプト | builder のみ |
| `data/` | 棋譜、用語集、テスト局面 | researcher のみ |
| `CLAUDE.md` | このファイル | context-manager（人間承認） |

---

## v2から参考にしてよいもの

- 責務分割の考え方（6段パイプラインの概念）
- API設計のインターフェース構造（フィールド設計の概念）
- 評価観点（正確性・分かりやすさ・具体性の3軸）
- 局面特徴量の概念
- ベンチマーク局面の設計思想

## v2から参考にしないもの（コピー禁止）

- ソースコード（Python, TypeScript, Ruby いずれも）
- プロンプトの文面
- 学習済みMLモデル
- データファイルの中身
- テンプレート文面
- 設定ファイルの値

---

## 詳細ドキュメント

- 要件: `docs/requirements.md`
- 解説品質: `docs/explanation-quality.md`
- アーキテクチャ: `docs/architecture.md`
- 設計原則: `docs/architecture-principles.md`
- レビュー体制: `docs/review-loop.md`
- コンテキスト管理: `docs/context-system.md`
- 意思決定ログ: `docs/decisions.md`
- セッション初期プロンプト: `docs/session-prompts/`

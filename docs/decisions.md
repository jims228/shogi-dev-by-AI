# 意思決定ログ

> 設計変更・方針決定はすべてここに記録する。
> このファイルは追記のみ。過去のエントリを編集・削除しない。
> context-managerが記録責任を持つ。

---

## 記録フォーマット

```
### DEC-XXX: タイトル（YYYY-MM-DD）
- **決定**: 何を決めたか
- **理由**: なぜそう決めたか
- **却下した案**: 他にどんな案があったか
- **影響**: どのファイル/機能に影響するか
- **決定者**: 人間 / orchestrator / builder / reviewer
```

---

## 決定一覧

### DEC-001: 5セッション並列構成を採用（2026-03-23）
- **決定**: 独立した5つのClaude Code CLIセッションで並列開発する
- **理由**: 各roleの責務を明確に分離し、レビューの独立性を担保する
- **5つのRole**: orchestrator, researcher, builder, reviewer, context-manager
- **却下した案**: 3セッション縮退（researcherとorchestrator/context-managerの統合案）→ 不採用
- **影響**: review-loop.md, context-system.md, architecture-principles.md, requirements.md, session-prompts/
- **決定者**: 人間

### DEC-002: 正確性レビューにエンジン事前計算データを使用（2026-03-23）
- **決定**: reviewer AIは将棋の正確性を単独で判断せず、エンジン事前計算データを根拠にする
- **理由**: LLMの将棋知識は不完全。bestmove/eval等の客観データがないと誤りを見逃す
- **方式**: data/prompt-examples/ にエンジン計算結果を事前格納。researcherが作成
- **影響**: review-loop.md, data/prompt-examples/ のフォーマット
- **決定者**: 人間

### DEC-003: v2はclean-room参考のみ、コード流用禁止（2026-03-23）
- **決定**: /home/jimjace/shogi-commentary-ai-v2 は参考アーキテクチャのみ。全コード新規実装
- **理由**: 知的資産として独立したプロダクトを作る
- **参考にするもの**: 責務分割（6段パイプライン）、API設計パターン、評価観点、特徴量の概念
- **参考にしないもの**: ソースコード、プロンプト文面、MLモデル、データファイルの中身
- **影響**: 全実装ファイル
- **決定者**: 人間

### DEC-004: 合格ラインの確定（2026-03-23）
- **決定**: 出荷可の最低条件は3軸すべて3.0/5以上、目標品質は総合平均3.5/5以上、正確性2.0以下は即不合格
- **理由**: 分かりやすくても間違っている解説は学習用途では有害。正確性は厳格に、他軸は最低ラインを現実的に設定
- **却下した案**: 3軸すべて3.5以上を最低条件とする案 → MVP期間では達成困難な可能性があり、最低条件を3.0に緩和して目標を3.5に分離
- **影響**: explanation-quality.md, review-loop.md, architecture-principles.md, session-prompts/reviewer.md
- **決定者**: 人間

### DEC-005: MVPは初心者向けに限定（2026-03-23）
- **決定**: MVPのターゲットをウォーズ5級〜3級前後の初心者に限定。中級者向け解説はMVP後
- **理由**: 5日MVPで初心者・中級者両方の品質を担保するのは困難。初心者に集中して品質を上げる
- **却下した案**: 初心者〜中級者（ウォーズ2段まで）を同時にカバー → MVP後に回す
- **影響**: requirements.md, explanation-quality.md, session-prompts/builder.md
- **決定者**: 人間

### DEC-006: ユーザー棋譜は手動SFEN/KIF貼り付け（2026-03-23）
- **決定**: MVPでは、ユーザー本人の過去棋譜を手動でSFEN/KIFテキストとして貼り付けて使う。自動インポート・認証・永続化はMVP対象外
- **理由**: 5日MVPでは棋譜入力の自動化に工数を割くべきではない。手動貼り付けで十分に価値検証できる
- **却下した案**: 将棋ウォーズAPI連携、URL指定自動取得 → MVP後に検討
- **影響**: requirements.md, explanation-quality.md
- **決定者**: 人間

### DEC-007: explanation-quality.mdをcontext管理対象に追加（2026-03-23）
- **決定**: docs/explanation-quality.md をコンテキスト管理対象ファイルに追加。builder と reviewer の必読ファイルとする
- **理由**: 解説品質の定義が全roleで共有されないと、builderのプロンプト設計とreviewerの品質評価がずれる
- **影響**: context-system.md, session-prompts/builder.md, session-prompts/reviewer.md
- **決定者**: 人間

### DEC-008: 「2日完成 + 品質ゲート」方式に変更（2026-03-23）
- **決定**: 「5日でMVPを作る」→「2日で完成レベルまで持っていき、Day 2終了時に人間が品質判定して分岐する」方式に変更
- **理由**: 5日間漫然と作るより、2日で一旦完成させて品質を見て判断する方が、方向転換が早くできる
- **分岐条件**:
  - A（作り直し）: 正確性2.0以下、または3軸のうち2軸以上が3.0未満
  - B（洗練）: 3軸すべて3.0以上だが総合3.5未満
  - C（拡張検討）: 3軸すべて3.5以上 → 中級者向け追加を検討
- **却下した案**: 5日間の固定スケジュール → 品質確認が遅すぎる。方向転換のコストが高い
- **影響**: requirements.md, review-loop.md, architecture-principles.md, CLAUDE.md, session-prompts/, tasks/
- **決定者**: 人間

### DEC-009: Web公開前提で設計する（2026-03-23）
- **決定**: ローカル実験用ではなく、将来的な一般公開を見据えたWebプロダクトとして設計する
- **理由**: 後からセキュリティや認証を追加するのは構造変更を伴う。最初から公開前提の設計にすることで手戻りを防ぐ
- **設計原則（W1〜W8）**:
  - W1: Web-First Product
  - W2: Browser-Based UI
  - W3: Server-Side API Boundary（LLM APIはサーバーのみ）
  - W4: API Key Never on Client（環境変数で管理、クライアントに一切含めない）
  - W5: Anonymous First, Auth Later（認証は後回しだが差し込める構造）
  - W6: Manual Input First（SFEN/KIF手動貼り付けから）
  - W7: Public Release Ready Structure（公開水準のコード品質）
  - W8: Future-Aware（ログ/分析/プライバシーの後付けを意識）
- **MVP時点で守ること**: API Keyのサーバー限定、API Routesによる境界、エラーメッセージの安全性
- **MVP後に対応**: 認証、レートリミット、アクセスログ、プライバシーポリシー
- **却下した案**: なし（ローカル実験用に留める案は最初から除外）
- **影響**: requirements.md, architecture.md, architecture-principles.md, CLAUDE.md
- **決定者**: 人間

### DEC-010: LLM Provider を Gemini に変更（2026-03-23）
- **決定**: LLM Provider を Anthropic Claude API から Google Gemini API（gemini-2.5-flash）に変更する
- **理由**: 人間の判断による選定
- **実装状況**: builder が差替え完了。`src/lib/ai/client.ts` を `@google/genai` ベースに書き換え。テスト17件pass、`/api/explain` 疎通確認済み
- **環境変数**: `ANTHROPIC_API_KEY` → `GEMINI_API_KEY`
- **影響**: client.ts, package.json（依存パッケージ変更）, .env.local, CLAUDE.md, architecture docs
- **決定者**: 人間

### REVIEW-001: Day 1 プロンプトv1 品質検証結果（2026-03-23）
- **種別**: レビュー結果の記録（決定ではない）
- **結果**:
  - 局面1（序盤）: 正確性4 / 分かりやすさ4 / 具体性4
  - 局面2（中盤）: 正確性4 / 分かりやすさ4 / 具体性4
  - 局面3（終盤）: 正確性4 / 分かりやすさ4 / 具体性5
  - **平均**: 正確性4.0 / 分かりやすさ4.0 / 具体性4.3
- **品質ゲート基準との照合**: 3軸すべて3.5以上 → **C判定相当**（参考値）
- **reviewer推奨**: B案 — プロンプトに評価値の表現ガイドラインを追加して進める
- **注意**: この採点はDay 1の参考値。正式な品質ゲート判定はDay 2終了時に人間が行う
- **出力**: `docs/reviews/day1-prompt-v1-review.md`
- **記録者**: orchestrator（reviewer報告に基づく）

### DEC-011: v2の駒画像を再利用、描画ロジックは新規実装（2026-03-23）
- **決定**: v2（shogi-commentary-ai-v2）の `pieces.png` スプライト画像をそのまま利用する。ただし描画ロジック（座標計算、コンポーネント実装）はすべて新規実装する
- **理由**: 駒画像は美術的資産であり、コード品質やアーキテクチャとは無関係。再作成する意味がない。ロジックはclean-room原則に従い新規実装する
- **利用するもの**: `public/images/pieces.png`（1040x520px, 8列×4行, 130pxタイル）
- **参考にするデータ**: スプライトの行列配置（row 0/1=先手, row 2/3=後手）と駒種ごとの座標オフセット値
- **新規実装するもの**: Board描画コンポーネント、スプライト切り出しロジック、盤面レイアウト
- **clean-room例外**: 画像ファイルのみ。v2のPieceSprite.tsx等のコードはコピーしない
- **影響**: public/images/, src/components/Board.tsx（新規作成）
- **決定者**: 人間

### DEC-012: 品質ゲートB判定 — ピンポイント修正→再テスト（2026-03-23）
- **決定**: A判定（全面作り直し）ではなく B判定（洗練）で進める
- **理由**: 正確性低下の主因はUSI記法の未変換（技術的バグ）であり、解説構造・プロンプト自体の問題ではない。`move_ja` フィールドの追加で大幅改善が見込める
- **品質ゲート結果**: 正確性1.6 / 分かりやすさ2.4 / 具体性2.0（形式的にはA判定条件該当）
- **修正計画**: P1(USI→日本語変換) → P2(盤面認識補助) → P3(mate対応) → 再テスト
- **決定者**: orchestrator（人間から判断を委任）

# AI相互レビュー体制 — 5セッション並列構成

> 独立した5つのClaude Code CLIセッションが並列稼働する。
> subagentの疑似分担ではない。真の並列セッション。
> 最終意思決定は常に人間が行う。

---

## 1. 5つのRole

### orchestrator（統括）
- **実行環境**: mainブランチ上のセッション
- **責務**: タスク分解、優先順位付け、セッション間の依存関係管理、進捗追跡
- **出力**: docs/tasks/ のタスクファイル、進捗サマリー
- **権限**: docs/tasks/ への書き込み。コードは書かない

### researcher（調査）
- **実行環境**: 専用worktree（`research/*`ブランチ）
- **責務**: 将棋知識の収集、Web調査、棋譜・用語データの取得と整理、エンジン事前計算データの作成
- **出力**: data/ 配下のデータファイル、docs/research/ に調査レポート
- **権限**: data/、docs/research/ への書き込み。アプリコード（src/）は触らない

### builder（構築）
- **実行環境**: 専用worktree（`feat/*`ブランチ）
- **責務**: コード実装、プロンプト設計、UI構築
- **出力**: ソースコード、PR（feat/* → main）
- **権限**: src/、prompts/ への書き込み

### reviewer（検証）
- **実行環境**: 専用worktree（`review/*`ブランチ）。**builderとは別セッション**
- **責務**: コードレビュー、解説品質チェック、正確性検証（エンジンデータと照合）
- **出力**: PRコメント、docs/reviews/ に品質レポート
- **権限**: docs/reviews/ への書き込み。builderのコードは直接編集しない

### context-manager（文脈管理）
- **実行環境**: mainブランチ上のセッション
- **責務**: 決定事項のdocs反映、コンテキスト整合性維持、意思決定ログ記録
- **出力**: docs/ 配下のドキュメント更新（decisions.md, requirements.md, architecture.md等）
- **権限**: docs/ への書き込み。コードは触らない

---

## 2. セッション構成図

```
┌──────────────────────────────────────────────────────────────────┐
│                         人間（最終決定者）                         │
│    merge/採択、要件変更、方向性の決定、品質の最終判定              │
└───┬────────────┬────────────┬────────────┬────────────┬──────────┘
    │            │            │            │            │
┌───▼───┐  ┌────▼────┐  ┌───▼────┐  ┌───▼────┐  ┌────▼─────┐
│orch-  │  │research-│  │builder │  │reviewer│  │context-  │
│estrator│  │er       │  │        │  │        │  │manager   │
└───────┘  └─────────┘  └────────┘  └────────┘  └──────────┘
main        research/*    feat/*      review/*    main
─────────  ──────────    ─────────   ─────────   ──────────
タスク定義  worktree      worktree    worktree    docs更新
進捗管理   データ収集     コード実装   PRレビュー   決定記録
```

各セッションは独立したClaude Code CLIプロセスとして起動する。

---

## 3. Worktree構成

```
shogi-dev-by-AI/                       # mainブランチ（orchestrator, context-manager）
└── .claude/worktrees/
    ├── researcher/                    # git worktree (research/* ブランチ)
    ├── builder/                       # git worktree (feat/* ブランチ)
    └── reviewer/                      # git worktree (review/* ブランチ)
```

### ブランチ命名規則
- `research/glossary` — researcher: 用語集作成
- `research/engine-data` — researcher: エンジン事前計算データ作成
- `research/sample-kifu` — researcher: テスト棋譜収集
- `feat/sfen-parser` — builder: SFENパーサー実装
- `feat/prompt-v1` — builder: 解説プロンプト設計
- `feat/chat-ui` — builder: チャットUI実装
- `review/prompt-v1` — reviewer: プロンプトv1の品質検証

---

## 4. ハンドオフ

### 情報伝達はdocsとPRで行う

| from → to | 手段 | 内容 |
|-----------|------|------|
| orchestrator → 各role | `docs/tasks/` にタスクファイル | 何をすべきか、依存関係、期限 |
| researcher → builder | PR（data/ への追加） | 用語集、棋譜、エンジンデータ |
| researcher → reviewer | PR（data/ への追加） | 品質検証用のエンジン事前計算データ |
| builder → reviewer | PR（feat/* → main） | コード、プロンプト |
| reviewer → builder | PRコメント | レビュー指摘、品質スコア |
| reviewer → context-manager | `docs/reviews/` にレポート | 品質判定結果 |
| context-manager → 全員 | `docs/` の更新 | 決定事項、要件変更、学習 |
| 人間 → 全員 | PRのmerge/close | 最終判断 |

### 原則
1. **ファイルが情報伝達の手段** — セッション間の直接通信はない
2. **PRが成果物の単位** — 各roleはPRを出し、人間がmergeする
3. **docsが真実の源泉** — 決定事項はdocsに書かれたものが正
4. **人間だけがmergeする** — AIはPRを作るが、mergeは人間が行う

---

## 5. レビューフロー

### 5.1 通常の実装フロー

```
orchestrator: タスクを docs/tasks/ に書く
    ↓
researcher: 必要なデータを収集 → PR（data/へ）
    ↓
人間: researcher PRをmerge
    ↓
builder: 実装 → PR（feat/* → main）
    ↓
reviewer: PRを別worktreeでレビュー → PRコメント + 品質レポート
    ↓
builder: レビュー指摘を修正 → PR更新
    ↓
人間: PRをmerge or close
    ↓
context-manager: 決定事項をdocsに反映
```

### 5.2 プロンプト改善フロー（最重要）

```
researcher: テスト局面3〜5つ + エンジン事前計算データを用意 → PR
    ↓
人間: merge
    ↓
builder: プロンプト案を作成 → PR
    ↓
reviewer: テスト局面でプロンプトを実行し、3軸で採点
          正確性はエンジンデータ（bestmove, eval, candidates）と照合
    ↓
reviewer: 品質レポートをPRコメントに投稿
    ↓
builder: スコアが低い軸を改善 → PR更新
    ↓
（3軸すべて3.0以上になるまで繰り返し。目標は総合3.5以上）
    ↓
人間: 最終確認 → merge
    ↓
context-manager: decisions.md に品質結果を記録
```

### 5.3 知識収集フロー

```
orchestrator: 「○○を調査して」→ docs/tasks/
    ↓
researcher: Web検索・棋譜取得・データ整理 → PR（data/へ）
    ↓
reviewer: 情報の正確性を検証 → PRコメント
    ↓
人間: merge
    ↓
context-manager: 検証済みデータの概要をdocsに記録
```

---

## 6. レビュー基準

### コードレビュー

| 基準 | 内容 |
|------|------|
| 動作 | エラーなく動作するか |
| スコープ | MVPスコープを超えていないか |
| 核の一致 | 「将棋解説AIの品質」に貢献するか |
| clean-room | v2のコードをコピーしていないか |

### 解説品質レビュー

| 軸 | 5点 | 1点 | 検証根拠 |
|----|-----|-----|----------|
| 正確性 | 将棋の事実として正しい | 明らかな誤りがある | エンジン事前計算データ |
| 分かりやすさ | 初心者（ウォーズ5級〜3級）が理解できる | 有段者でも分かりにくい | reviewer AI の判断 |
| 具体性 | 局面固有の解説 | どの局面にも当てはまる | 局面データとの照合 |

合格ライン:
- **出荷可の最低条件**: 3軸すべて **3.0/5** 以上
- **目標品質**: 3軸の総合平均 **3.5/5** 以上
- **即不合格**: 正確性が **2.0以下** → 他軸に関係なく不合格

詳細な採点基準は `docs/explanation-quality.md` を参照。

### 正確性レビューの根拠

reviewer AIは将棋の正確性を単独で判断しない。
`data/prompt-examples/` に格納されたエンジン事前計算データを根拠として使う。

---

## 7. Day 1〜2 + 品質ゲート方式（DEC-008）

「5日でMVP」ではなく「2日で完成レベル → 品質で継続判断」方式。

### Day 1〜2 スケジュール

| Day | orchestrator | researcher | builder | reviewer | context-manager |
|-----|-------------|------------|---------|----------|-----------------|
| 1 | タスク定義 + 依存関係整理 | 3局面エンジンデータ + 用語集 | SFENパーサー + プロンプトv1 + 解説API | 3局面で手動検証 | decisions.md運用 |
| 2 | 進捗確認 + 品質ゲート準備 | 追加データ + サンプル棋譜 | チャットUI + 対話型Q&A + デプロイ | 全機能検証 + 品質ゲートレポート | 品質集約 + 振り返り |

### Day 2 品質ゲート

Day 2終了時に**人間が品質判定**を行い、以下の3分岐のいずれかに進む。

| 判定 | 条件 | 次のアクション |
|------|------|---------------|
| **A: 作り直し** | 正確性2.0以下、または3軸のうち2軸以上が3.0未満 | 根本原因を特定し、プロンプトまたはアーキテクチャから再設計 |
| **B: 洗練** | 3軸すべて3.0以上だが、総合3.5未満 | プロンプト改善・UI磨き込み・追加テスト局面で品質向上 |
| **C: 拡張検討** | 3軸すべて3.5以上 | 中級者向け解説の追加を検討開始。ただし人間が判断 |

### 品質ゲートの入力

reviewerが以下をまとめて `docs/reviews/day2-quality-gate.md` に提出:
1. テスト局面ごとの3軸スコア（最低3局面）
2. 総合評価と根拠
3. 判定A/B/Cの推薦（最終決定は人間）
4. 改善すべき点のリスト（判定B/Cの場合）

### 品質ゲート後のDay 3以降

Day 3以降のタスクはDay 2品質ゲートの結果に基づいて人間が決定する。
事前にDay 3-5のスケジュールは定義しない。

---

## 8. セッション起動手順

```bash
# ターミナル1: orchestrator（mainブランチ）
cd ~/shogi-dev-by-AI
claude
# → docs/session-prompts/orchestrator.md を貼る

# ターミナル2: researcher（worktree）
cd ~/shogi-dev-by-AI
git worktree add .claude/worktrees/researcher research/day1
cd .claude/worktrees/researcher
claude
# → docs/session-prompts/researcher.md を貼る

# ターミナル3: builder（worktree）
cd ~/shogi-dev-by-AI
git worktree add .claude/worktrees/builder feat/day1
cd .claude/worktrees/builder
claude
# → docs/session-prompts/builder.md を貼る

# ターミナル4: reviewer（worktree）
cd ~/shogi-dev-by-AI
git worktree add .claude/worktrees/reviewer review/day1
cd .claude/worktrees/reviewer
claude
# → docs/session-prompts/reviewer.md を貼る

# ターミナル5: context-manager（mainブランチ、orchestratorとは別ターミナル）
cd ~/shogi-dev-by-AI
claude
# → docs/session-prompts/context-manager.md を貼る
```

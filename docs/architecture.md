# アーキテクチャ設計（Draft v0.1）

> ステータス: 叩き台 / レビュー待ち
> 作成日: 2026-03-23

---

## 前提

### Clean-Room Implementation

- **shogi-commentary-ai（v2）は参考アーキテクチャとしてのみ使用する**
- v2のコードのコピー・流用は行わない
- フロントエンドもバックエンドも完全新規実装
- v2から参考にしてよいもの:
  - 責務分割の考え方（パイプラインの段階分け）
  - API設計のインターフェース構造
  - 評価観点（正確性・分かりやすさ・具体性）
  - 特徴量の概念（局面の多次元的な捉え方）
- v2から参考にしないもの:
  - ソースコード
  - プロンプト文面
  - 学習済みモデル
  - データファイルの中身

---

## v2アーキテクチャの参考ポイント

v2は以下の5段階パイプラインを持つ。設計の参考とする。

```
v2: KIF → 特徴抽出(8次元) → ML予測 → プロンプト構築 → LLM生成
```

**本プロジェクトで参考にする概念:**

| v2の概念 | 参考にする点 | 本プロジェクトでの対応 |
|----------|-------------|---------------------|
| 特徴抽出 | 局面を多次元で捉える | LLMに構造化された局面情報を渡す |
| FocusPredictor | 何を解説すべきか判断 | プロンプトで注目点を指示 |
| StyleSelector | 解説スタイルの選択 | レベル切替（初心者/中級者） |
| ExplanationPlanner | 解説の中間計画 | プロンプト内でステップバイステップ指示 |
| 品質評価 | 3軸評価 | 正確性・分かりやすさ・具体性 |

---

## システム構成（MVP）

```
┌─────────────────────────────────────────────┐
│                  Frontend                    │
│              Next.js (App Router)            │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │ チャットUI │  │ 局面図   │  │ サンプル   │ │
│  │          │  │ (Should) │  │ 棋譜選択  │ │
│  └─────┬────┘  └──────────┘  └───────────┘ │
│        │                                     │
└────────┼─────────────────────────────────────┘
         │ API Route
         ▼
┌─────────────────────────────────────────────┐
│                  Backend                     │
│           Next.js API Routes                 │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │         解説エンジン                   │   │
│  │                                      │   │
│  │  SFEN/KIF入力                        │   │
│  │    → 局面パーサー                     │   │
│  │    → コンテキスト構築                  │   │
│  │    → 解説プロンプト適用               │   │
│  │    → Gemini API (streaming)          │   │
│  │    → 解説テキスト出力                 │   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌────────────┐  ┌────────────────────┐    │
│  │ 棋譜パーサー │  │ 用語注釈エンジン   │    │
│  │ KIF/SFEN   │  │ (Should)          │    │
│  └────────────┘  └────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│              External Services               │
│                                             │
│  ┌──────────┐  ┌──────────────────────┐    │
│  │Gemini API │  │ 静的データ            │    │
│  │streaming  │  │ (JSON: 棋譜,用語集)  │    │
│  └──────────┘  └──────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 解説パイプライン（本プロジェクト独自設計）

```
1. 入力解析
   ユーザー入力（テキスト/SFEN/KIF）→ 入力種別を判定

2. 局面構造化
   棋譜パーサーで局面情報を構造化データに変換
   - 手番、持ち駒、盤面配置
   - 直前の数手（文脈）
   - 局面フェーズ推定（序盤/中盤/終盤）

3. コンテキスト構築
   ユーザーの質問 + 局面構造化データ + 会話履歴 → プロンプトへ

4. 解説生成
   システムプロンプト + コンテキスト → Gemini API → ストリーミング出力

5. 後処理（Should）
   専門用語に注釈を付加
```

### v2との違い

| 観点 | v2 | 本プロジェクト |
|------|-----|-------------|
| ML予測 | scikit-learn で Focus/Importance/Style を予測 | 使わない。プロンプトで指示 |
| 将棋エンジン | YaneuraOu + bioshogi でリアルタイム解析 | リアルタイムでは使わない。事前計算データを品質検証に利用 |
| LLM | Gemini API | Gemini API（DEC-010で採用） |
| 解説長さ | 約80文字 | 制限なし（対話型） |
| 対話 | なし（1ショット生成） | あり（会話コンテキスト維持） |

---

## エンジン事前計算データ（品質検証用）

将棋エンジンはプロダクトのランタイムには組み込まない。
ただし、解説の正確性検証のために、テスト局面にエンジンの計算結果を事前に付与する。

### data/prompt-examples/ のフォーマット

各テスト局面は以下のJSON形式で格納する。

```json
{
  "id": "pos-001",
  "description": "矢倉戦の中盤、先手が攻めの構想を立てる局面",
  "sfen": "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1",
  "move_number": 42,
  "phase": "middle",
  "last_move": "7g7f",
  "engine_data": {
    "bestmove": "2d2e",
    "eval": 150,
    "eval_type": "cp",
    "candidates": [
      { "move": "2d2e", "eval": 150 },
      { "move": "8d8e", "eval": 80 },
      { "move": "4d4e", "eval": -20 }
    ],
    "pv": ["2d2e", "7f7e", "8d8e"],
    "depth": 20,
    "engine": "YaneuraOu NNUE"
  },
  "context": {
    "opening": "矢倉",
    "sente_castle": "矢倉囲い",
    "gote_castle": "矢倉囲い",
    "key_point": "先手の飛車先の歩を交換するかどうか"
  },
  "expected_explanation_points": [
    "飛車先の歩交換が狙い",
    "▲2五歩が最善手である理由",
    "▲8五歩は次善だが攻めが遅い"
  ]
}
```

### フィールド定義

| フィールド | 必須 | 内容 |
|-----------|------|------|
| `id` | Yes | 一意識別子 |
| `description` | Yes | 局面の概要（日本語） |
| `sfen` | Yes | 局面のSFEN文字列 |
| `move_number` | Yes | 手数 |
| `phase` | Yes | 局面フェーズ（opening / middle / endgame） |
| `last_move` | No | 直前の指し手（USI形式） |
| `engine_data.bestmove` | Yes | エンジンの最善手（USI形式） |
| `engine_data.eval` | Yes | 評価値（centipawn） |
| `engine_data.candidates` | Yes | 候補手リスト（最低3手、eval付き） |
| `engine_data.pv` | No | 読み筋（Principal Variation） |
| `engine_data.depth` | No | 探索深さ |
| `engine_data.engine` | No | 使用エンジン名 |
| `context.opening` | No | 戦型名 |
| `context.sente_castle` | No | 先手の囲い |
| `context.gote_castle` | No | 後手の囲い |
| `context.key_point` | No | この局面のポイント（人間が記述） |
| `expected_explanation_points` | Yes | 解説に含まれるべきポイント（reviewer検証用） |

---

## API設計（MVP）

### POST /api/explain

単一局面の解説を生成する。

```typescript
// Request
{
  position: string;      // SFEN or KIF text
  question?: string;     // ユーザーの質問（省略時は全体解説）
  history?: Message[];   // 会話履歴
  level?: "beginner" | "intermediate";
}

// Response (Server-Sent Events)
{
  type: "text";
  content: string;       // 解説テキスト（ストリーミング）
}
```

### GET /api/samples

サンプル棋譜一覧を返す。

```typescript
// Response
{
  samples: {
    id: string;
    title: string;       // "矢倉の基本形"
    description: string;
    kifu: string;         // KIF text
  }[];
}
```

---

## ディレクトリ構成（MVP）

```
shogi-dev-by-AI/
├── CLAUDE.md
├── docs/
│   ├── requirements.md
│   ├── architecture.md              # ← 本文書
│   ├── architecture-principles.md
│   ├── review-loop.md
│   ├── context-system.md
│   ├── decisions.md                 # 意思決定ログ
│   ├── tasks/                       # orchestrator が管理
│   ├── reviews/                     # reviewer が作成
│   └── session-prompts/
│       ├── orchestrator.md
│       ├── researcher.md
│       ├── builder.md
│       ├── reviewer.md
│       └── context-manager.md
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── page.tsx                 # チャットUI
│   │   ├── api/
│   │   │   ├── explain/route.ts     # 解説API
│   │   │   └── samples/route.ts     # サンプル棋譜API
│   │   └── layout.tsx
│   ├── lib/
│   │   ├── shogi/
│   │   │   ├── parser.ts            # KIF/SFENパーサー
│   │   │   └── types.ts             # 将棋関連の型定義
│   │   ├── ai/
│   │   │   ├── prompt.ts            # システムプロンプト
│   │   │   └── client.ts            # Gemini API クライアント
│   │   └── glossary.ts              # 用語注釈
│   └── components/
│       ├── Chat.tsx                  # チャットコンポーネント
│       └── Board.tsx                 # 将棋盤（Should）
├── data/
│   ├── glossary.json                # 用語集
│   ├── sample-kifu/                 # サンプル棋譜
│   └── prompt-examples/             # エンジン事前計算付きテスト局面（JSON）
├── prompts/
│   └── system-prompt-v1.md          # 解説システムプロンプト
└── package.json
```

---

## Webアプリ構成（公開前提の最小構成）

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Client)                      │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ SFEN/KIF入力  │  │ 局面図表示   │  │ 解説表示     │  │
│  │ テキストエリア │  │ (Should)    │  │ ストリーミング│  │
│  └──────┬───────┘  └──────────────┘  └──────────────┘  │
│         │  fetch('/api/explain')                        │
│         │  ※ API Keyはクライアントに存在しない           │
└─────────┼──────────────────────────────────────────────-┘
          │ HTTPS
          ▼
┌─────────────────────────────────────────────────────────┐
│               Server (Next.js API Routes)                │
│               ※ API Key はここだけに存在                  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  POST /api/explain                              │    │
│  │    1. リクエスト検証                              │    │
│  │    2. SFEN/KIF パース → 構造化データ              │    │
│  │    3. プロンプト構築（system + user message）      │    │
│  │    4. Gemini API 呼び出し（streaming）             │    │
│  │    5. SSE レスポンス返却                          │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────┐   │
│  │ SFENパーサー │  │プロンプト構築 │  │ Claude Client │   │
│  │ parser.ts  │  │ prompt.ts   │  │  client.ts   │   │
│  └────────────┘  └──────────────┘  └───────────────┘   │
│                                                         │
│  将来の挿入点:                                           │
│  ├── 認証ミドルウェア (middleware.ts)                     │
│  ├── レートリミット                                      │
│  └── アクセスログ                                        │
└──────────┬──────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────┐
│                  External / Static                       │
│                                                         │
│  ┌──────────┐  ┌──────────────────────────────────┐    │
│  │Gemini API │  │ 静的データ (JSON)                 │    │
│  │(server    │  │ ├── data/prompt-examples/*.json  │    │
│  │ side only)│  │ ├── data/glossary.json           │    │
│  └──────────┘  │ └── prompts/system-prompt-v1.md  │    │
│                 └──────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### セキュリティ境界

| 境界 | ルール |
|------|--------|
| Client → Server | `/api/*` のみ。クライアントは直接 Gemini API を呼ばない |
| Server → Gemini API | `GEMINI_API_KEY` は環境変数。コードにハードコードしない |
| エラーレスポンス | API Keyやスタックトレースをクライアントに返さない |
| 環境変数 | `.env.local`（ローカル）、Vercel環境変数（本番）。`.gitignore` に `.env*` を含める |

---

## 技術スタック

| レイヤー | 技術 | 理由 |
|----------|------|------|
| フレームワーク | Next.js 15 (App Router) | フルスタック一体、Vercel即デプロイ |
| 言語 | TypeScript | 型安全 |
| AI | Gemini API (@google/genai, gemini-2.5-flash) | ストリーミング対応（DEC-010） |
| スタイリング | Tailwind CSS | 高速プロトタイピング |
| デプロイ | Vercel | ゼロ設定 |
| データ | JSON静的ファイル | DB不要、MVP最速 |
| 将棋盤 | SVG（Should） | 軽量、カスタマイズ自由 |

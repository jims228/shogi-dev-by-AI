# Day 3: Trust Gate 検証レポート

> 担当: reviewer
> 日付: 2026-03-24
> テスト対象: plan パイプライン（verify-before-display 統合後）
> エンドポイント: shogi-commentary-ai.vercel.app/api/explain

---

## 1. 不合法手テスト

### 1.1 正常ケース: 5局面の bestMove / meaningfulAlternative が合法か

| 局面 | bestMove | alternative | verify結果 | 合法性 |
|------|----------|------------|-----------|--------|
| pos-001 | ▲7八金 (6i7h) | ▲3八銀 or ▲2六歩 | **passed** | 全て合法 |
| pos-002 | ▲2四歩打 (P*2d) | ▲6四角打 (B*6d) | **passed** | 全て合法 |
| pos-003 | ▲5一飛打 (R*5a) | なし（全候補同評価） | **issue: facts外座標** | 手自体は合法（後述） |
| pos-004 | ▲2二角成 (8h2b+) | ▲7七角 (7h7g) | **passed** | 全て合法 |
| pos-005 | ▲7四龍 (2d7d) | ▲3三龍 (2d3c) | **passed** | 全て合法 |

**結果**: 5局面すべてで bestMove / meaningfulAlternative は合法手。Plan 生成時に不合法手は含まれていない。

### 1.2 異常ケース: 意図的に不合法手を含むエンジンデータ

**テスト内容**: pos-001 の SFEN に対して、bestmove を `"1a1b"`（後手の香車がいる位置からの移動 = 先手番では不合法）、move_ja を `"▲不合法手"` として送信。

**結果**:
- Plan の bestMove に `"▲不合法手"` がそのまま設定された（**Planner は合法手チェックをしていない**）
- Gemini は不合法手を無視し、2番目の候補手（▲2六歩）を中心に解説を生成
- **Verifier が検出**: `"最善手 ▲不合法手 が出力に含まれていません"` → `passed: false`

**事実**: buildPlan() は候補手の合法性を検証するロジックを持っていない。不合法手がエンジンデータに含まれた場合、Plan にそのまま載る。

**解釈**: 現状では「エンジンデータは信頼できる」という前提で動いており、不合法手フィルタリングは Planner の責務外。Verifier が事後的に「bestMove が出力に含まれない」ことを検出するため、間接的な防御にはなっている。

**提案**: 将来的には Planner に合法手チェック（`applyMove()` で例外が出ないか検証）を追加すべき。MVP段階ではエンジンデータの信頼性で代替可能。

---

## 2. verify-before-display テスト

### 2.1 正常ケース: 解説本文が返り、verify イベントが送信されるか

| 局面 | 解説出力 | verify イベント | passed | issues |
|------|---------|---------------|--------|--------|
| pos-001 | 正常 | あり | **true** | [] |
| pos-002 | 正常 | あり | **true** | [] |
| pos-003 | 正常 | あり | **false** | `["plan.factsにない座標への言及: ３三"]` |
| pos-004 | 正常 | あり | **true** | [] |
| pos-005 | 正常 | あり | **true** | [] |

**結果**: 全5局面で解説本文がストリーミングで返り、最後に verify イベントが送信される。verify-before-display のフローは正常に動作。

### 2.2 pos-003 の verify issue 分析

**事実**: Gemini が「龍が３三の地点から睨んでいる」と出力。しかし `plan.facts` には龍の位置として `３三` が盤面座標として含まれているはず。

**調査**: pos-003 の SFEN `8k/7s1/6+R2/...` で、龍は 3c（３三、row=2, col=6）にいる。`findKings()` は玉位置のみ出力し、`buildForbiddenClaims()` は大駒位置を含む。facts に `３三` の座標が含まれるかは forbiddenClaims の文字列に依存。

**解釈**: verifier の `checkUnknownCoordinates()` が facts から座標を抽出する際、forbiddenClaims 内の座標は検索対象外である可能性。龍の位置「３三」は forbiddenClaims に含まれるが facts の文字列には含まれないため、「facts外座標」として検出された。

**影響**: false positive（偽陽性）。龍の位置言及は正しい将棋事実であり、verifier が誤検出している。

**提案**: `checkUnknownCoordinates()` で、`plan.forbiddenClaims` 内の座標も known として扱うべき。

### 2.3 クライアント側の verify イベント処理

**事実**: `Chat.tsx` L145-158 で SSE イベントを処理しているが、`parsed.type === "verify"` のハンドラーがない。verify イベントは受信されるが無視される。

**影響**: verifier が issues を検出しても、ユーザーに表示されない。現状は「サイレント検証」状態。

**提案**: verify の issues がある場合にユーザーに注記を表示する UI を追加すべき（例: 「この解説には検証で指摘された点があります」）。MVP後の対応で可。

---

## 3. Truncation テスト

### 3.1 テスト環境の制約

MAX_TOKENS はサーバーサイド定数（`client.ts` L21: `export const MAX_TOKENS = 4096`）であり、デプロイ環境では動的に変更できない。ローカル環境でのテストが必要。

### 3.2 コードレベルの確認

| チェック項目 | 結果 |
|------------|------|
| MAX_TOKENS の値 | 4096（十分に大きい。通常の解説は200-400文字≈200-400トークン程度） |
| ストリーム途中エラーのハンドリング | route.ts L155-164: catch → `type: "error"` イベント送信 |
| クライアント側のエラー表示 | Chat.tsx L157-158: `type: "error"` → `setError()` |
| Truncation 専用の fallback | **なし** — ストリームが途中で終了した場合、[DONE] が送信されるだけ |

**事実**: 出力がトークン上限に達した場合:
1. Gemini SDK がストリームを正常終了する（例外ではない）
2. route.ts は通常通り `[DONE]` を送信
3. verifier が実行され、不完全な出力に対して検証が走る
4. 不完全な出力であることをユーザーに通知する仕組みはない

**提案**: ストリーム終了時に `fullOutput` の末尾が文の途中かどうかを簡易チェックし（例: `。` で終わっていない場合）、truncation の可能性を verify イベントの issues に追加する。

---

## 4. 総合判定

### Trust Gate の機能状態

| 機能 | 実装状態 | 動作確認 |
|------|---------|---------|
| verifier の API 統合 | **済** | route.ts L141-151 |
| verify イベントの送信 | **済** | 全5局面で確認 |
| bestMove 言及チェック | **済** | 不合法手テストで検出を確認 |
| 評価値数字漏出チェック | **済** | 5局面で全 passed |
| forbiddenClaims チェック | **済** | 駒位置矛盾の検出ロジックあり |
| facts 外座標チェック | **済（偽陽性あり）** | pos-003 で forbiddenClaims 内の座標を未知扱い |
| クライアント側の verify 表示 | **未実装** | verify イベントを受信するが無視 |
| Planner の合法手チェック | **未実装** | エンジンデータの信頼性に依存 |
| Truncation 検出 | **未実装** | 不完全出力の通知なし |

### 対応優先度

| # | 項目 | 優先度 | 理由 |
|---|------|--------|------|
| T1 | forbiddenClaims 座標を known に含める | **高** | false positive の除去。pos-003 で不要な issue が出る |
| T2 | クライアント側の verify 表示 | **中** | ユーザーが検証結果を見られない |
| T3 | Truncation 検出 | **低** | MAX_TOKENS=4096 で実用上発生しにくい |
| T4 | Planner の合法手チェック | **低** | エンジンデータの信頼性で代替可能 |

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-03-24 | Trust Gate 検証完了（reviewer） |

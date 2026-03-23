# Day 2 振り返りレビュー — プロジェクトの穴チェック

> 担当: reviewer
> 日付: 2026-03-23
> 対象: src/ 配下の全ソースコード + 設定ファイル

---

## 1. セキュリティ

### 1.1 GEMINI_API_KEY の漏洩パス

| チェック項目 | 結果 | 根拠 |
|------------|------|------|
| `.env.local` が git に追跡されているか | **安全** | `.gitignore` に `.env*` パターンあり。`git ls-files` に env ファイルなし |
| API キーがクライアントバンドルに含まれるか | **安全** | `process.env.GEMINI_API_KEY` は `src/lib/ai/client.ts` のみで参照。このファイルは `src/app/api/explain/route.ts`（Route Handler = サーバーサイド）からのみ import。`NEXT_PUBLIC_` プレフィックスなし |
| API キーがレスポンスに含まれるか | **安全** | Route Handler のレスポンスはストリーミングテキストのみ。エラーメッセージにも API キーは含まれない |

**問題なし。**

### 1.2 入力バリデーション

| チェック項目 | 結果 | 詳細 |
|------------|------|------|
| `position` フィールドの検証 | **適切** | `typeof body.position !== "string"` チェック + `parseSfen()` でパース検証（route.ts L38-53） |
| `engineData` の型検証 | **不十分** | `body.engineData` は `EngineData` 型として受け取るが、ランタイムの型チェックなし。悪意あるクライアントが `eval: "malicious string"` を送信可能。ただし、この値は `buildUserMessage()` で文字列に埋め込まれるだけで、SQLやコマンド実行には使われない |
| `history` の長さ制限 | **なし** | `body.history` に上限なし。大量のメッセージを含むリクエストで Gemini API のトークン上限に達する可能性あり。DoS ベクトルにはなりうるが、Gemini API 側で拒否されるため致命的ではない |
| `question` フィールド | **最低限** | `string \| undefined` として扱われる。長さ制限なし |

**指摘 SEC-1（低）**: `history` に長さ上限（例: 20メッセージ）を設けるべき。現状は Gemini API のトークン制限に依存している。

**指摘 SEC-2（低）**: `engineData` のランタイム型チェックがない。MVP では許容だが、将来的にはzod等でバリデーションすべき。

### 1.3 XSS / インジェクション

| チェック項目 | 結果 | 根拠 |
|------------|------|------|
| `dangerouslySetInnerHTML` の使用 | **なし** | grep で 0 件 |
| ユーザー入力の直接 HTML 描画 | **安全** | Chat.tsx のメッセージ表示は `{msg.content}` で React の自動エスケープが適用。`whitespace-pre-wrap` で整形のみ |
| API レスポンスの直接描画 | **安全** | SSE チャンクは `JSON.parse` → `parsed.content` として取得し、React テキストノードとして描画 |

**問題なし。**

### 1.4 レート制限

**指摘 SEC-3（中）**: API Route にレート制限がない。Gemini API キーの使用量が外部から消費される可能性がある。Vercel の Edge Config や `next-rate-limit` 等での対策を検討すべき。MVP 段階では許容だが、公開後は対策が必要。

---

## 2. エラーハンドリング

### 2.1 API ダウン時のユーザー体験

| シナリオ | 処理 | 評価 |
|---------|------|------|
| Gemini API 接続エラー | route.ts L131-136: `catch(err)` → 500 + "Gemini APIの呼び出しに失敗しました" | **適切** |
| ストリーミング中のエラー | route.ts L110-119: `catch(err)` → `type: "error"` SSE イベント送信 | **適切** |
| クライアント側のエラー表示 | Chat.tsx L111-116: `res.ok` チェック → `setError()` で赤枠表示 | **適切** |
| ネットワークエラー | Chat.tsx L165-169: catch → "通信エラーが発生しました" | **適切** |

**問題なし。**

### 2.2 不正な SFEN/KIF 入力時

| シナリオ | 処理 | 評価 |
|---------|------|------|
| 不正な SFEN 文字列 | route.ts L48-53: `parseSfen` 例外 → 400 + パースエラーメッセージ | **適切** |
| クライアント側のリアルタイムパース | Chat.tsx L62-82: `parseSfen`/`kifToUsiMoves` で即時検証。エラーは `parseError` state で表示 | **適切** |
| パースエラーメッセージの質 | 「不正なSFEN形式です。最低3つの要素が必要です」等、具体的 | **良好** |

**問題なし。**

### 2.3 ストリーミング中断時

| シナリオ | 処理 | 評価 |
|---------|------|------|
| ユーザーが「中止」ボタン押下 | Chat.tsx L406-410: `abortRef.current?.abort()` で AbortController 使用 | **適切** |
| AbortError のハンドリング | Chat.tsx L166: `AbortError` は無視、他のエラーのみ表示 | **適切** |
| abort 後の state クリーンアップ | Chat.tsx L170-172: `finally` で `setLoading(false)` + `abortRef.current = null` | **適切** |

**問題なし。**

---

## 3. パフォーマンス

### 3.1 不必要な再レンダリング

| チェック項目 | 結果 | 詳細 |
|------------|------|------|
| `useMemo` の使用 | **適切** | `currentPosition` と `currentSfen` が `useMemo` で計算（Chat.tsx L36-44） |
| `useCallback` の使用 | **適切** | `streamResponse`, `handleStart`, `handleFollowUp`, `handleExplainAtMove` が `useCallback` |
| ストリーミング中の `setMessages` | **要注意** | 各 SSE チャンクごとに `setMessages` が呼ばれる（Chat.tsx L146-155）。チャンクが細かい場合、高頻度の re-render が発生する |

**指摘 PERF-1（低）**: ストリーミング中のメッセージ更新は、チャンクをバッファリングして一定間隔でまとめて反映する方が効率的。ただし現状のチャンク頻度では体感上の問題は小さい。MVP では許容。

### 3.2 バンドルサイズ

| 依存パッケージ | サイズ影響 | 備考 |
|-------------|----------|------|
| `@google/genai` | サーバーサイドのみ | Route Handler 内で使用。クライアントバンドルに含まれない |
| `next` | 標準 | App Router 使用 |
| `react` / `react-dom` | 標準 | |

**指摘 PERF-2（情報）**: `@google/genai` はサーバーサイドのみで使用されており、クライアントバンドルへの影響なし。バンドルサイズの懸念は特になし。

---

## 4. アクセシビリティ

### 4.1 盤面のスクリーンリーダー対応

**指摘 A11Y-1（中）**: `ShogiBoard.tsx` に `aria-label` や `role` 属性が一切ない。盤面は CSS sprite の背景画像で描画されているため、スクリーンリーダーが駒の情報を読み取れない。

対策案:
- 盤面の `div` に `role="img"` + `aria-label="将棋盤面: 先手玉5九、後手玉5一..."` を追加
- または `sr-only` クラスで盤面のテキスト表現を非表示で配置

### 4.2 キーボードナビゲーション

| 要素 | キーボード対応 | 評価 |
|------|-------------|------|
| テキスト入力 | `<textarea>` / `<input>` | **対応** — 標準のフォーカス |
| 「解説する」ボタン | `<button>` | **対応** |
| 手数ナビゲーション (◀ ▶) | `<button>` | **対応** — ただし `aria-label` なし |
| Enter キーで送信 | Chat.tsx L219-226 `handleKeyDown` | **対応** |

**指摘 A11Y-2（低）**: 手数ナビゲーションボタン（|◀ ◀ ▶ ▶|）に `aria-label` がない。スクリーンリーダーでは「ボタン: |◀」としか読み上げられない。`aria-label="最初の手に戻る"` 等を付与すべき。

---

## 5. コードの一貫性

### 5.1 未使用ファイル

**指摘 CODE-1（中）**: `src/components/ExplainForm.tsx` が未使用。

- このファイルは Day 1 で作成された初期フォームコンポーネント
- Day 2 で `Chat.tsx` に置き換えられたが、ファイルが残っている
- `grep -rn "ExplainForm" src/` の結果、どこからも import されていない
- 削除すべき

### 5.2 型定義の重複

**指摘 CODE-2（低）**: `Message` 型が2箇所で定義されている。

| ファイル | 型名 | フィールド |
|---------|------|----------|
| `src/app/api/explain/route.ts` L15-18 | `Message` | `role: "user" \| "assistant"`, `content: string` |
| `src/components/Chat.tsx` L10-13 | `ChatMessage` | `role: "user" \| "assistant"`, `content: string` |

内容は同一。共通の型を `src/lib/types.ts` 等に定義して共有すべき。

### 5.3 その他のコード品質

| チェック項目 | 結果 |
|------------|------|
| `boardToString` 関数（parser.ts L215-241） | 未使用の可能性。`buildBoardText`（prompt.ts L132-147）と類似機能が重複 |
| `PIECE_SYMBOL`（parser.ts L244）vs `getPieceSymbol`（prompt.ts L121） | 同じマッピングが2箇所に存在 |
| KIF パーサーの `v2参考` コメント（kif.ts L7） | clean-room 観点では問題ないが、「参考に実装」のコメントが残っている |

---

## 6. 指摘サマリー

| ID | カテゴリ | 深刻度 | 内容 | MVP対応 |
|----|---------|--------|------|--------|
| SEC-1 | セキュリティ | 低 | `history` に長さ上限なし | 推奨 |
| SEC-2 | セキュリティ | 低 | `engineData` のランタイム型チェックなし | MVP後 |
| SEC-3 | セキュリティ | 中 | API Route にレート制限なし | 公開前に対応 |
| PERF-1 | パフォーマンス | 低 | ストリーミング中の高頻度 re-render | MVP後 |
| A11Y-1 | アクセシビリティ | 中 | 盤面にaria属性なし | 推奨 |
| A11Y-2 | アクセシビリティ | 低 | ナビボタンにaria-labelなし | 推奨 |
| CODE-1 | コード品質 | 中 | `ExplainForm.tsx` が未使用 | 今すぐ削除可 |
| CODE-2 | コード品質 | 低 | Message型が2箇所で重複定義 | MVP後 |

### 今すぐ対応すべき

1. **CODE-1**: `ExplainForm.tsx` の削除（未使用ファイル）
2. **SEC-1**: `history` に上限追加（例: `if (body.history.length > 20) return 400`）

### 公開前に対応すべき

3. **SEC-3**: レート制限の追加
4. **A11Y-1**: 盤面のアクセシビリティ対応

### MVP後に対応

5. SEC-2, PERF-1, A11Y-2, CODE-2

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-03-23 | Day 2 振り返りレビュー作成（reviewer） |

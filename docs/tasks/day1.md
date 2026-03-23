# Day 1 タスク

> 作成: orchestrator
> 日付: 2026-03-23
> 方式: 2日完成 + 品質ゲート（DEC-008）

---

## Day 1 の目標

**基盤構築 + 解説エンジンの初版が動く状態にする**

Day 1終了時に「SFENを入れたら解説が返ってくる」が成立していること。
Day 2でUI・対話・デプロイ・品質ゲートに進むための土台。

---

## Day 1 達成条件

- [ ] エンジンデータ3局面が `data/prompt-examples/` に存在する
- [ ] 用語集初版が `data/glossary.json` に存在する
- [ ] SFENパーサーが動作する（テスト付き）
- [ ] 解説プロンプトv1が存在する
- [ ] 解説API（POST /api/explain）が動作する（SFEN → 解説テキスト）
- [ ] reviewerが3局面で初回検証を完了し、参考スコアが出ている

---

## タスク一覧

### TASK-001: エンジン事前計算データ 3局面分を作成
- **担当**: researcher
- **依存**: なし
- **優先度**: 最高（reviewer, builderがブロックされる）
- **完了条件**: `data/prompt-examples/` に3つのJSON（序盤・中盤・終盤 各1局面）
- **フォーマット**: `docs/architecture.md` の「エンジン事前計算データ」セクションに準拠
- **必須フィールド**: id, description, sfen, move_number, phase, engine_data (bestmove, eval, candidates 3手以上), expected_explanation_points
- **注意**: v2のデータファイルの中身はコピーしない

### TASK-002: 用語集初版を作成
- **担当**: researcher
- **依存**: なし
- **完了条件**: `data/glossary.json` に将棋基本用語20語以上
- **フォーマット**: `{ "term": "飛車", "reading": "ひしゃ", "explanation": "初心者向け説明", "category": "piece" }` の配列
- **スコープ**: 駒名、基本戦型名、囲い名、基本用語（王手、詰み等）

### TASK-003: SFENパーサーを実装
- **担当**: builder
- **依存**: なし（パーサー単体で先行実装可）
- **完了条件**: SFEN文字列 → 盤面・手番・持ち駒の構造化データに変換するTypeScript関数 + テスト
- **PR**: `feat/sfen-parser` → main
- **注意**: clean-room。v2のコードはコピーしない

### TASK-004: 解説プロンプトv1を作成
- **担当**: builder
- **依存**: TASK-001（テスト用だが、並行着手可）
- **完了条件**: `prompts/system-prompt-v1.md` に将棋解説用システムプロンプト
- **要件**:
  - 局面情報（SFEN構造化データ）を受け取り、平易な日本語で解説を生成
  - **初心者（ウォーズ5級〜3級）を想定**（`docs/explanation-quality.md` 参照）
  - 「なぜその手か」「他の手との違い」を説明する構造
- **PR**: `feat/prompt-v1` → main
- **注意**: v2のprompt文面はコピーしない

### TASK-005: 解説API（POST /api/explain）を実装
- **担当**: builder
- **依存**: TASK-003, TASK-004
- **完了条件**: SFEN/KIF入力 → Claude API呼び出し → ストリーミングで解説テキストを返すAPIルート
- **PR**: `feat/explain-api` → main（TASK-003, 004とまとめてもOK）

### TASK-006: 3局面でプロンプトv1を検証（参考値）
- **担当**: reviewer
- **依存**: TASK-001, TASK-004
- **完了条件**: `docs/reviews/day1-prompt-v1-check.md` に3軸評価
- **目的**: Day 1終了時点の品質の参考値を取る（合否判定はDay 2品質ゲートで行う）
- **手順**:
  1. TASK-001のエンジンデータを読む
  2. TASK-004のプロンプトで各局面を投げる
  3. 生成された解説をエンジンデータと照合して3軸採点

### TASK-007: decisions.md 運用 + Day 1記録
- **担当**: context-manager
- **依存**: なし
- **完了条件**: Day 1の決定事項がすべて `docs/decisions.md` に追記されている

---

## 依存関係

```
TASK-001 (researcher) ──→ TASK-006 (reviewer)
TASK-003 (builder)    ──→ TASK-005 (builder)
TASK-004 (builder)    ──→ TASK-005 (builder)
TASK-004 (builder)    ──→ TASK-006 (reviewer)
TASK-002 (researcher)     独立
TASK-007 (context-mgr)    独立
```

## 並行作業

- **即時着手**: TASK-001, TASK-002, TASK-003, TASK-004, TASK-007
- **TASK-003,004完了後**: TASK-005
- **TASK-001,004完了後**: TASK-006

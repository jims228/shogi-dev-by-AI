# Day 3 タスク

> 作成: orchestrator
> 日付: 2026-03-24
> 方式: DEC-014 に基づく v2 再設計（evidence-first 将棋学習エンジン）
> 前提: Day 2 品質ゲート C 判定達成（DEC-013）

---

## Day 3 の目標

**ExplanationPlan ベースの新パイプライン初期実装を完成させ、before/after で品質を比較する**

Day 3 終了時に:
1. CanonicalPosition + ExplanationPlan の型が定義されている
2. buildPlan() がエンジンデータから ExplanationPlan を生成する
3. プロンプトが plan-only で組み立てられる（LLM は verbalizer）
4. 軽量 Verifier が出力を検証する
5. 旧パイプラインとの before/after 評価が完了している

---

## Day 3 達成条件

- [ ] CanonicalPosition, ExplanationPlan の TypeScript 型が `src/lib/shogi/types.ts` に存在する
- [ ] buildPlan() が 5 テスト局面で ExplanationPlan を生成する（テスト付き）
- [ ] プロンプトが ExplanationPlan のみを入力として組み立てられる
- [ ] Verifier が bestmove 一致・評価値帯の整合性を検証する
- [ ] before/after 評価（旧 prompt vs plan-based prompt）の結果が出ている
- [ ] 知識カード初期セットが存在する
- [ ] plan-transition 評価基準が定義されている

---

## タスク一覧

### TASK-014: CanonicalPosition + ExplanationPlan 型定義
- **担当**: builder
- **依存**: なし
- **優先度**: 最高（後続タスクの基盤）
- **完了条件**: TypeScript 型定義 + ドキュメンテーション
- **要件**:
  - `CanonicalPosition`: SFEN から正規化された局面表現。盤面・手番・持ち駒・手数・フェーズを構造化
  - `ExplanationPlan`: 解説の中間表現。以下を含む:
    - bestmove（日本語表記）+ 評価値 + 評価値帯ラベル
    - 候補手リスト（日本語表記 + 評価値 + 比較ポイント）
    - 局面の特徴（フェーズ、戦型、注目ポイント）
    - 解説すべきポイントのリスト（教育的観点）
    - 玉の位置、詰み情報（該当時）
  - 型は `src/lib/shogi/types.ts` に追加
- **PR**: `feat/plan-types` → main
- **注意**: clean-room。v2 のコードはコピーしない。DEC-014 の方針に従う

### TASK-015: buildPlan() 最小実装
- **担当**: builder
- **依存**: TASK-014
- **完了条件**: エンジン事前計算データ（`data/prompt-examples/*.json`）から ExplanationPlan を生成する関数 + テスト
- **要件**:
  - 入力: CanonicalPosition + エンジンデータ（bestmove, eval, candidates, king_positions, move_ja, pv_ja 等）
  - 出力: ExplanationPlan
  - USI → 日本語変換は move_ja/pv_ja を利用（P1 の成果を活用）
  - 評価値 → 帯ラベル変換（+127 → 「少し有利」等。TASK-008B のガイドラインに準拠）
  - 5 テスト局面（pos-001〜005）すべてで動作するテスト
- **PR**: `feat/build-plan` → main

### TASK-016: prompt builder の plan-only 化
- **担当**: builder
- **依存**: TASK-015
- **完了条件**: ExplanationPlan のみを入力としてシステムプロンプトを組み立てる prompt builder
- **要件**:
  - LLM は「解説計画を自然な日本語にする verbalizer」として位置づける
  - プロンプトに生の SFEN や盤面テキストを直接渡さない
  - ExplanationPlan の構造化データをプロンプトに埋め込む
  - 既存の `src/lib/ai/prompt.ts` を拡張または置換
  - 既存の `/api/explain` ルートとの互換性を維持
- **PR**: `feat/plan-prompt` → main

### TASK-017: lightweight verifier
- **担当**: builder
- **依存**: TASK-016
- **完了条件**: LLM 出力を ExplanationPlan と照合して検証する軽量 Verifier
- **要件**:
  - bestmove が解説文中に正しく言及されているか
  - 評価値帯の表現が plan と整合しているか
  - 候補手の比較が plan の情報と矛盾していないか
  - 検証結果を構造化データで返す（pass/fail + 理由）
  - **LLM 呼び出しなし**（文字列マッチングとルールベースで実装）
- **PR**: `feat/verifier` → main

### TASK-018: 最小統合 + before/after 評価
- **担当**: builder（統合）+ reviewer（評価）
- **依存**: TASK-017
- **完了条件**:
  1. 新パイプライン（Canonicalize → Plan → Verbalize → Verify）がエンドツーエンドで動作
  2. 5 テスト局面で旧パイプラインと新パイプラインの解説を比較
  3. `docs/reviews/day3-before-after.md` に 3 軸評価の比較結果
- **手順**:
  1. builder: 新パイプラインを `/api/explain` に統合（旧パイプラインは切り替え可能に保持）
  2. reviewer: 同じ 5 局面で旧/新の解説を 3 軸採点
  3. reviewer: Verifier の検証結果も報告に含める
- **PR**: `feat/plan-integration` → main（builder）、`review/day3-before-after` → main（reviewer）

### TASK-019: 知識カード初期セット
- **担当**: researcher
- **依存**: なし（並行可）
- **完了条件**: `data/knowledge-cards/` に将棋の概念・戦型・囲いの知識カード（JSON）
- **要件**:
  - DEC-014 の「将棋学習エンジン」に必要な教育コンテンツ
  - 戦型（矢倉、四間飛車、角換わり等）の基本概念カード
  - 囲い（矢倉囲い、美濃囲い、穴熊等）の特徴カード
  - 初心者向けの「よくある間違い」カード
  - フォーマット: `{ "id": "...", "category": "...", "title": "...", "level": "beginner", "content": "..." }`
  - 最低 10 枚
- **注意**: v2 のデータファイルの中身はコピーしない

### TASK-020: plan-transition 評価基準
- **担当**: reviewer
- **依存**: なし（並行可）
- **完了条件**: `docs/reviews/plan-transition-criteria.md` に新パイプラインの評価基準を定義
- **要件**:
  - 既存の 3 軸（正確性・分かりやすさ・具体性）に加え、plan-based パイプライン固有の評価観点:
    - ExplanationPlan の網羅性（エンジンデータの重要情報がplan に含まれているか）
    - Verbalizer の忠実性（plan の内容が解説文に正確に反映されているか）
    - Verifier の検出精度（誤りを検出できるか、過検出はないか）
  - TASK-018 の before/after 評価で使用する
  - DEC-004 の合格ライン（3 軸すべて 3.0 以上）は維持

---

## 依存関係

```
TASK-014 (型定義)
    └──→ TASK-015 (buildPlan)
            └──→ TASK-016 (plan-only prompt)
                    └──→ TASK-017 (verifier)
                            └──→ TASK-018 (統合 + before/after)

TASK-019 (知識カード)        独立（並行可）
TASK-020 (評価基準)          独立（並行可）
```

## 並行作業

- **即時着手**: TASK-014, TASK-019, TASK-020
- **TASK-014 完了後**: TASK-015
- **TASK-015 完了後**: TASK-016
- **TASK-016 完了後**: TASK-017
- **TASK-017 完了後**: TASK-018

---

## DEC-014 との対応

| DEC-014 方針 | Day 3 タスク |
|-------------|-------------|
| LLM は verbalizer に落とす | TASK-016 |
| ExplanationPlan を中核の中間表現に | TASK-014, TASK-015 |
| Q&A は plan-grounded に | Day 3 スコープ外（Day 4 以降） |
| 軽量 Verifier を必ず入れる | TASK-017 |
| 初期実装は 4-5 段の細い縦切り | TASK-018（Canonicalize → Plan → Verbalize → Verify） |

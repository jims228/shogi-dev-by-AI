# Review Mode 品質監査レポート

> 担当: reviewer
> 日付: 2026-03-25
> 対象: data/audit/review-trace-case1〜5.json
> コード: src/lib/ai/mistake-planner.ts, prompt.ts (buildMistakeReviewPrompt), review-move/route.ts

---

## 判定: Option 2（template-first + naturalizer）を推薦

**根拠**: 5ケース中4ケースで LLM が plan にない因果を創作。根本原因は whyChains の薄さと prompt の広さの複合。template-first で構造を制御し、LLM は表現の自然化のみに限定すべき。

---

## 1. ケース別分析

### case1: ▲3八銀 → ▲7八金（序盤、eval差 84cp）

**plan の内容（推定）**:
- whyChains: fallback「手の方向性: この手は悪くはないですが、最善手の方がより効率的に駒を活用できます」（confidence: low）
- betterIdea: ▲7八金「左金を7八に上がる。角頭を守りつつ、玉の囲い入りを準備する手」

**LLM 出力の問題点**:
- 「少し柔軟性に欠ける可能性があります」— **facts にない**。Plan は柔軟性について何も言っていない
- 「将来的に玉の周りの守りのバランスが少し悪くなるかもしれません」— **facts にない因果**。kingSafety の diff は検出されていない（fallback chain になっている時点で有意差なし）
- 「入城（にゅうじょう）をスムーズに行うことができます」— **facts にない**。入城は plan.facts にも whyChains にも含まれていない

**分類**: A（whyChain が fallback で空虚）+ C（LLM が3つの因果を創作）+ D（verifier が通過）

---

### case2: ▲2六歩 → ▲7八金（序盤、eval差 24cp）

**plan の内容（推定）**:
- whyChains: 同じ fallback（差が小さすぎて kingSafety/material で検出不能）
- eval 差はたった 24cp（ほぼ互角）

**LLM 出力の問題点**:
- 「玉を守る手を優先する方が、効率的に駒を活用できるため、**形勢に差が生まれるのです**」— eval 差 24cp（互角圏内）を「形勢に差が生まれる」は**過大表現**。plan の facts にも eval 差の表現はない
- 「安心して攻めを組み立てられます」— **facts にない**。bestMove.description にもない因果

**将棋的妥当性の問題**: ▲2六歩（+103）は定跡的に非常にまっとうな手。▲7八金（+127）との差はほぼなく、「もったいない手」と評するのは**誤解を招く**。序盤3手目で24cpの差は実質的に方針の違いであり、優劣ではない。

**分類**: A（eval差が微小であることを plan が伝えていない）+ B（prompt が「差がついた理由」を必ず書かせる構造）+ C（24cp を「形勢の差」に誇張）

---

### case3: ▲5八玉 → ▲7八金（序盤）

**LLM 出力の問題点**:
- 「同時に自分の角の頭の守りも強化できます」— bestMove.description から推論。whyChains にはないが**将棋事実としては正しい**
- 全体的に抑制的で、facts にない因果の追加が少ない

**分類**: C（軽微 — 正しい事実だが whyChains 外からの取得）。5ケース中最も品質が高い。

---

### case4: 8h6f → ▲2四歩打（中盤、pos-002）

**重大問題**: reviewedMove `8h6f` は**不合法手**。

**事実**:
- pos-002 の 8h には**先手の玉（K）**がいる
- 8h→6f は2マス対角移動で、玉の合法着手ではない
- planner の `isLegalMove()` がこれを検出すべきだが、outputType が "text"（通過）

**LLM 出力の問題点**:
- 「6六飛（ろくろくひ）」— **駒種が完全に間違い**。8h は玉なのに飛車と出力。usiToJapanese が8hの駒を正しく取れなかった、またはLLMが勝手に推測
- 「飛車がすぐに攻めに参加しづらく」「攻めが遅れ、玉の周りの守りが手薄になってしまう」— 全て**存在しない手についての架空の分析**
- 日本語読みが「ろくろくひ」（意味不明）

**分類**: A（planner が illegal move を通した — isLegalMove のバグまたは未実行）+ C（LLM が架空の手の分析を全文創作）+ D（verifier が駒種誤認を検出できない）

---

### case5: R*5b → R*5a（終盤、詰み局面）

**LLM 出力の問題点**:
- 「R*5b (5二に飛車を打つ手)」— **USI 記法がそのまま出力**。plan の reviewedMove.ja が未設定の場合、USI がそのまま流れる
- 「相手の玉にはまだ逃げるためのスペースが残っています」— **whyChains にない**。mate の whyChain は正しい手順（▲5一飛打→△1二玉→▲2四桂打）のみを含み、R*5b がなぜダメかは説明していない
- 「先手の勝ちが確定していました（詰みがあります）」— plan の事実に基づいており正確

**分類**: A（reviewedMove.ja 未生成、whyChain がユーザーの手の問題点を説明しない）+ C（「逃げるスペース」は正しいが facts 外）+ D（USI 記法漏出を未検出）

---

## 2. 失敗の分類集計

| 分類 | 内容 | 該当ケース | 件数 |
|------|------|-----------|------|
| **A: planner facts 不足/誤り** | whyChains が fallback、eval差の表現なし、illegal move 未検出、ja 未生成 | case1,2,3,4,5 | **5/5** |
| **B: prompt が広すぎる** | 「なぜ差がついたか」を必ず書かせる構造が、差がない場合にも LLM に因果創作を強制 | case1,2 | **2/5** |
| **C: LLM の semantic leap** | facts にない因果（柔軟性、守りのバランス、形勢差、架空の手の分析）を創作 | case1,2,4,5 | **4/5** |
| **D: verifier miss** | 駒種誤認、USI漏出、ungrounded causal claims を検出できない | case1,2,4,5 | **4/5** |

---

## 3. 最も多い失敗パターン

### パターン1:「薄い whyChain + 広い prompt → LLM が因果を創作」（case1, 2, 5）

```
buildWhyChains() → kingSafety/material の差が小さい → fallback chain
→ prompt: 「なぜ差がついたか」を書け
→ LLM: facts にない因果を発明して埋める
→ verifier: 因果の妥当性を検証するロジックがない → passed
```

**根本原因**: whyChains の fallback が `confidence: low` の1文しかなく、LLM に渡す「材料」が空虚。しかし prompt は「なぜ差がついたか（2-3文、因果を具体的に）」を要求するため、LLM は材料がなくても書く。

### パターン2:「不合法手が Planner を素通り」（case4）

```
reviewedMove = "8h6f" → isLegalMove() → ??? → plan に載る
→ LLM: 架空の手の分析を全文創作
```

**根本原因**: case4 の illegal move が通過した理由は不明（isLegalMove のバグか、特定の入力パターンで例外が発生してスキップされた可能性）。

### パターン3:「reviewedMove の日本語名が未生成」（case4, 5）

```
reviewedMove.ja が undefined → usiToJapanese() が null → LLM が USI から推測
→ 「6六飛」（実際は玉）、「R*5b」（USI そのまま）
```

**根本原因**: `usiToJapanese()` が不合法手や特殊な入力でnullを返す。plan.context.reviewedMove.ja がない場合の fallback が USI そのまま。

---

## 4. 症状ごとの root cause

| 症状 | root cause | 修正箇所 |
|------|-----------|---------|
| LLM が facts にない因果を書く | whyChain が空虚 + prompt が「因果を書け」と要求 | planner (whyChain拡充) + prompt (template制約) |
| 24cp の差を「形勢に差」と誇張 | eval 差の大小が plan に含まれない | planner (eval差の大きさをfactsに含める) |
| 不合法手が通過 | isLegalMove のバグまたは例外スキップ | mistake-planner (isLegalMove の修正/テスト追加) |
| 駒種の誤認（玉→飛車） | usiToJapanese が失敗 + LLM が推測 | notation.ts (usiToJapanese の修正) + prompt (推測禁止) |
| USI 記法漏出 | reviewedMove.ja が null のまま prompt に流れる | prompt.ts (ja がない場合に USI を出さずエラーにする) |
| verifier が因果創作を見逃す | verifier は形式チェックのみ | verifier 拡張は困難（意味的検証は LLM が必要） |

---

## 5. 推奨方針

### Option 1: prompt 改善で継続

**メリット**: 最小の実装コスト
**デメリット**: whyChain が薄い問題は prompt では解決不能。LLM に「書くな」と言っても、材料がなければ創作する。特に case1/2 のような「差がほとんどない」ケースでは構造的に破綻する。

**判定**: 不採用。根本原因が planner の情報量不足にある以上、prompt だけでは解決しない。

### Option 2: template-first + LLM は naturalizer only

**メリット**:
- テンプレートが構造と主張を制御するため、LLM の semantic leap を構造的に防げる
- whyChain が薄い場合はテンプレートが「差は小さいです」と正直に書ける
- LLM は文章の自然化のみ → 事実の追加/変更は行わない
- verifier の負荷が軽減（テンプレート出力は検証が容易）

**デメリット**:
- テンプレート作成の初期コスト
- NarrativeRole × phase の組み合わせ分のテンプレートが必要

**判定**: **推薦**。以下の根拠:
1. 5ケース中4ケースの失敗は「LLM に意味生成を許した」ことが直接原因
2. case3（最良ケース）でさえ whyChains 外の情報を取得している
3. template なら eval 差が小さい場合に「ほぼ同じ強さの手です。方針の違いです」と正直に書ける — これは prompt 改善では実現困難

### Option 3: LLM を一旦外して完全テンプレート出力

**メリット**: LLM の semantic leap が完全に排除される。検証が容易。コスト0。
**デメリット**: 出力が機械的で初心者に親しみにくい。用語補足の柔軟性がない。

**判定**: 不採用。ただし**段階的に Option 2 に移行する際の中間ステップとしては有効**。まずテンプレート出力で品質のベースラインを確認し、その後 naturalizer を追加する。

---

## 6. 推薦: Option 2 の具体的な実装方針

### Step 1: テンプレート層の追加

```
whyChains + facts → Template Engine → 構造化テキスト
→ Naturalizer (LLM) → 自然な日本語
→ Verifier → 出力
```

### Step 2: テンプレートのルール

| 条件 | テンプレートの振る舞い |
|------|---------------------|
| eval 差 ≤ 50cp | 「ほぼ同じ強さの手です。方針の違いなので、どちらも悪くありません」 |
| eval 差 50-200cp | 「少しもったいなかったかもしれません」+ whyChain の statement を展開 |
| eval 差 200cp+ | 「はっきり差がつく手でした」+ whyChain の statement を展開 |
| mate 局面 | 詰み手順をテンプレートで1手ずつ展開 |
| whyChain が fallback のみ | **因果を書かない**。「より効率的な手がありました」+学びのポイントのみ |

### Step 3: Naturalizer への指示

```
以下のテンプレート出力を、初心者に親しみやすい日本語に書き換えてください。
ただし:
- 事実を追加しないでください
- 因果関係を変えないでください
- 用語に括弧で補足を付けてください
- 「です/ます」調で統一してください
```

### Step 4: 即座に対応すべき問題（Option 2 以前）

| # | 問題 | 対応 |
|---|------|------|
| F1 | isLegalMove が不合法手を通す | mistake-planner のテスト追加 + バグ修正 |
| F2 | usiToJapanese が null 時に USI が漏出 | prompt.ts で ja がない場合に「（手の名前を表示できません）」と出す |
| F3 | eval 差が小さい場合の誇張表現 | planner に eval 差の大きさを facts に含める |

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-03-25 | review mode 品質監査完了。Option 2 推薦（reviewer） |

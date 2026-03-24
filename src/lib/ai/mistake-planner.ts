/**
 * MistakeReviewPlan のルールベース生成
 *
 * ユーザーの手と最善手を比較し、差の因果を分析して MistakeReviewPlan を構築する。
 */

import type { CanonicalPosition } from "../shogi/canonical";
import type { SfenPosition } from "../shogi/types";
import { estimatePhase } from "../shogi/parser";
import { applyMove } from "../shogi/move";
import { kingSafety, materialBalance } from "../shogi/features";
import { isLegalMove } from "../shogi/legality";
import { usiToJapanese } from "../shogi/notation";
import type { EngineData } from "./prompt";
import { verbalizeEval } from "./planner";
import type {
  MistakeReviewPlan,
  WhyChain,
  WhyLink,
  NarrativeRole,
  ContextWindow,
} from "./plan";

interface MoveInput {
  usi: string;
  ja?: string;
}

function toSfenPosition(pos: CanonicalPosition): SfenPosition {
  return {
    board: pos.board,
    turn: pos.turn,
    senteHand: pos.hands.sente,
    goteHand: pos.hands.gote,
    moveNumber: pos.moveNumber,
  };
}

/**
 * 悪手レビュー計画を生成する
 */
export function buildMistakeReviewPlan(
  position: CanonicalPosition,
  userMove: MoveInput,
  bestMove: MoveInput,
  engineData?: EngineData
): MistakeReviewPlan {
  const sfenPos = toSfenPosition(position);
  const phase = estimatePhase(position.moveNumber);
  const turn = position.turn;

  // --- 盤面照合: reviewedMove ---
  let failReason: MistakeReviewPlan["failReason"] = undefined;

  // 日本語名を盤面から自動補完
  if (!userMove.ja) {
    const ja = usiToJapanese(sfenPos, userMove.usi);
    if (ja) {
      userMove = { ...userMove, ja };
    }
  }

  // 合法性チェック
  if (!isLegalMove(sfenPos, userMove.usi)) {
    failReason = "illegal_move";
  }

  // --- 盤面照合: bestMove ---
  if (!bestMove.ja) {
    const ja = usiToJapanese(sfenPos, bestMove.usi);
    if (ja) {
      bestMove = { ...bestMove, ja };
    }
  }

  if (bestMove.usi && !isLegalMove(sfenPos, bestMove.usi)) {
    failReason = failReason ?? "best_move_mismatch";
  }

  // 2局面を生成: userMove 適用後と bestMove 適用後
  let afterUser: SfenPosition | null = null;
  let afterBest: SfenPosition | null = null;
  if (!failReason) {
    try {
      afterUser = applyMove(sfenPos, userMove.usi);
    } catch { /* invalid move */ }
    try {
      afterBest = applyMove(sfenPos, bestMove.usi);
    } catch { /* invalid move */ }
  }

  // mate 検出: PV を主役にする
  const isMate = engineData?.eval_type === "mate";

  // 特徴量の差分
  const diffs = computeDiffs(sfenPos, afterUser, afterBest, turn);

  // WhyChains の生成（mate 時は PV ベース）
  const whyChains = isMate && engineData
    ? buildMateWhyChains(engineData)
    : buildWhyChains(diffs);

  // NarrativeRole の判定
  const narrativeRole = isMate ? "missed_tactic" as NarrativeRole : determineNarrativeRole(diffs);

  // ContextWindow
  const context: ContextWindow = {
    previousMoves: position.moveHistory.slice(-3),
    reviewedMove: { usi: userMove.usi, ja: userMove.ja },
    phase,
    narrativeRole,
  };

  // betterIdea
  const bestMoveJa = bestMove.ja ?? engineData?.bestmove_ja ?? bestMove.usi;
  const bestCandidate = engineData?.candidates?.[0];
  let betterReason = bestCandidate?.description ?? "エンジンが最善と評価しています";
  if (isMate && engineData) {
    const mateIn = Math.abs(engineData.eval);
    betterReason = `${mateIn}手で詰みます。${betterReason}`;
  }
  const betterIdea = {
    usi: bestMove.usi,
    ja: bestMoveJa,
    reason: betterReason,
    evalExpression: engineData
      ? verbalizeEval(engineData.eval, engineData.eval_type)
      : undefined,
  };

  // nextLookFor (mate 時は詰みに特化)
  const nextLookFor = isMate
    ? "相手の玉の逃げ道を全部塞げる駒の打ち場所を探しましょう。飛車や角で横や縦を封鎖できないか確認してください"
    : generateNextLookFor(narrativeRole);

  // retryQuestion
  const retryQuestion = generateRetryQuestion(narrativeRole, userMove, bestMove);

  // facts (既存ロジック流用の簡易版)
  const facts = buildSimpleFacts(position, diffs);

  // forbiddenClaims
  const forbiddenClaims = [
    "評価値の数字（+127等）を直接言わない",
    "ユーザーを責めない（「ダメな手」ではなく「もったいない手」等）",
  ];

  // confidence (failReason がある場合は low に強制)
  const confidence: "high" | "medium" | "low" = failReason
    ? "low"
    : engineData
      ? afterUser && afterBest ? "high" : "medium"
      : "low";

  return {
    audience: "beginner",
    context,
    whyChains,
    betterIdea,
    keyTerms: [],
    nextLookFor,
    retryQuestion,
    confidence,
    forbiddenClaims,
    facts,
    failReason,
  };
}

// ============================================================
// 差分分析
// ============================================================

interface FeatureDiffs {
  kingSafetyDelta: number;   // 正: userMoveの方が玉が危険
  materialDelta: string;     // 駒割りの変化
  userMaterialBetter: boolean;
  bestMaterialBetter: boolean;
  kingSafetyUserLabel: string;
  kingSafetyBestLabel: string;
}

function computeDiffs(
  before: SfenPosition,
  afterUser: SfenPosition | null,
  afterBest: SfenPosition | null,
  turn: string
): FeatureDiffs {
  const color = turn as "b" | "w";

  const safetyBefore = kingSafety(before.board, color).score;
  const safetyAfterUser = afterUser ? kingSafety(afterUser.board, color).score : safetyBefore;
  const safetyAfterBest = afterBest ? kingSafety(afterBest.board, color).score : safetyBefore;

  const matUser = afterUser
    ? materialBalance(afterUser.board, afterUser.senteHand, afterUser.goteHand)
    : "不明";
  const matBest = afterBest
    ? materialBalance(afterBest.board, afterBest.senteHand, afterBest.goteHand)
    : "不明";

  return {
    kingSafetyDelta: safetyAfterBest - safetyAfterUser,
    materialDelta: matUser !== matBest ? `${matUser} → ${matBest}` : "変化なし",
    userMaterialBetter: false,
    bestMaterialBetter: matUser !== matBest && matBest.includes("互角") && !matUser.includes("互角"),
    kingSafetyUserLabel: afterUser ? kingSafety(afterUser.board, color).label : "不明",
    kingSafetyBestLabel: afterBest ? kingSafety(afterBest.board, color).label : "不明",
  };
}

// ============================================================
// WhyChains の生成
// ============================================================

/**
 * mate 局面用: PV を WhyChain に展開する
 */
function buildMateWhyChains(engineData: EngineData): WhyChain[] {
  const pvMoves = engineData.pv_ja ?? engineData.pv ?? [];
  const mateIn = Math.abs(engineData.eval);

  if (pvMoves.length === 0) {
    return [{
      topic: `${mateIn}手詰み`,
      links: [{
        kind: "local_fact",
        statement: `${mateIn}手で詰みがあります`,
        confidence: "high",
      }],
    }];
  }

  const links: WhyLink[] = pvMoves.map((move, i) => ({
    kind: "local_fact" as const,
    statement: i === pvMoves.length - 1
      ? `${move}で詰み`
      : i % 2 === 0
        ? `${move}で逃げ道を封鎖`
        : `${move}と逃げるしかないが`,
    confidence: "high" as const,
  }));

  return [{
    topic: `${mateIn}手詰みの手順`,
    links,
  }];
}

function buildWhyChains(diffs: FeatureDiffs): WhyChain[] {
  const chains: WhyChain[] = [];

  // 玉安全度の差が大きい場合
  if (diffs.kingSafetyDelta > 10) {
    const links: WhyLink[] = [
      {
        kind: "king_safety",
        statement: `この手を指すと玉の安全度が下がります（${diffs.kingSafetyUserLabel}）`,
        evidence: `最善手なら${diffs.kingSafetyBestLabel}を維持できます`,
        confidence: "medium",
      },
    ];
    chains.push({ topic: "玉の安全", links });
  }

  // 駒割りに変化がある場合
  if (diffs.materialDelta !== "変化なし") {
    const links: WhyLink[] = [
      {
        kind: "exchange",
        statement: `駒の損得に差が出ます（${diffs.materialDelta}）`,
        confidence: "medium",
      },
    ];
    chains.push({ topic: "駒の損得", links });
  }

  // 何も検出できなかった場合のフォールバック
  if (chains.length === 0) {
    chains.push({
      topic: "手の方向性",
      links: [{
        kind: "lesson",
        statement: "この手は悪くはないですが、最善手の方がより効率的に駒を活用できます",
        confidence: "low",
      }],
    });
  }

  return chains.slice(0, 2); // 最大2チェーン
}

// ============================================================
// NarrativeRole の判定
// ============================================================

function determineNarrativeRole(diffs: FeatureDiffs): NarrativeRole {
  // 玉安全度が大幅に下がった → king_exposed
  if (diffs.kingSafetyDelta > 20) return "king_exposed";

  // 駒割りが悪化 → bad_exchange
  if (diffs.materialDelta !== "変化なし" && !diffs.userMaterialBetter) {
    return "bad_exchange";
  }

  // 判定不能 → slow_move
  return "slow_move";
}

// ============================================================
// nextLookFor / retryQuestion テンプレート
// ============================================================

const NEXT_LOOK_FOR: Record<NarrativeRole, string> = {
  missed_defense: "相手の攻め駒が自分の玉に近づいている時は、まず守りを確認しましょう",
  overattack: "攻める前に、自分の玉の守りが十分か確認しましょう",
  bad_exchange: "駒を交換する前に、取り返した後の駒の価値を比べましょう",
  slow_move: "複数の手が指せる場面では、攻めと守りのどちらが急務か考えましょう",
  king_exposed: "玉の周りの守り駒が減る手は、相手に攻められやすくなります",
  missed_tactic: "相手の駒の利きと、自分の駒の利きが重なる地点に注目しましょう",
};

function generateNextLookFor(role: NarrativeRole): string {
  return NEXT_LOOK_FOR[role];
}

function generateRetryQuestion(
  role: NarrativeRole,
  userMove: MoveInput,
  bestMove: MoveInput
): string {
  const userJa = userMove.ja ?? userMove.usi;
  const bestJa = bestMove.ja ?? bestMove.usi;
  return `${userJa}と${bestJa}を比べたとき、盤面のどこに一番大きな違いが生まれるでしょうか？`;
}

// ============================================================
// facts 生成（簡易版）
// ============================================================

function buildSimpleFacts(
  position: CanonicalPosition,
  diffs: FeatureDiffs
): string[] {
  const facts: string[] = [];
  const phase = estimatePhase(position.moveNumber);

  facts.push(`手番: ${position.turn === "b" ? "先手" : "後手"}`);
  facts.push(`手数: ${position.moveNumber}`);
  facts.push(`フェーズ: ${phase === "opening" ? "序盤" : phase === "middle" ? "中盤" : "終盤"}`);
  facts.push(`自玉の安全度（この手を指した場合）: ${diffs.kingSafetyUserLabel}`);
  facts.push(`自玉の安全度（最善手の場合）: ${diffs.kingSafetyBestLabel}`);

  if (diffs.materialDelta !== "変化なし") {
    facts.push(`駒割りの変化: ${diffs.materialDelta}`);
  }

  return facts;
}

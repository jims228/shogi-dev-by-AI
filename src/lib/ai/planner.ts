/**
 * ExplanationPlan のルールベース生成
 *
 * CanonicalPosition + EngineData → ExplanationPlan を構築する。
 * LLMは使わず、盤面事実とエンジンデータから機械的に生成する。
 */

import type { CanonicalPosition } from "../shogi/canonical";
import type { Board, BoardPiece, Hand, AnyPieceType, PieceType, Color } from "../shogi/types";
import { PIECE_NAMES, COLOR_NAMES } from "../shogi/types";
import { estimatePhase } from "../shogi/parser";
import type { EngineData, EngineCandidate } from "./prompt";
import type { ExplanationPlan, FocusCategory } from "./plan";
import { kingSafety, materialBalance, attackMap } from "../shogi/features";

/**
 * 評価値を初心者向けの日本語表現に変換する
 */
export function verbalizeEval(evalValue: number, evalType?: string): string {
  if (evalType === "mate") {
    const mateIn = Math.abs(evalValue);
    const side = evalValue >= 0 ? "先手" : "後手";
    return `${side}の勝ち確定（${mateIn}手詰み）`;
  }

  const abs = Math.abs(evalValue);
  const side = evalValue >= 0 ? "先手" : "後手";

  if (abs < 100) return "ほぼ互角";
  if (abs < 300) return `少し${side}が有利`;
  if (abs < 600) return `${side}が有利`;
  if (abs < 1000) return `かなり${side}が有利`;
  return `はっきり${side}の勝勢`;
}

/** エンジンデータJSON にある拡張フィールド（API経由では渡されない） */
export interface ExtendedEngineData extends EngineData {
  common_mistake?: string;
  learning_point?: string;
  verification_note?: string;
}

/** 筋の数字表記 (col=0→9筋, col=8→1筋) */
const FILE_NAMES = ["９", "８", "７", "６", "５", "４", "３", "２", "１"];
/** 段の漢数字表記 (row=0→一段, row=8→九段) */
const RANK_NAMES = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

function describeSquare(row: number, col: number): string {
  return `${FILE_NAMES[col]}${RANK_NAMES[row]}`;
}

function describeArea(row: number, col: number): string {
  let area: string;
  if (row <= 2) {
    area = col <= 2 ? "盤の右上" : col >= 6 ? "盤の左上" : "盤の上部中央";
  } else if (row >= 6) {
    area = col <= 2 ? "盤の右下" : col >= 6 ? "盤の左下" : "盤の下部中央";
  } else {
    area = col <= 2 ? "盤の右側" : col >= 6 ? "盤の左側" : "盤の中央";
  }
  return `${describeSquare(row, col)}（${area}）`;
}

const HAND_ORDER: PieceType[] = ["R", "B", "G", "S", "N", "L", "P"];

function formatHand(hand: Hand): string {
  const parts: string[] = [];
  for (const pt of HAND_ORDER) {
    const count = hand[pt];
    if (count && count > 0) {
      parts.push(count > 1 ? `${PIECE_NAMES[pt]}${count}` : PIECE_NAMES[pt]);
    }
  }
  return parts.length > 0 ? parts.join(" ") : "なし";
}

/**
 * ExplanationPlan を生成する
 */
export function buildPlan(
  position: CanonicalPosition,
  engineData?: EngineData | ExtendedEngineData
): ExplanationPlan {
  const phase = estimatePhase(position.moveNumber);
  const isMate = engineData?.eval_type === "mate";
  const evalAbs = engineData ? Math.abs(engineData.eval) : 0;

  // --- 1. Focus 選定 ---
  const focus = selectFocus(phase, isMate, engineData);

  // --- 2. Facts 生成 ---
  const facts = buildFacts(position, engineData);

  // --- 3. bestMove (mate時はpv_jaを必ず設定) ---
  const bestMove = buildBestMove(engineData, isMate);

  // --- 4. meaningfulAlternative ---
  const alt = selectAlternative(engineData);

  // --- 5. commonMistake ---
  const ext = engineData as ExtendedEngineData | undefined;
  const commonMistake = ext?.common_mistake
    ? { ja: ext.common_mistake, whyTempting: "一見よさそうに見えるため", whyBad: ext.common_mistake }
    : undefined;

  // --- 6. forbiddenClaims ---
  const forbidden = buildForbiddenClaims(position);

  // --- 7. teachingPoint / retryQuestion ---
  const teachingPoint = ext?.learning_point ?? "この局面固有の学びを1つ伝えてください。";
  const retryQuestion = ext?.verification_note
    ? `以下の検証ポイントに矛盾がないか確認してください: ${ext.verification_note}`
    : undefined;

  // --- 8. confidence ---
  const confidence: "high" | "medium" | "low" = engineData
    ? engineData.candidates.length >= 3
      ? "high"
      : "medium"
    : "low";

  return {
    audience: "beginner",
    focus,
    facts,
    bestMove,
    meaningfulAlternative: alt,
    commonMistake,
    teachingPoint,
    forbiddenClaims: forbidden,
    retryQuestion,
    confidence,
  };
}

// --- Focus selection ---

function selectFocus(
  phase: string,
  isMate: boolean,
  engineData?: EngineData
): FocusCategory[] {
  if (isMate) {
    return ["bestmove_meaning", "concept"];
  }

  if (engineData && engineData.candidates.length >= 2) {
    const best = engineData.candidates[0]?.eval ?? 0;
    const second = engineData.candidates[1]?.eval ?? 0;
    const delta = Math.abs(best - second);
    if (delta > 300) {
      return ["threat", "common_mistake"];
    }
  }

  if (phase === "opening") {
    return ["bestmove_meaning", "comparison", "concept"];
  }

  return ["bestmove_meaning", "comparison"];
}

// --- Facts generation ---

function buildFacts(
  position: CanonicalPosition,
  engineData?: EngineData
): string[] {
  const facts: string[] = [];
  const phase = estimatePhase(position.moveNumber);

  // 手番、手数、フェーズ
  facts.push(`手番: ${COLOR_NAMES[position.turn]}`);
  facts.push(`手数: ${position.moveNumber}`);
  facts.push(`フェーズ: ${phase === "opening" ? "序盤" : phase === "middle" ? "中盤" : "終盤"}`);

  // 玉位置
  const kings = findKings(position.board);
  if (kings.sente) facts.push(`先手玉: ${kings.sente}`);
  if (kings.gote) facts.push(`後手玉: ${kings.gote}`);

  // 玉安全度
  const senteSafety = kingSafety(position.board, "b");
  const goteSafety = kingSafety(position.board, "w");
  facts.push(`先手玉の安全度: ${senteSafety.label}（守備駒${senteSafety.defenderCount}枚、敵の利き${senteSafety.threatCount}箇所）`);
  facts.push(`後手玉の安全度: ${goteSafety.label}（守備駒${goteSafety.defenderCount}枚、敵の利き${goteSafety.threatCount}箇所）`);

  // 駒割り
  const material = materialBalance(position.board, position.hands.sente, position.hands.gote);
  facts.push(`駒割り: ${material}`);

  // 持ち駒
  facts.push(`先手の持ち駒: ${formatHand(position.hands.sente)}`);
  facts.push(`後手の持ち駒: ${formatHand(position.hands.gote)}`);

  // エンジンデータ
  if (engineData) {
    const moveName = engineData.bestmove_ja ?? engineData.bestmove;
    facts.push(`最善手: ${moveName}`);

    // 評価値は言語化して渡す（数字は含めない）
    facts.push(`形勢: ${verbalizeEval(engineData.eval, engineData.eval_type)}`);

    if (engineData.eval_type === "mate") {
      const pvLine = engineData.pv_ja ?? engineData.pv;
      if (pvLine && pvLine.length > 0) {
        facts.push(`詰み手順: ${pvLine.join(" → ")}`);
      }
    }

    for (const c of engineData.candidates) {
      const name = c.move_ja ?? c.move;
      const evalVerbal = verbalizeEval(c.eval, engineData.eval_type);
      const desc = c.description ? `: ${c.description}` : "";
      facts.push(`候補手 ${name}（${evalVerbal}）${desc}`);
    }
  }

  return facts;
}

// --- Best move ---

function buildBestMove(engineData?: EngineData, isMate?: boolean): ExplanationPlan["bestMove"] {
  if (!engineData || engineData.candidates.length === 0) {
    return { usi: "", ja: "不明", reason: "エンジンデータがありません" };
  }

  const best = engineData.candidates[0];
  const mainLine = engineData.pv_ja ?? engineData.pv;

  let reason = best.description ?? "最善手として評価されています";
  if (isMate) {
    const mateIn = Math.abs(engineData.eval);
    reason = `${mateIn}手で詰みます。${reason}`;
  }

  return {
    usi: best.move,
    ja: best.move_ja ?? best.move,
    reason,
    mainLine,
  };
}

// --- Alternative selection ---

function selectAlternative(
  engineData?: EngineData
): ExplanationPlan["meaningfulAlternative"] {
  if (!engineData || engineData.candidates.length < 2) return undefined;

  const best = engineData.candidates[0];
  // 2番目以降で、bestmoveとの差が100cp以上あるものを優先
  for (let i = 1; i < engineData.candidates.length; i++) {
    const c = engineData.candidates[i];
    const diff = Math.abs(best.eval - c.eval);
    if (diff >= 100) {
      const altVerbal = verbalizeEval(c.eval);
      const whyWorse = c.description
        ?? `この手だと${altVerbal}になります（最善手より劣る）`;
      return {
        usi: c.move,
        ja: c.move_ja ?? c.move,
        whyWorse,
      };
    }
  }

  // 差が100未満でも2番目の候補手を返す（比較の教育価値はある）
  const second = engineData.candidates[1];
  const diff = Math.abs(best.eval - second.eval);
  if (diff < 100) return undefined; // 差が小さすぎて教育価値が低い
  return {
    usi: second.move,
    ja: second.move_ja ?? second.move,
    whyWorse: second.description ?? `最善手との差は小さいが、やや劣る`,
  };
}

// --- Forbidden claims ---

function buildForbiddenClaims(position: CanonicalPosition): string[] {
  const claims: string[] = [];
  claims.push("評価値の数字（+127等）を直接言わない");

  // 大駒（飛車、角、龍、馬）の正しい位置を列挙
  const majorPieces: AnyPieceType[] = ["R", "B", "+R", "+B"];
  const found: string[] = [];

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const cell: BoardPiece | null = position.board[row][col];
      if (cell && majorPieces.includes(cell.type)) {
        const owner = COLOR_NAMES[cell.color];
        const piece = PIECE_NAMES[cell.type];
        const pos = describeSquare(row, col);
        found.push(`${owner}の${piece}は${pos}にいる`);
      }
    }
  }

  for (const f of found) {
    claims.push(`${f}（これと矛盾する位置を述べてはいけない）`);
  }

  return claims;
}

// --- King finder ---

function findKings(board: Board): { sente: string | null; gote: string | null } {
  let sente: string | null = null;
  let gote: string | null = null;

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const cell: BoardPiece | null = board[row][col];
      if (cell && cell.type === "K") {
        const pos = describeArea(row, col);
        if (cell.color === "b") sente = pos;
        else gote = pos;
      }
    }
  }

  return { sente, gote };
}

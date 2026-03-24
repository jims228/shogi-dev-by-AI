/**
 * 解説プロンプト構築
 *
 * SfenPositionとエンジンデータから、Claude APIに渡すプロンプトを組み立てる。
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { SfenPosition, Hand, AnyPieceType, BoardPiece } from "../shogi/types";
import { PIECE_NAMES, COLOR_NAMES } from "../shogi/types";
import { estimatePhase } from "../shogi/parser";
import type { ExplanationPlan, MistakeReviewPlan } from "./plan";

/** エンジン候補手 */
export interface EngineCandidate {
  move: string;
  eval: number;
  move_ja?: string;
  description?: string;
}

/** エンジンデータ（オプション） */
export interface EngineData {
  bestmove: string;
  eval: number;
  eval_type?: "cp" | "mate";
  candidates: EngineCandidate[];
  bestmove_ja?: string;
  pv?: string[];
  pv_ja?: string[];
}

/** プロンプト構築の入力 */
export interface PromptInput {
  position: SfenPosition;
  engineData?: EngineData;
  question?: string;
}

const PHASE_NAMES = {
  opening: "序盤",
  middle: "中盤",
  endgame: "終盤",
} as const;

let cachedSystemPrompt: string | null = null;

/**
 * システムプロンプトを読み込む
 */
export function getSystemPrompt(): string {
  if (cachedSystemPrompt) return cachedSystemPrompt;

  const promptPath = join(process.cwd(), "prompts", "system-prompt-v1.md");
  cachedSystemPrompt = readFileSync(promptPath, "utf-8");
  return cachedSystemPrompt;
}

/**
 * ユーザーメッセージ（局面情報）を構築する
 */
export function buildUserMessage(input: PromptInput): string {
  const { position, engineData, question } = input;
  const phase = estimatePhase(position.moveNumber);
  const lines: string[] = [];

  lines.push("【局面情報】");
  lines.push(`手番: ${COLOR_NAMES[position.turn]}`);
  lines.push(`手数: ${position.moveNumber}`);
  lines.push(`フェーズ: ${PHASE_NAMES[phase]}`);
  lines.push("");

  lines.push("【盤面】");
  lines.push(buildBoardText(position));
  lines.push("");

  // P2: 玉の位置を明示的に追加
  const kingPositions = findKingPositions(position);
  if (kingPositions.sente || kingPositions.gote) {
    lines.push("【玉の位置】");
    if (kingPositions.sente) {
      lines.push(`先手玉: ${kingPositions.sente}`);
    }
    if (kingPositions.gote) {
      lines.push(`後手玉: ${kingPositions.gote}`);
    }
    lines.push("");
  }

  lines.push(`【先手の持ち駒】${formatHand(position.senteHand)}`);
  lines.push(`【後手の持ち駒】${formatHand(position.goteHand)}`);
  lines.push("");

  if (engineData) {
    lines.push("【エンジン評価】");
    // P1: move_ja があればそれを使う
    lines.push(`最善手: ${engineData.bestmove_ja ?? engineData.bestmove}`);

    // P3: mate評価値対応
    if (engineData.eval_type === "mate") {
      const mateIn = Math.abs(engineData.eval);
      const side = engineData.eval >= 0 ? "先手" : "後手";
      lines.push(`評価値: ${side}の勝ち確定（${mateIn}手で詰み）`);
    } else {
      const evalSign = engineData.eval >= 0 ? "+" : "";
      const evalLabel = engineData.eval >= 0 ? "先手有利" : "後手有利";
      lines.push(`評価値: ${evalSign}${engineData.eval}（${evalLabel}）`);
    }

    if (engineData.candidates.length > 0) {
      lines.push("候補手:");
      engineData.candidates.forEach((c, i) => {
        const moveName = c.move_ja ?? c.move;
        const sign = c.eval >= 0 ? "+" : "";
        const desc = c.description ? ` — ${c.description}` : "";
        lines.push(`  ${i + 1}. ${moveName} (評価値: ${sign}${c.eval})${desc}`);
      });
    }

    // R1: 読み筋（PV）があれば出力
    const pvMoves = engineData.pv_ja ?? engineData.pv;
    if (pvMoves && pvMoves.length > 0) {
      lines.push(`読み筋: ${pvMoves.join(" → ")}`);
    }

    lines.push("");
  }

  if (question) {
    lines.push(`【ユーザーの質問】`);
    lines.push(question);
  } else {
    lines.push("この局面を解説してください。");
  }

  return lines.join("\n");
}

/**
 * 盤面をテキスト形式に変換
 */
function buildBoardText(position: SfenPosition): string {
  const lines: string[] = [];
  lines.push("  ９ ８ ７ ６ ５ ４ ３ ２ １");

  for (let row = 0; row < 9; row++) {
    const cells = position.board[row].map((cell) => {
      if (!cell) return " ・";
      const prefix = cell.color === "b" ? " " : "v";
      return prefix + getPieceSymbol(cell.type);
    });
    const rankName = ["一", "二", "三", "四", "五", "六", "七", "八", "九"][row];
    lines.push(`${cells.join("")} ${rankName}`);
  }

  return lines.join("\n");
}

function getPieceSymbol(type: AnyPieceType): string {
  const symbols: Record<AnyPieceType, string> = {
    P: "歩", L: "香", N: "桂", S: "銀", G: "金", B: "角", R: "飛", K: "玉",
    "+P": "と", "+L": "杏", "+N": "圭", "+S": "全", "+B": "馬", "+R": "龍",
  };
  return symbols[type];
}

const HAND_PIECE_ORDER = ["R", "B", "G", "S", "N", "L", "P"] as const;

function formatHand(hand: Hand): string {
  const parts: string[] = [];
  for (const pt of HAND_PIECE_ORDER) {
    const count = hand[pt];
    if (count && count > 0) {
      parts.push(count > 1 ? `${PIECE_NAMES[pt]}${count}` : PIECE_NAMES[pt]);
    }
  }
  return parts.length > 0 ? parts.join(" ") : "なし";
}

/** 筋の数字表記 (col=0→9筋, col=8→1筋) */
const FILE_NAMES = ["９", "８", "７", "６", "５", "４", "３", "２", "１"];
/** 段の漢数字表記 (row=0→一段, row=8→九段) */
const RANK_NAMES = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** 盤面の相対位置の説明 */
function describePosition(row: number, col: number): string {
  const file = FILE_NAMES[col];
  const rank = RANK_NAMES[row];
  let area: string;
  if (row <= 2) {
    area = col <= 2 ? "盤の右上" : col >= 6 ? "盤の左上" : "盤の上部中央";
  } else if (row >= 6) {
    area = col <= 2 ? "盤の右下" : col >= 6 ? "盤の左下" : "盤の下部中央";
  } else {
    area = col <= 2 ? "盤の右側" : col >= 6 ? "盤の左側" : "盤の中央";
  }
  return `${file}${rank}（${area}）`;
}

/**
 * 先手玉・後手玉の位置を盤面から見つけて日本語で返す
 */
function findKingPositions(position: SfenPosition): {
  sente: string | null;
  gote: string | null;
} {
  let sente: string | null = null;
  let gote: string | null = null;

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const cell: BoardPiece | null = position.board[row][col];
      if (cell && cell.type === "K") {
        const pos = describePosition(row, col);
        if (cell.color === "b") {
          sente = pos;
        } else {
          gote = pos;
        }
      }
    }
  }

  return { sente, gote };
}

// ============================================================
// Plan-based prompt (TASK-016)
// ============================================================

const FOCUS_LABELS: Record<string, string> = {
  threat: "脅威・急所",
  bestmove_meaning: "最善手の意味",
  comparison: "候補手の比較",
  king_safety: "玉の安全度",
  piece_activity: "駒の働き",
  concept: "基本概念",
  common_mistake: "よくある間違い",
};

/**
 * ExplanationPlan のみからユーザーメッセージを構築する。
 * 盤面テキスト・SFEN・raw history は含めない。
 */
export function buildPlanPrompt(plan: ExplanationPlan): string {
  const lines: string[] = [];

  // 解説プラン
  lines.push("【解説プラン】");
  lines.push(`対象: ${plan.audience === "beginner" ? "初心者" : "中級者"}`);
  lines.push(`焦点: ${plan.focus.map((f) => FOCUS_LABELS[f] ?? f).join("、")}`);
  lines.push("");

  // 事実
  lines.push("【事実】");
  for (const fact of plan.facts) {
    lines.push(`- ${fact}`);
  }
  lines.push("");

  // 最善手
  lines.push("【最善手】");
  lines.push(`${plan.bestMove.ja}: ${plan.bestMove.reason}`);
  if (plan.bestMove.mainLine && plan.bestMove.mainLine.length > 0) {
    lines.push(`読み筋: ${plan.bestMove.mainLine.join(" → ")}`);
  }
  // mate時の追加指示
  const hasMate = plan.facts.some((f) => f.includes("手詰み"));
  if (hasMate) {
    lines.push("※ 詰み手順を正確に説明してください。手順の各手の意味も初心者に分かるように補足してください。");
  }
  lines.push("");

  // 比較候補
  if (plan.meaningfulAlternative) {
    lines.push("【比較候補】");
    lines.push(`${plan.meaningfulAlternative.ja}: ${plan.meaningfulAlternative.whyWorse}`);
    lines.push("");
  }

  // 初心者の間違いやすい手
  if (plan.commonMistake) {
    lines.push("【初心者の間違いやすい手】");
    lines.push(plan.commonMistake.ja);
    lines.push(`なぜ指したくなるか: ${plan.commonMistake.whyTempting}`);
    lines.push(`なぜ悪いか: ${plan.commonMistake.whyBad}`);
    lines.push("");
  }

  // 教えるポイント
  lines.push("【教えるポイント】");
  lines.push(plan.teachingPoint);
  lines.push("");

  // 禁止事項
  lines.push("【禁止事項】");
  for (const claim of plan.forbiddenClaims) {
    lines.push(`- ${claim}`);
  }
  lines.push("");

  // 出力形式
  lines.push("【出力形式】");
  lines.push("以下の構成で解説を書いてください:");
  lines.push("1. 一言まとめ（1文）");
  lines.push("2. なぜこの手が良いか（2-3文）");
  lines.push("3. なぜ比較手が劣るか（1-2文）");
  lines.push("4. 次に同じ場面で何を見るか（1文）");

  return lines.join("\n");
}

// ============================================================
// MistakeReviewPlan → プロンプト
// ============================================================

/**
 * MistakeReviewPlan からユーザーメッセージを構築する。
 * 盤面テキストやSFENは含めない（plan-only）。
 */
export function buildMistakeReviewPrompt(plan: MistakeReviewPlan): string {
  const lines: string[] = [];

  // あなたの手
  lines.push("【あなたの手】");
  lines.push(plan.context.reviewedMove.ja ?? plan.context.reviewedMove.usi);
  lines.push("");

  // より良い手
  if (plan.betterIdea) {
    lines.push("【より良い手】");
    lines.push(`${plan.betterIdea.ja}: ${plan.betterIdea.reason}`);
    if (plan.betterIdea.evalExpression) {
      lines.push(`この手なら: ${plan.betterIdea.evalExpression}`);
    }
    lines.push("");
  }

  // なぜ差がついたか
  if (plan.whyChains.length > 0) {
    lines.push("【なぜ差がついたか】");
    for (const chain of plan.whyChains) {
      const statements = chain.links.map((l) => l.statement).join("。そのため、");
      lines.push(`- ${chain.topic}: ${statements}`);
    }
    lines.push("");
  }

  // 事実
  lines.push("【局面の事実】");
  for (const fact of plan.facts) {
    lines.push(`- ${fact}`);
  }
  lines.push("");

  // 次に同じ局面が来たら
  lines.push("【次に同じ局面が来たら】");
  lines.push(plan.nextLookFor);
  lines.push("");

  // 考えてみよう
  if (plan.retryQuestion) {
    lines.push("【考えてみよう】");
    lines.push(plan.retryQuestion);
    lines.push("");
  }

  // 禁止事項
  lines.push("【禁止事項】");
  for (const claim of plan.forbiddenClaims) {
    lines.push(`- ${claim}`);
  }
  lines.push("");

  // 出力形式（mate 時は詰み手順に特化）
  const hasMateChain = plan.whyChains.some((c) => c.topic.includes("詰み"));
  lines.push("【出力形式】");
  if (hasMateChain) {
    lines.push("この局面は詰みがある局面でした。詰み手順を正確に説明してください:");
    lines.push("1. 実は詰みがある局面だったこと（1文）");
    lines.push("2. 詰み手順を1手ずつ、各手の意味を添えて説明（手数分）");
    lines.push("3. あなたの手ではなぜ詰みを逃したか（1文）");
    lines.push("4. 詰みを見つけるコツ（1文）");
  } else {
    lines.push("以下の構成でレビューを書いてください:");
    lines.push("1. あなたの手の評価（1文、責めない）");
    lines.push("2. なぜ差がついたか（2-3文、因果を具体的に）");
    lines.push("3. より良い手ならどうなったか（1-2文）");
    lines.push("4. 次に同じような場面で何を見るか（1文）");
  }

  return lines.join("\n");
}

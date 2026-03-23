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

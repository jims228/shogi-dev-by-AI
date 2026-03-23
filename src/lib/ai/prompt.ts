/**
 * 解説プロンプト構築
 *
 * SfenPositionとエンジンデータから、Claude APIに渡すプロンプトを組み立てる。
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { SfenPosition, Hand, AnyPieceType, Color } from "../shogi/types";
import { PIECE_NAMES, COLOR_NAMES } from "../shogi/types";
import { estimatePhase } from "../shogi/parser";

/** エンジン候補手 */
export interface EngineCandidate {
  move: string;
  eval: number;
}

/** エンジンデータ（オプション） */
export interface EngineData {
  bestmove: string;
  eval: number;
  candidates: EngineCandidate[];
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

  lines.push(`【先手の持ち駒】${formatHand(position.senteHand)}`);
  lines.push(`【後手の持ち駒】${formatHand(position.goteHand)}`);
  lines.push("");

  if (engineData) {
    lines.push("【エンジン評価】");
    lines.push(`最善手: ${engineData.bestmove}`);
    const evalSign = engineData.eval >= 0 ? "+" : "";
    const evalLabel = engineData.eval >= 0 ? "先手有利" : "後手有利";
    lines.push(`評価値: ${evalSign}${engineData.eval}（${evalLabel}）`);

    if (engineData.candidates.length > 0) {
      lines.push("候補手:");
      engineData.candidates.forEach((c, i) => {
        const sign = c.eval >= 0 ? "+" : "";
        lines.push(`  ${i + 1}. ${c.move} (評価値: ${sign}${c.eval})`);
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

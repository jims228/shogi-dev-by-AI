/**
 * 正規化された局面データ
 *
 * SfenPosition を拡張し、指し手履歴や直前の手を含む。
 * ExplanationPlan の入力として使う。
 */

import type { Board, Hand, Color } from "./types";
import { parseSfen } from "./parser";
import { applyMove } from "./move";
import type { SfenPosition } from "./types";

/** 正規化された局面 */
export type CanonicalPosition = {
  board: Board;
  hands: { sente: Hand; gote: Hand };
  turn: Color;
  moveNumber: number;
  lastMove?: { usi: string; ja?: string };
  moveHistory: string[];
};

/**
 * SFEN文字列と指し手履歴から CanonicalPosition を生成する。
 *
 * moveHistory が指定された場合、SFEN を初期局面として moveHistory を順に適用し、
 * 最終局面を返す。moveHistory がなければ SFEN をそのままパースする。
 */
export function canonicalize(
  sfen: string,
  moveHistory?: string[]
): CanonicalPosition {
  let pos: SfenPosition = parseSfen(sfen);
  const history: string[] = [];

  if (moveHistory && moveHistory.length > 0) {
    for (const move of moveHistory) {
      pos = applyMove(pos, move);
      history.push(move);
    }
  }

  return {
    board: pos.board,
    hands: { sente: pos.senteHand, gote: pos.goteHand },
    turn: pos.turn,
    moveNumber: pos.moveNumber,
    lastMove:
      history.length > 0
        ? { usi: history[history.length - 1] }
        : undefined,
    moveHistory: history,
  };
}

/**
 * SfenPosition から CanonicalPosition に変換する（moveHistory なし）
 */
export function fromSfenPosition(
  pos: SfenPosition,
  moveHistory?: string[]
): CanonicalPosition {
  return {
    board: pos.board,
    hands: { sente: pos.senteHand, gote: pos.goteHand },
    turn: pos.turn,
    moveNumber: pos.moveNumber,
    lastMove:
      moveHistory && moveHistory.length > 0
        ? { usi: moveHistory[moveHistory.length - 1] }
        : undefined,
    moveHistory: moveHistory ?? [],
  };
}

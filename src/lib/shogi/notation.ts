/**
 * USI手 → 日本語表記変換
 *
 * 盤面データと照合して正確な日本語表記を生成する。
 */

import type { SfenPosition, BoardPiece, PieceType, AnyPieceType } from "./types";
import { PIECE_NAMES } from "./types";
import { isLegalMove } from "./legality";

/** 筋の漢数字 (col=0→９, col=8→１) */
const FILE_KANJI = ["９", "８", "７", "６", "５", "４", "３", "２", "１"];
/** 段の漢数字 (row=0→一, row=8→九) */
const RANK_KANJI = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** USIファイル→col */
function fileToCol(f: string): number {
  return 9 - parseInt(f, 10);
}

/** USIランク→row */
function rankToRow(r: string): number {
  return r.charCodeAt(0) - "a".charCodeAt(0);
}

/**
 * USI手を盤面と照合して日本語表記に変換する。
 * 不合法な手や盤面と矛盾する手の場合は null を返す。
 */
export function usiToJapanese(position: SfenPosition, usi: string): string | null {
  if (!usi || usi.length < 4) return null;

  // 合法性チェック
  if (!isLegalMove(position, usi)) return null;

  const turnMark = position.turn === "b" ? "▲" : "△";
  const isDrop = usi.includes("*");

  if (isDrop) {
    return formatDrop(usi, turnMark);
  } else {
    return formatMove(position, usi, turnMark);
  }
}

/** 駒打ちの日本語表記 (例: "P*5e" → "▲５五歩打") */
function formatDrop(usi: string, turnMark: string): string | null {
  const pieceChar = usi[0].toUpperCase() as PieceType;
  const pieceName = PIECE_NAMES[pieceChar];
  if (!pieceName) return null;

  const toCol = fileToCol(usi[2]);
  const toRow = rankToRow(usi[3]);
  if (toCol < 0 || toCol > 8 || toRow < 0 || toRow > 8) return null;

  return `${turnMark}${FILE_KANJI[toCol]}${RANK_KANJI[toRow]}${pieceName}打`;
}

/** 通常移動の日本語表記 (例: "7g7f" → "▲７六歩") */
function formatMove(position: SfenPosition, usi: string, turnMark: string): string | null {
  const fromCol = fileToCol(usi[0]);
  const fromRow = rankToRow(usi[1]);
  const toCol = fileToCol(usi[2]);
  const toRow = rankToRow(usi[3]);
  const promote = usi.length > 4 && usi[4] === "+";

  if ([fromCol, fromRow, toCol, toRow].some((v) => v < 0 || v > 8)) return null;

  const piece = position.board[fromRow][fromCol];
  if (!piece) return null;

  let pieceName: string;
  if (promote) {
    // 成る前の駒名 + "成"
    pieceName = PIECE_NAMES[piece.type] + "成";
  } else {
    pieceName = PIECE_NAMES[piece.type];
  }

  return `${turnMark}${FILE_KANJI[toCol]}${RANK_KANJI[toRow]}${pieceName}`;
}

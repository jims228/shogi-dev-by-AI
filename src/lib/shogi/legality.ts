/**
 * 合法手生成
 *
 * 指定局面で合法な全USI手を生成する。
 * 王手回避や打ち歩詰めは未実装（MVPスコープ外）。
 * 二歩、行き場のない駒のチェックは実装。
 */

import type { SfenPosition, Board, BoardPiece, Color, PieceType, AnyPieceType, Hand } from "./types";

// ============================================================
// 座標変換
// ============================================================

function colToFile(col: number): string {
  return String(9 - col);
}

function rowToRank(row: number): string {
  return String.fromCharCode("a".charCodeAt(0) + row);
}

function usiSquare(col: number, row: number): string {
  return `${colToFile(col)}${rowToRank(row)}`;
}

function inBounds(col: number, row: number): boolean {
  return col >= 0 && col < 9 && row >= 0 && row < 9;
}

// ============================================================
// 駒の移動先生成
// ============================================================

const SURROUND: [number, number][] = [
  [-1, -1], [0, -1], [1, -1],
  [-1,  0],          [1,  0],
  [-1,  1], [0,  1], [1,  1],
];

function pieceDestinations(
  board: Board,
  col: number,
  row: number,
  piece: BoardPiece
): [number, number][] {
  const dests: [number, number][] = [];
  const fwd = piece.color === "b" ? -1 : 1;

  const addIfValid = (c: number, r: number) => {
    if (!inBounds(c, r)) return;
    const target = board[r][c];
    if (target && target.color === piece.color) return; // 味方駒
    dests.push([c, r]);
  };

  const addSlider = (dc: number, dr: number) => {
    let c = col + dc;
    let r = row + dr;
    while (inBounds(c, r)) {
      const target = board[r][c];
      if (target) {
        if (target.color !== piece.color) dests.push([c, r]); // 敵駒は取れる
        break;
      }
      dests.push([c, r]);
      c += dc;
      r += dr;
    }
  };

  switch (piece.type) {
    case "P":
      addIfValid(col, row + fwd);
      break;
    case "L":
      addSlider(0, fwd);
      break;
    case "N": {
      const nr = row + fwd * 2;
      addIfValid(col - 1, nr);
      addIfValid(col + 1, nr);
      break;
    }
    case "S":
      for (const [dc, dr] of [[-1, fwd], [0, fwd], [1, fwd], [-1, -fwd], [1, -fwd]]) {
        addIfValid(col + dc, row + dr);
      }
      break;
    case "G": case "+P": case "+L": case "+N": case "+S":
      for (const [dc, dr] of [[-1, fwd], [0, fwd], [1, fwd], [-1, 0], [1, 0], [0, -fwd]]) {
        addIfValid(col + dc, row + dr);
      }
      break;
    case "B":
      for (const [dc, dr] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) addSlider(dc, dr);
      break;
    case "+B":
      for (const [dc, dr] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) addSlider(dc, dr);
      for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) addIfValid(col + dc, row + dr);
      break;
    case "R":
      for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) addSlider(dc, dr);
      break;
    case "+R":
      for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) addSlider(dc, dr);
      for (const [dc, dr] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) addIfValid(col + dc, row + dr);
      break;
    case "K":
      for (const [dc, dr] of SURROUND) addIfValid(col + dc, row + dr);
      break;
  }

  return dests;
}

// ============================================================
// 成り判定
// ============================================================

const PROMOTABLE: Set<AnyPieceType> = new Set(["P", "L", "N", "S", "B", "R"]);
const MUST_PROMOTE_IF_STUCK: Set<AnyPieceType> = new Set(["P", "L", "N"]);

function canPromote(piece: BoardPiece, fromRow: number, toRow: number): boolean {
  if (!PROMOTABLE.has(piece.type)) return false;
  if (piece.color === "b") {
    return fromRow <= 2 || toRow <= 2; // 先手: 1〜3段目
  } else {
    return fromRow >= 6 || toRow >= 6; // 後手: 7〜9段目
  }
}

function mustPromote(piece: BoardPiece, toRow: number): boolean {
  if (!MUST_PROMOTE_IF_STUCK.has(piece.type)) return false;
  if (piece.color === "b") {
    if (piece.type === "N") return toRow <= 1; // 桂: 1〜2段目
    return toRow === 0; // 歩/香: 1段目
  } else {
    if (piece.type === "N") return toRow >= 7;
    return toRow === 8;
  }
}

// ============================================================
// 二歩チェック
// ============================================================

function hasPawnOnFile(board: Board, col: number, color: Color): boolean {
  for (let row = 0; row < 9; row++) {
    const cell = board[row][col];
    if (cell && cell.color === color && cell.type === "P") return true;
  }
  return false;
}

// ============================================================
// 行き場のない駒チェック
// ============================================================

function canDropAt(pieceType: PieceType, row: number, color: Color): boolean {
  if (color === "b") {
    if (pieceType === "P" || pieceType === "L") return row > 0; // 1段目不可
    if (pieceType === "N") return row > 1; // 1〜2段目不可
  } else {
    if (pieceType === "P" || pieceType === "L") return row < 8;
    if (pieceType === "N") return row < 7;
  }
  return true;
}

// ============================================================
// 合法手生成
// ============================================================

/**
 * 指定局面で合法な全USI手を生成する
 */
export function generateLegalMoves(position: SfenPosition): string[] {
  const moves: string[] = [];
  const color = position.turn;

  // 1. 通常手（盤上の駒の移動）
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = position.board[row][col];
      if (!piece || piece.color !== color) continue;

      const from = usiSquare(col, row);
      const dests = pieceDestinations(position.board, col, row, piece);

      for (const [dc, dr] of dests) {
        const to = usiSquare(dc, dr);
        const promote = canPromote(piece, row, dr);
        const forced = mustPromote(piece, dr);

        if (forced) {
          moves.push(`${from}${to}+`);
        } else if (promote) {
          moves.push(`${from}${to}+`);
          moves.push(`${from}${to}`); // 不成も合法
        } else {
          moves.push(`${from}${to}`);
        }
      }
    }
  }

  // 2. 駒打ち
  const hand = color === "b" ? position.senteHand : position.goteHand;
  const handPieces = Object.keys(hand).filter(
    (pt) => (hand[pt as PieceType] ?? 0) > 0
  ) as PieceType[];

  for (const pt of handPieces) {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (position.board[row][col] !== null) continue; // 空きマスのみ

        // 行き場のない駒チェック
        if (!canDropAt(pt, row, color)) continue;

        // 二歩チェック
        if (pt === "P" && hasPawnOnFile(position.board, col, color)) continue;

        moves.push(`${pt}*${usiSquare(col, row)}`);
      }
    }
  }

  return moves;
}

/**
 * 指定手が合法かどうか判定する
 */
export function isLegalMove(position: SfenPosition, usi: string): boolean {
  // USI手の正規化（成り記号付きの場合、不成もチェック）
  const base = usi.replace(/\+$/, "");
  const legalMoves = generateLegalMoves(position);
  return legalMoves.includes(usi) || legalMoves.includes(base);
}

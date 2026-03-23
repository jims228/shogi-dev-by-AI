/**
 * USI形式の指し手を盤面に適用する
 *
 * USI指し手形式:
 *   通常手: "7g7f" (7筋g段 → 7筋f段)、成り: "8h2b+"
 *   駒打ち: "P*5e" (歩を5筋e段に打つ)
 *
 * 座標系:
 *   ファイル: "1"-"9" → col: 8-0 (1筋=col8, 9筋=col0)
 *   ランク: "a"-"i" → row: 0-8 (a段=row0=1段目, i段=row8=9段目)
 */

import type {
  SfenPosition,
  Board,
  BoardPiece,
  Hand,
  Color,
  PieceType,
  AnyPieceType,
} from "./types";

/** 成り駒 → 元の駒 */
const UNPROMOTE_MAP: Record<string, PieceType> = {
  "+P": "P", "+L": "L", "+N": "N", "+S": "S", "+B": "B", "+R": "R",
};

/** USIファイル文字 → 列番号 */
function fileToCol(f: string): number {
  return 9 - parseInt(f, 10); // "9"→0, "1"→8
}

/** USIランク文字 → 行番号 */
function rankToRow(r: string): number {
  return r.charCodeAt(0) - "a".charCodeAt(0); // "a"→0, "i"→8
}

/** 列番号 → USIファイル文字 */
function colToFile(col: number): string {
  return String(9 - col);
}

/** 行番号 → USIランク文字 */
function rowToRank(row: number): string {
  return String.fromCharCode("a".charCodeAt(0) + row);
}

/** 盤面をディープコピー */
function cloneBoard(board: Board): Board {
  return board.map((rank) => rank.map((cell) => (cell ? { ...cell } : null)));
}

/** 持ち駒をディープコピー */
function cloneHand(hand: Hand): Hand {
  return { ...hand };
}

/** 局面をディープコピー */
function clonePosition(pos: SfenPosition): SfenPosition {
  return {
    board: cloneBoard(pos.board),
    turn: pos.turn,
    senteHand: cloneHand(pos.senteHand),
    goteHand: cloneHand(pos.goteHand),
    moveNumber: pos.moveNumber,
  };
}

/**
 * USI指し手を局面に適用して新しい局面を返す
 * 元の局面は変更しない（immutable）
 */
export function applyMove(position: SfenPosition, usi: string): SfenPosition {
  const pos = clonePosition(position);
  const isDrop = usi.includes("*");

  if (isDrop) {
    applyDrop(pos, usi);
  } else {
    applyNormalMove(pos, usi);
  }

  // 手番交代
  pos.turn = pos.turn === "b" ? "w" : "b";
  pos.moveNumber += 1;

  return pos;
}

/** 駒打ちを適用 (例: "P*5e") */
function applyDrop(pos: SfenPosition, usi: string): void {
  const pieceChar = usi[0].toUpperCase() as PieceType;
  const toCol = fileToCol(usi[2]);
  const toRow = rankToRow(usi[3]);

  // 持ち駒から1枚減らす
  const hand = pos.turn === "b" ? pos.senteHand : pos.goteHand;
  const count = hand[pieceChar] ?? 0;
  if (count <= 0) {
    throw new Error(`持ち駒に${pieceChar}がありません: ${usi}`);
  }
  if (count === 1) {
    delete hand[pieceChar];
  } else {
    hand[pieceChar] = count - 1;
  }

  // 盤面に置く
  pos.board[toRow][toCol] = { type: pieceChar, color: pos.turn };
}

/** 通常の移動を適用 (例: "7g7f", "8h2b+") */
function applyNormalMove(pos: SfenPosition, usi: string): void {
  const fromCol = fileToCol(usi[0]);
  const fromRow = rankToRow(usi[1]);
  const toCol = fileToCol(usi[2]);
  const toRow = rankToRow(usi[3]);
  const promote = usi.length > 4 && usi[4] === "+";

  const piece = pos.board[fromRow][fromCol];
  if (!piece) {
    throw new Error(`移動元に駒がありません: ${usi} (${fromRow},${fromCol})`);
  }

  // 移動先に相手の駒があれば取る（持ち駒に加える）
  const captured = pos.board[toRow][toCol];
  if (captured) {
    const hand = pos.turn === "b" ? pos.senteHand : pos.goteHand;
    // 成り駒を取った場合は元の駒として持ち駒に
    const basePiece = captured.type.startsWith("+")
      ? UNPROMOTE_MAP[captured.type]!
      : (captured.type as PieceType);
    hand[basePiece] = (hand[basePiece] ?? 0) + 1;
  }

  // 移動元を空にする
  pos.board[fromRow][fromCol] = null;

  // 移動先に駒を置く（成りの場合は成り駒に変換）
  let newType: AnyPieceType = piece.type;
  if (promote) {
    const base = piece.type.startsWith("+")
      ? piece.type
      : (`+${piece.type}` as AnyPieceType);
    newType = base;
  }
  pos.board[toRow][toCol] = { type: newType, color: piece.color };
}

/**
 * 初期局面のSFENから、指し手リストを順に適用して全局面列を生成する
 */
export function generatePositions(
  startPosition: SfenPosition,
  moves: string[]
): SfenPosition[] {
  const positions: SfenPosition[] = [startPosition];
  let current = startPosition;

  for (const move of moves) {
    try {
      current = applyMove(current, move);
      positions.push(current);
    } catch {
      // 不正な手で停止
      break;
    }
  }

  return positions;
}

/**
 * SfenPosition → SFEN文字列に変換
 */
export function positionToSfen(pos: SfenPosition): string {
  const boardStr = pos.board
    .map((rank) => {
      let row = "";
      let empty = 0;
      for (const cell of rank) {
        if (!cell) {
          empty++;
        } else {
          if (empty > 0) {
            row += empty;
            empty = 0;
          }
          const promoted = cell.type.startsWith("+");
          const base = promoted ? cell.type.slice(1) : cell.type;
          const letter = cell.color === "b" ? base.toUpperCase() : base.toLowerCase();
          row += (promoted ? "+" : "") + letter;
        }
      }
      if (empty > 0) row += empty;
      return row;
    })
    .join("/");

  const handStr = formatHandSfen(pos.senteHand, "b") + formatHandSfen(pos.goteHand, "w");

  return `${boardStr} ${pos.turn} ${handStr || "-"} ${pos.moveNumber}`;
}

function formatHandSfen(hand: Hand, color: Color): string {
  const order: PieceType[] = ["R", "B", "G", "S", "N", "L", "P"];
  let str = "";
  for (const pt of order) {
    const count = hand[pt];
    if (count && count > 0) {
      const letter = color === "b" ? pt : pt.toLowerCase();
      str += (count > 1 ? String(count) : "") + letter;
    }
  }
  return str;
}

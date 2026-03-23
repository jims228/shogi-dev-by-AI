/**
 * SFENパーサー
 *
 * SFEN文字列を構造化データに変換する。
 * SFEN形式: "盤面 手番 持ち駒 手数"
 * 例: "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"
 */

import type {
  AnyPieceType,
  Board,
  BoardPiece,
  Color,
  Hand,
  PieceType,
  Phase,
  SfenPosition,
} from "./types";

/** SFEN駒文字 → 駒種のマッピング */
const SFEN_PIECE_MAP: Record<string, PieceType> = {
  P: "P", L: "L", N: "N", S: "S", G: "G", B: "B", R: "R", K: "K",
  p: "P", l: "L", n: "N", s: "S", g: "G", b: "B", r: "R", k: "K",
};

/** 持ち駒で使える駒種 */
const HAND_PIECE_TYPES: PieceType[] = ["R", "B", "G", "S", "N", "L", "P"];

/**
 * SFEN文字列をパースして構造化データに変換する
 * @throws {Error} 不正なSFEN文字列の場合
 */
export function parseSfen(sfen: string): SfenPosition {
  const trimmed = sfen.trim();
  const parts = trimmed.split(/\s+/);

  if (parts.length < 3) {
    throw new Error(
      `不正なSFEN形式です。最低3つの要素（盤面・手番・持ち駒）が必要です: "${trimmed}"`
    );
  }

  const [boardStr, turnStr, handStr, moveStr] = parts;

  const board = parseBoard(boardStr);
  const turn = parseTurn(turnStr);
  const { senteHand, goteHand } = parseHands(handStr);
  const moveNumber = moveStr ? parseInt(moveStr, 10) : 1;

  if (isNaN(moveNumber) || moveNumber < 1) {
    throw new Error(`不正な手数です: "${moveStr}"`);
  }

  return { board, turn, senteHand, goteHand, moveNumber };
}

/**
 * 盤面文字列をパースする
 * SFENの盤面は1段目(先手から見て上)から9段目の順で、"/"区切り
 */
function parseBoard(boardStr: string): Board {
  const ranks = boardStr.split("/");
  if (ranks.length !== 9) {
    throw new Error(
      `盤面は9段必要ですが、${ranks.length}段です: "${boardStr}"`
    );
  }

  return ranks.map((rank, rowIndex) => parseRank(rank, rowIndex + 1));
}

/**
 * 1段分の文字列をパースする
 */
function parseRank(rankStr: string, rankNumber: number): (BoardPiece | null)[] {
  const cells: (BoardPiece | null)[] = [];
  let i = 0;

  while (i < rankStr.length) {
    const char = rankStr[i];

    // 数字: 空マスの数
    if (char >= "1" && char <= "9") {
      const emptyCount = parseInt(char, 10);
      for (let j = 0; j < emptyCount; j++) {
        cells.push(null);
      }
      i++;
      continue;
    }

    // "+": 成り駒の接頭辞
    if (char === "+") {
      i++;
      if (i >= rankStr.length) {
        throw new Error(`${rankNumber}段目: "+"の後に駒文字がありません`);
      }
      const pieceChar = rankStr[i];
      const piece = parsePieceChar(pieceChar, rankNumber, true);
      cells.push(piece);
      i++;
      continue;
    }

    // 駒文字
    const piece = parsePieceChar(char, rankNumber, false);
    cells.push(piece);
    i++;
  }

  if (cells.length !== 9) {
    throw new Error(
      `${rankNumber}段目: 9マス必要ですが、${cells.length}マスです: "${rankStr}"`
    );
  }

  return cells;
}

/**
 * 駒文字1つをパースする
 */
function parsePieceChar(
  char: string,
  rankNumber: number,
  promoted: boolean
): BoardPiece {
  const pieceType = SFEN_PIECE_MAP[char];
  if (!pieceType) {
    throw new Error(
      `${rankNumber}段目: 不明な駒文字です: "${char}"`
    );
  }

  // 金・玉は成れない
  if (promoted && (pieceType === "G" || pieceType === "K")) {
    throw new Error(
      `${rankNumber}段目: ${pieceType === "G" ? "金" : "玉"}は成れません`
    );
  }

  const color: Color = char === char.toUpperCase() ? "b" : "w";
  const type: AnyPieceType = promoted ? (`+${pieceType}` as AnyPieceType) : pieceType;

  return { type, color };
}

/**
 * 手番をパースする
 */
function parseTurn(turnStr: string): Color {
  if (turnStr === "b") return "b";
  if (turnStr === "w") return "w";
  throw new Error(`不正な手番です（"b"または"w"が必要です）: "${turnStr}"`);
}

/**
 * 持ち駒文字列をパースする
 * "-" は持ち駒なし、それ以外は "2P3p" のような形式
 */
function parseHands(handStr: string): { senteHand: Hand; goteHand: Hand } {
  const senteHand: Hand = {};
  const goteHand: Hand = {};

  if (handStr === "-") {
    return { senteHand, goteHand };
  }

  let i = 0;
  while (i < handStr.length) {
    // 枚数（省略時は1）
    let count = 0;
    while (i < handStr.length && handStr[i] >= "0" && handStr[i] <= "9") {
      count = count * 10 + parseInt(handStr[i], 10);
      i++;
    }
    if (count === 0) count = 1;

    if (i >= handStr.length) {
      throw new Error(`持ち駒: 枚数の後に駒文字がありません: "${handStr}"`);
    }

    const char = handStr[i];
    const pieceType = SFEN_PIECE_MAP[char];
    if (!pieceType) {
      throw new Error(`持ち駒: 不明な駒文字です: "${char}"`);
    }

    if (!HAND_PIECE_TYPES.includes(pieceType)) {
      throw new Error(`持ち駒: ${pieceType}は持ち駒にできません`);
    }

    const isUpper = char === char.toUpperCase();
    const hand = isUpper ? senteHand : goteHand;
    hand[pieceType] = (hand[pieceType] || 0) + count;

    i++;
  }

  return { senteHand, goteHand };
}

/**
 * 手数から局面フェーズを推定する（簡易版）
 */
export function estimatePhase(moveNumber: number): Phase {
  if (moveNumber <= 40) return "opening";
  if (moveNumber <= 80) return "middle";
  return "endgame";
}

/**
 * 盤面を人間が読みやすい文字列に変換する（デバッグ・プロンプト用）
 */
export function boardToString(position: SfenPosition): string {
  const lines: string[] = [];

  lines.push("  ９ ８ ７ ６ ５ ４ ３ ２ １");
  lines.push("+--+--+--+--+--+--+--+--+--+");

  for (let row = 0; row < 9; row++) {
    const cells = position.board[row].map((cell) => {
      if (!cell) return " ・";
      const prefix = cell.color === "b" ? " " : "v";
      const name = PIECE_SYMBOL[cell.type];
      return prefix + name;
    });
    const rankName = ["一", "二", "三", "四", "五", "六", "七", "八", "九"][row];
    lines.push(`|${cells.join("")}|${rankName}`);
  }

  lines.push("+--+--+--+--+--+--+--+--+--+");

  // 持ち駒
  lines.push(`先手の持ち駒: ${handToString(position.senteHand)}`);
  lines.push(`後手の持ち駒: ${handToString(position.goteHand)}`);
  lines.push(`手番: ${position.turn === "b" ? "先手" : "後手"}`);
  lines.push(`手数: ${position.moveNumber}`);

  return lines.join("\n");
}

/** 駒の表示用記号 */
const PIECE_SYMBOL: Record<AnyPieceType, string> = {
  P: "歩", L: "香", N: "桂", S: "銀", G: "金", B: "角", R: "飛", K: "玉",
  "+P": "と", "+L": "杏", "+N": "圭", "+S": "全", "+B": "馬", "+R": "龍",
};

function handToString(hand: Hand): string {
  const parts: string[] = [];
  for (const pt of HAND_PIECE_TYPES) {
    const count = hand[pt];
    if (count && count > 0) {
      const name = PIECE_SYMBOL[pt];
      parts.push(count > 1 ? `${name}${count}` : name);
    }
  }
  return parts.length > 0 ? parts.join(" ") : "なし";
}

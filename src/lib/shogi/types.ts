/**
 * 将棋の型定義
 */

/** 駒の種類（成りなし） */
export type PieceType =
  | "P"  // 歩
  | "L"  // 香
  | "N"  // 桂
  | "S"  // 銀
  | "G"  // 金
  | "B"  // 角
  | "R"  // 飛
  | "K"; // 玉

/** 成り駒を含む駒の種類 */
export type PromotedPieceType =
  | "+P" // と
  | "+L" // 成香
  | "+N" // 成桂
  | "+S" // 成銀
  | "+B" // 馬
  | "+R"; // 龍

/** すべての駒種 */
export type AnyPieceType = PieceType | PromotedPieceType;

/** 手番 */
export type Color = "b" | "w"; // b=先手(black/sente), w=後手(white/gote)

/** 盤上の駒 */
export interface BoardPiece {
  type: AnyPieceType;
  color: Color;
}

/** 盤面: 9x9 の2次元配列。board[row][col] で row=0が1段目、col=0が9筋 */
export type Board = (BoardPiece | null)[][];

/** 持ち駒: 駒種 → 枚数 */
export type Hand = Partial<Record<PieceType, number>>;

/** パース済みのSFEN局面データ */
export interface SfenPosition {
  board: Board;
  turn: Color;
  senteHand: Hand;
  goteHand: Hand;
  moveNumber: number;
}

/** 局面フェーズ */
export type Phase = "opening" | "middle" | "endgame";

/** 駒の日本語名 */
export const PIECE_NAMES: Record<AnyPieceType, string> = {
  P: "歩", L: "香", N: "桂", S: "銀", G: "金", B: "角", R: "飛", K: "玉",
  "+P": "と", "+L": "成香", "+N": "成桂", "+S": "成銀", "+B": "馬", "+R": "龍",
};

/** 手番の日本語名 */
export const COLOR_NAMES: Record<Color, string> = {
  b: "先手",
  w: "後手",
};

/**
 * 局面特徴量の計算
 *
 * 玉安全度、駒割り、利きマップを盤面データから算出する。
 */

import type { Board, BoardPiece, Color, Hand, PieceType, AnyPieceType } from "./types";
import { PIECE_NAMES } from "./types";

// ============================================================
// 定数
// ============================================================

/** 周囲8方向 [dCol, dRow] */
const SURROUND_DELTAS: [number, number][] = [
  [-1, -1], [0, -1], [1, -1],
  [-1,  0],          [1,  0],
  [-1,  1], [0,  1], [1,  1],
];

/** 金の動きをする駒（守備力が高い） */
const GOLD_MOVE_TYPES = new Set<AnyPieceType>(["G", "S", "+P", "+L", "+N", "+S"]);

/** 安全度ラベル */
const SAFETY_LABELS: { min: number; label: string }[] = [
  { min: 70, label: "安全" },
  { min: 50, label: "やや安全" },
  { min: 30, label: "やや危険" },
  { min: 0,  label: "危険" },
];

/** 駒の価値 */
const PIECE_VALUES: Record<PieceType, number> = {
  P: 1, L: 3, N: 3, S: 5, G: 6, B: 8, R: 10, K: 0,
};

/** 成り駒の元の駒 */
const UNPROMOTE: Record<string, PieceType> = {
  "+P": "P", "+L": "L", "+N": "N", "+S": "S", "+B": "B", "+R": "R",
};

// ============================================================
// 利きマップ (attackMap)
// ============================================================

function inBounds(col: number, row: number): boolean {
  return col >= 0 && col < 9 && row >= 0 && row < 9;
}

function key(col: number, row: number): string {
  return `${col},${row}`;
}

/** 方向 [dCol, dRow] に沿って直線の利きを追加（遮蔽あり） */
function addSliderAttacks(
  board: Board,
  col: number,
  row: number,
  dc: number,
  dr: number,
  result: Set<string>
): void {
  let c = col + dc;
  let r = row + dr;
  while (inBounds(c, r)) {
    result.add(key(c, r));
    if (board[r][c] !== null) break; // 駒に当たったら停止
    c += dc;
    r += dr;
  }
}

/** 1駒の利きマスを計算 */
function pieceAttacks(
  board: Board,
  col: number,
  row: number,
  piece: BoardPiece
): Set<string> {
  const attacks = new Set<string>();
  const forward = piece.color === "b" ? -1 : 1; // 先手は上(-1)へ、後手は下(+1)へ
  const type = piece.type;

  switch (type) {
    case "P": {
      const nr = row + forward;
      if (inBounds(col, nr)) attacks.add(key(col, nr));
      break;
    }

    case "L": {
      addSliderAttacks(board, col, row, 0, forward, attacks);
      break;
    }

    case "N": {
      // 桂馬: 前2+横1のL字
      const nr = row + forward * 2;
      if (inBounds(col - 1, nr)) attacks.add(key(col - 1, nr));
      if (inBounds(col + 1, nr)) attacks.add(key(col + 1, nr));
      break;
    }

    case "S": {
      // 銀: 前方3 + 後方斜め2
      for (const [dc, dr] of [[-1, forward], [0, forward], [1, forward], [-1, -forward], [1, -forward]]) {
        if (inBounds(col + dc, row + dr)) attacks.add(key(col + dc, row + dr));
      }
      break;
    }

    case "G":
    case "+P":
    case "+L":
    case "+N":
    case "+S": {
      // 金の動き: 前方3 + 横2 + 後方1
      for (const [dc, dr] of [[-1, forward], [0, forward], [1, forward], [-1, 0], [1, 0], [0, -forward]]) {
        if (inBounds(col + dc, row + dr)) attacks.add(key(col + dc, row + dr));
      }
      break;
    }

    case "B": {
      // 角: 斜め4方向
      for (const [dc, dr] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        addSliderAttacks(board, col, row, dc, dr, attacks);
      }
      break;
    }

    case "+B": {
      // 馬: 角 + 縦横1マス
      for (const [dc, dr] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        addSliderAttacks(board, col, row, dc, dr, attacks);
      }
      for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        if (inBounds(col + dc, row + dr)) attacks.add(key(col + dc, row + dr));
      }
      break;
    }

    case "R": {
      // 飛: 縦横4方向
      for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        addSliderAttacks(board, col, row, dc, dr, attacks);
      }
      break;
    }

    case "+R": {
      // 龍: 飛 + 斜め1マス
      for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        addSliderAttacks(board, col, row, dc, dr, attacks);
      }
      for (const [dc, dr] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        if (inBounds(col + dc, row + dr)) attacks.add(key(col + dc, row + dr));
      }
      break;
    }

    case "K": {
      for (const [dc, dr] of SURROUND_DELTAS) {
        if (inBounds(col + dc, row + dr)) attacks.add(key(col + dc, row + dr));
      }
      break;
    }
  }

  return attacks;
}

/**
 * 指定した手番の全駒の利きマスを計算する
 */
export function attackMap(board: Board, color: Color): Set<string> {
  const allAttacks = new Set<string>();

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const cell = board[row][col];
      if (cell && cell.color === color) {
        for (const sq of pieceAttacks(board, col, row, cell)) {
          allAttacks.add(sq);
        }
      }
    }
  }

  return allAttacks;
}

// ============================================================
// 玉安全度 (kingSafety)
// ============================================================

export interface KingSafetyResult {
  score: number;
  defenderCount: number;
  goldSilverAdj: number;
  threatCount: number;
  label: string;
}

/**
 * 指定した手番の玉の安全度を計算する (0〜100)
 */
export function kingSafety(board: Board, color: Color): KingSafetyResult {
  // 玉の位置を見つける
  let kingCol = -1;
  let kingRow = -1;
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const cell = board[row][col];
      if (cell && cell.type === "K" && cell.color === color) {
        kingCol = col;
        kingRow = row;
      }
    }
  }

  if (kingCol === -1) {
    return { score: 0, defenderCount: 0, goldSilverAdj: 0, threatCount: 0, label: "危険" };
  }

  // 周囲8マスをスキャン
  let defenderCount = 0;
  let goldSilverAdj = 0;

  for (const [dc, dr] of SURROUND_DELTAS) {
    const c = kingCol + dc;
    const r = kingRow + dr;
    if (!inBounds(c, r)) continue;

    const cell = board[r][c];
    if (cell && cell.color === color) {
      defenderCount++;
      if (GOLD_MOVE_TYPES.has(cell.type)) {
        goldSilverAdj++;
      }
    }
  }

  // 敵の利きを計算
  const enemyColor: Color = color === "b" ? "w" : "b";
  const enemyAttacks = attackMap(board, enemyColor);

  let threatCount = 0;
  for (const [dc, dr] of SURROUND_DELTAS) {
    const c = kingCol + dc;
    const r = kingRow + dr;
    if (!inBounds(c, r)) continue;
    if (enemyAttacks.has(key(c, r))) {
      threatCount++;
    }
  }

  // スコア計算: 守備駒 * 12 + 金銀ボーナス * 8 - 敵利き * 10
  // 基礎点40（最低限の安全性）
  let score = 40 + defenderCount * 12 + goldSilverAdj * 8 - threatCount * 10;

  // 玉自身が攻撃されている場合は追加ペナルティ
  if (enemyAttacks.has(key(kingCol, kingRow))) {
    score -= 15;
  }

  // クランプ
  score = Math.max(0, Math.min(100, score));

  // ラベル
  let label = "危険";
  for (const entry of SAFETY_LABELS) {
    if (score >= entry.min) {
      label = entry.label;
      break;
    }
  }

  return { score, defenderCount, goldSilverAdj, threatCount, label };
}

// ============================================================
// 駒割り (materialBalance)
// ============================================================

function countMaterial(board: Board, hand: Hand, color: Color): number {
  let total = 0;

  // 盤上の駒
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const cell = board[row][col];
      if (cell && cell.color === color && cell.type !== "K") {
        const base = cell.type.startsWith("+")
          ? UNPROMOTE[cell.type]!
          : (cell.type as PieceType);
        total += PIECE_VALUES[base];
      }
    }
  }

  // 持ち駒
  for (const pt of Object.keys(hand) as PieceType[]) {
    const count = hand[pt] ?? 0;
    total += PIECE_VALUES[pt] * count;
  }

  return total;
}

/**
 * 駒割りを日本語で返す
 */
export function materialBalance(board: Board, senteHand: Hand, goteHand: Hand): string {
  const senteMat = countMaterial(board, senteHand, "b");
  const goteMat = countMaterial(board, goteHand, "w");
  const diff = senteMat - goteMat;

  if (Math.abs(diff) <= 1) return "駒割り互角";

  const side = diff > 0 ? "先手" : "後手";
  const absDiff = Math.abs(diff);

  // 差を駒の名前で表現
  if (absDiff >= 10) return `${side}が飛車以上の駒得`;
  if (absDiff >= 8) return `${side}が角得`;
  if (absDiff >= 5) return `${side}が銀〜金得`;
  if (absDiff >= 3) return `${side}が香桂得`;
  return `${side}が歩得`;
}

"use client";

import type { SfenPosition, BoardPiece, AnyPieceType, Hand, PieceType } from "@/lib/shogi/types";
import { PIECE_NAMES } from "@/lib/shogi/types";

interface ShogiBoardProps {
  position: SfenPosition;
}

const CELL_SIZE = 40;
const BOARD_SIZE = CELL_SIZE * 9;

/** pieces.png sprite layout: 8 cols x 4 rows, each tile 130px */
const SPRITE_TILE = 130;
const DISPLAY_PIECE = CELL_SIZE - 4; // piece display size within cell

/** Column order in sprite: 歩,香,桂,銀,金,角,飛,王 */
const PIECE_COL: Record<PieceType, number> = {
  P: 0, L: 1, N: 2, S: 3, G: 4, B: 5, R: 6, K: 7,
};

/** Per-piece X offsets from v2 sprite data */
const PIECE_OFFSET_X: Record<PieceType, number> = {
  P: -5, L: -3, N: 1, S: -2, G: -4, B: -2, R: -2, K: -1,
};

/** Promoted pieces map to same column as base piece, rows 1/3 */
const PROMOTED_BASE: Record<string, PieceType> = {
  "+P": "P", "+L": "L", "+N": "N", "+S": "S", "+B": "B", "+R": "R",
};

function getSpritePosition(piece: BoardPiece): { x: number; y: number } {
  const isPromoted = piece.type.startsWith("+");
  const base = isPromoted ? PROMOTED_BASE[piece.type] : (piece.type as PieceType);
  const col = PIECE_COL[base];

  // Row: sente unpromoted=0, sente promoted=1, gote unpromoted=2, gote promoted=3
  let row: number;
  if (piece.color === "b") {
    row = isPromoted ? 1 : 0;
  } else {
    row = isPromoted ? 3 : 2;
  }

  const offsetX = PIECE_OFFSET_X[base];
  return {
    x: col * SPRITE_TILE + offsetX,
    y: row * SPRITE_TILE,
  };
}

function PieceImage({ piece }: { piece: BoardPiece }) {
  const pos = getSpritePosition(piece);
  const scale = DISPLAY_PIECE / SPRITE_TILE;

  return (
    <div
      style={{
        width: DISPLAY_PIECE,
        height: DISPLAY_PIECE,
        backgroundImage: "url(/images/pieces.png)",
        backgroundPosition: `-${pos.x * scale}px -${pos.y * scale}px`,
        backgroundSize: `${SPRITE_TILE * 8 * scale}px ${SPRITE_TILE * 4 * scale}px`,
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}

const HAND_ORDER: PieceType[] = ["R", "B", "G", "S", "N", "L", "P"];

function HandDisplay({ hand, color, label }: { hand: Hand; color: "b" | "w"; label: string }) {
  const pieces: { type: PieceType; count: number }[] = [];
  for (const pt of HAND_ORDER) {
    const count = hand[pt];
    if (count && count > 0) {
      pieces.push({ type: pt, count });
    }
  }

  return (
    <div className="flex flex-col items-center gap-1 min-w-[3rem]">
      <span className="text-xs text-zinc-500">{label}</span>
      {pieces.length === 0 ? (
        <span className="text-xs text-zinc-400">なし</span>
      ) : (
        <div className="flex flex-wrap gap-0.5 justify-center">
          {pieces.map(({ type, count }) => (
            <span key={type} className="text-xs">
              {PIECE_NAMES[type]}{count > 1 ? count : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const FILE_LABELS = ["9", "8", "7", "6", "5", "4", "3", "2", "1"];
const RANK_LABELS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

export default function ShogiBoard({ position }: ShogiBoardProps) {
  return (
    <div className="flex items-start gap-2 justify-center">
      <HandDisplay hand={position.goteHand} color="w" label="後手" />

      <div className="flex flex-col items-center">
        {/* File labels */}
        <div className="flex" style={{ width: BOARD_SIZE }}>
          {FILE_LABELS.map((f) => (
            <div
              key={f}
              className="text-center text-xs text-zinc-400"
              style={{ width: CELL_SIZE }}
            >
              {f}
            </div>
          ))}
        </div>

        {/* Board grid */}
        <div
          className="relative border border-zinc-800 dark:border-zinc-400"
          style={{ width: BOARD_SIZE, height: BOARD_SIZE }}
        >
          {/* Grid lines */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`v${i}`}
              className="absolute top-0 bottom-0 border-l border-zinc-400 dark:border-zinc-600"
              style={{ left: CELL_SIZE * (i + 1) }}
            />
          ))}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`h${i}`}
              className="absolute left-0 right-0 border-t border-zinc-400 dark:border-zinc-600"
              style={{ top: CELL_SIZE * (i + 1) }}
            />
          ))}

          {/* Star points (dots) */}
          {[2, 5].map((col) =>
            [2, 5].map((row) => (
              <div
                key={`dot-${col}-${row}`}
                className="absolute w-1.5 h-1.5 rounded-full bg-zinc-800 dark:bg-zinc-300"
                style={{
                  left: CELL_SIZE * (col + 1) - 3,
                  top: CELL_SIZE * (row + 1) - 3,
                }}
              />
            ))
          )}

          {/* Pieces */}
          {position.board.map((rank, row) =>
            rank.map((cell, col) => {
              if (!cell) return null;
              return (
                <div
                  key={`${row}-${col}`}
                  className="absolute flex items-center justify-center"
                  style={{
                    left: col * CELL_SIZE,
                    top: row * CELL_SIZE,
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                  }}
                >
                  <PieceImage piece={cell} />
                </div>
              );
            })
          )}
        </div>

        {/* Rank labels */}
        <div className="flex justify-between text-xs text-zinc-400 mt-0.5" style={{ width: BOARD_SIZE }}>
          {/* empty spacer to align rank labels to right */}
        </div>
      </div>

      {/* Rank labels on right side */}
      <div className="flex flex-col pt-5" style={{ height: BOARD_SIZE }}>
        {RANK_LABELS.map((r) => (
          <div
            key={r}
            className="flex items-center justify-center text-xs text-zinc-400"
            style={{ height: CELL_SIZE }}
          >
            {r}
          </div>
        ))}
      </div>

      <HandDisplay hand={position.senteHand} color="b" label="先手" />
    </div>
  );
}

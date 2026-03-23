import { describe, it, expect } from "vitest";
import { generateLegalMoves, isLegalMove } from "./legality";
import { parseSfen } from "./parser";

const STARTPOS = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";

describe("generateLegalMoves", () => {
  it("初期局面で合法手が生成される", () => {
    const pos = parseSfen(STARTPOS);
    const moves = generateLegalMoves(pos);
    expect(moves.length).toBeGreaterThan(20);
  });

  it("初期局面で▲7六歩(7g7f)が合法", () => {
    const pos = parseSfen(STARTPOS);
    expect(isLegalMove(pos, "7g7f")).toBe(true);
  });

  it("初期局面で移動元がない手は不合法", () => {
    const pos = parseSfen(STARTPOS);
    // 5五に駒がない → 5e5dは不合法
    expect(isLegalMove(pos, "5e5d")).toBe(false);
  });
});

describe("二歩チェック", () => {
  it("同じ筋に歩がある場合、歩打ちは不合法", () => {
    // 先手の歩が5筋(col=4)にある局面で、5筋に歩を打てない
    const pos = parseSfen("4k4/9/9/9/9/4P4/9/9/4K4 b P 1");
    // 5筋(col=4)のどこにも歩は打てない
    const moves = generateLegalMoves(pos);
    const pawnDrops5 = moves.filter(
      (m) => m.startsWith("P*5") // P*5a, P*5b, etc.
    );
    expect(pawnDrops5.length).toBe(0);
  });

  it("別の筋には歩を打てる", () => {
    const pos = parseSfen("4k4/9/9/9/9/4P4/9/9/4K4 b P 1");
    const moves = generateLegalMoves(pos);
    // 4筋(col=5)には歩を打てる
    const pawnDrops4 = moves.filter((m) => m.startsWith("P*4"));
    expect(pawnDrops4.length).toBeGreaterThan(0);
  });
});

describe("行き場のない駒チェック", () => {
  it("先手の歩を1段目(row=0)に打てない", () => {
    const pos = parseSfen("4k4/9/9/9/9/9/9/9/4K4 b P 1");
    const moves = generateLegalMoves(pos);
    // 1段目 = rank a → P*1a, P*2a, ..., P*9a
    const pawnDropsRank1 = moves.filter((m) => m.match(/^P\*\da$/));
    expect(pawnDropsRank1.length).toBe(0);
  });

  it("先手の桂を1〜2段目に打てない", () => {
    const pos = parseSfen("4k4/9/9/9/9/9/9/9/4K4 b N 1");
    const moves = generateLegalMoves(pos);
    const knightDropsRank1 = moves.filter((m) => m.match(/^N\*\da$/));
    const knightDropsRank2 = moves.filter((m) => m.match(/^N\*\db$/));
    expect(knightDropsRank1.length).toBe(0);
    expect(knightDropsRank2.length).toBe(0);
  });

  it("先手の桂を3段目以降には打てる", () => {
    const pos = parseSfen("4k4/9/9/9/9/9/9/9/4K4 b N 1");
    const moves = generateLegalMoves(pos);
    const knightDropsRank3 = moves.filter((m) => m.match(/^N\*\dc$/));
    expect(knightDropsRank3.length).toBeGreaterThan(0);
  });
});

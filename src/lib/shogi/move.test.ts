import { describe, it, expect } from "vitest";
import { applyMove, generatePositions, positionToSfen } from "./move";
import { parseSfen } from "./parser";

const STARTPOS = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";

describe("applyMove", () => {
  it("初手7g7fを適用できる", () => {
    const pos = parseSfen(STARTPOS);
    const next = applyMove(pos, "7g7f");

    // 7筋7段目(row6,col2)の歩がなくなる
    expect(next.board[6][2]).toBeNull();
    // 7筋6段目(row5,col2)に歩がある
    expect(next.board[5][2]).toEqual({ type: "P", color: "b" });
    // 手番が後手に
    expect(next.turn).toBe("w");
    // 手数が2に
    expect(next.moveNumber).toBe(2);
  });

  it("駒を取る手を適用できる", () => {
    // 簡易局面: 先手歩が後手歩を取る
    const sfen = "4k4/9/9/9/4p4/4P4/9/9/4K4 b - 1";
    const pos = parseSfen(sfen);
    const next = applyMove(pos, "5f5e");

    // 5筋5段目(row4,col4)に先手の歩
    expect(next.board[4][4]).toEqual({ type: "P", color: "b" });
    // 元の位置は空
    expect(next.board[5][4]).toBeNull();
    // 先手の持ち駒に歩が1枚
    expect(next.senteHand.P).toBe(1);
  });

  it("成りを適用できる", () => {
    const sfen = "4k4/4P4/9/9/9/9/9/9/4K4 b - 1";
    const pos = parseSfen(sfen);
    const next = applyMove(pos, "5b5a+");

    expect(next.board[0][4]).toEqual({ type: "+P", color: "b" });
  });

  it("駒打ちを適用できる", () => {
    const sfen = "4k4/9/9/9/9/9/9/9/4K4 b P 1";
    const pos = parseSfen(sfen);
    const next = applyMove(pos, "P*5e");

    // 5筋5段目に歩が置かれる
    expect(next.board[4][4]).toEqual({ type: "P", color: "b" });
    // 持ち駒から歩がなくなる
    expect(next.senteHand.P).toBeUndefined();
  });

  it("成り駒を取ると元の駒として持ち駒になる", () => {
    const sfen = "4k4/9/9/9/4+p4/4P4/9/9/4K4 b - 1";
    const pos = parseSfen(sfen);
    const next = applyMove(pos, "5f5e");

    // 持ち駒は歩（とではなく）
    expect(next.senteHand.P).toBe(1);
  });

  it("元の局面は変更されない（immutable）", () => {
    const pos = parseSfen(STARTPOS);
    applyMove(pos, "7g7f");

    // 元の局面は変わっていない
    expect(pos.board[6][2]).toEqual({ type: "P", color: "b" });
    expect(pos.turn).toBe("b");
    expect(pos.moveNumber).toBe(1);
  });
});

describe("generatePositions", () => {
  it("複数手を適用して全局面列を生成できる", () => {
    const start = parseSfen(STARTPOS);
    const moves = ["7g7f", "3c3d", "2g2f"];
    const positions = generatePositions(start, moves);

    expect(positions.length).toBe(4); // 初期 + 3手
    expect(positions[0].moveNumber).toBe(1);
    expect(positions[1].moveNumber).toBe(2);
    expect(positions[3].moveNumber).toBe(4);
  });
});

describe("positionToSfen", () => {
  it("初期局面をSFENに戻せる", () => {
    const pos = parseSfen(STARTPOS);
    const sfen = positionToSfen(pos);
    expect(sfen).toBe(STARTPOS);
  });

  it("持ち駒ありの局面をSFENに戻せる", () => {
    const sfen = "4k4/9/9/9/9/9/9/9/4K4 b 2G2Pbn 1";
    const pos = parseSfen(sfen);
    const result = positionToSfen(pos);
    expect(result).toBe(sfen);
  });
});

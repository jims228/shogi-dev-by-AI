import { describe, it, expect } from "vitest";
import { kingSafety, materialBalance, attackMap } from "./features";
import { parseSfen } from "./parser";

const STARTPOS = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";

describe("kingSafety", () => {
  it("初期局面で先手玉は安全", () => {
    const pos = parseSfen(STARTPOS);
    const result = kingSafety(pos.board, "b");

    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.defenderCount).toBeGreaterThanOrEqual(2);
    expect(result.label).toMatch(/安全/);
  });

  it("初期局面で後手玉も安全", () => {
    const pos = parseSfen(STARTPOS);
    const result = kingSafety(pos.board, "w");

    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.label).toMatch(/安全/);
  });

  it("裸玉は危険", () => {
    const pos = parseSfen("4k4/9/9/9/9/9/9/9/4K4 b - 1");
    const result = kingSafety(pos.board, "b");

    expect(result.score).toBeLessThanOrEqual(50);
    expect(result.defenderCount).toBe(0);
  });

  it("金銀で囲われた玉は安全度が高い", () => {
    // 先手玉が金銀3枚で囲われている
    const pos = parseSfen("4k4/9/9/9/9/9/9/4GSG2/4K4 b - 1");
    const result = kingSafety(pos.board, "b");

    expect(result.goldSilverAdj).toBeGreaterThanOrEqual(2);
    expect(result.score).toBeGreaterThan(50);
  });
});

describe("materialBalance", () => {
  it("初期局面は駒割り互角", () => {
    const pos = parseSfen(STARTPOS);
    const result = materialBalance(pos.board, pos.senteHand, pos.goteHand);
    expect(result).toBe("駒割り互角");
  });

  it("先手が角を持っていれば角得", () => {
    const pos = parseSfen("4k4/9/9/9/9/9/9/9/4K4 b B 1");
    const result = materialBalance(pos.board, pos.senteHand, pos.goteHand);
    expect(result).toContain("先手");
    expect(result).toContain("角得");
  });

  it("後手が飛車を持っていれば後手の駒得", () => {
    const pos = parseSfen("4k4/9/9/9/9/9/9/9/4K4 b r 1");
    const result = materialBalance(pos.board, pos.senteHand, pos.goteHand);
    expect(result).toContain("後手");
  });
});

describe("attackMap", () => {
  it("初期局面で先手の歩の利きが3段目にある", () => {
    const pos = parseSfen(STARTPOS);
    const attacks = attackMap(pos.board, "b");

    // 先手の歩は7段目(row=6)にある → 利きは6段目(row=5)
    // col=0(9筋)の歩の利き → "0,5"
    expect(attacks.has("0,5")).toBe(true);
    expect(attacks.has("4,5")).toBe(true); // 5筋の歩
  });

  it("角の斜め利きが正しい", () => {
    // 先手の角が5五(col=4,row=4)に1枚だけ
    const pos = parseSfen("4k4/9/9/9/4B4/9/9/9/4K4 b - 1");
    const attacks = attackMap(pos.board, "b");

    // 斜め右上: (5,3), (6,2), (7,1), (8,0)
    expect(attacks.has("5,3")).toBe(true);
    expect(attacks.has("6,2")).toBe(true);
    // 斜め左上
    expect(attacks.has("3,3")).toBe(true);
    // 斜め右下
    expect(attacks.has("5,5")).toBe(true);
    // 斜め左下
    expect(attacks.has("3,5")).toBe(true);
  });

  it("飛車の縦横利きが正しい", () => {
    const pos = parseSfen("4k4/9/9/9/4R4/9/9/9/4K4 b - 1");
    const attacks = attackMap(pos.board, "b");

    // 上方向: (4,3), (4,2), (4,1), (4,0) ← 後手玉で止まる
    expect(attacks.has("4,3")).toBe(true);
    expect(attacks.has("4,0")).toBe(true);
    // 右方向
    expect(attacks.has("5,4")).toBe(true);
    expect(attacks.has("8,4")).toBe(true);
    // 下方向: (4,5)...(4,8) ← 先手玉で止まる
    expect(attacks.has("4,5")).toBe(true);
    expect(attacks.has("4,8")).toBe(true);
  });

  it("香の前方直線利き（先手は上方向）", () => {
    const pos = parseSfen("4k4/9/9/9/9/9/9/9/4K3L b - 1");
    const attacks = attackMap(pos.board, "b");

    // 先手香 at col=8,row=8 → 上方向: (8,7), (8,6)...
    expect(attacks.has("8,7")).toBe(true);
    expect(attacks.has("8,0")).toBe(true);
  });

  it("桂馬は駒を飛び越える", () => {
    // 先手桂 at col=4,row=8, 前方に歩がいても飛び越える
    const pos = parseSfen("4k4/9/9/9/9/9/4P4/4P4/4KN3 b - 1");
    const attacks = attackMap(pos.board, "b");

    // 桂 at col=5,row=8 → (4,6) and (6,6)
    expect(attacks.has("4,6")).toBe(true);
    expect(attacks.has("6,6")).toBe(true);
  });
});

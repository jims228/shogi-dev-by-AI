import { describe, it, expect } from "vitest";
import { kifToUsiMoves, isKifFormat } from "./kif";

describe("isKifFormat", () => {
  it("KIF形式を判定できる", () => {
    expect(isKifFormat("手数----指し手---------消費時間--\n   1 ７六歩(77)")).toBe(true);
    expect(isKifFormat("   1 ７六歩(77)")).toBe(true);
    expect(isKifFormat("▲７六歩(77)")).toBe(true);
  });

  it("SFEN形式はKIFではない", () => {
    expect(isKifFormat("lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1")).toBe(false);
  });
});

describe("kifToUsiMoves", () => {
  it("基本的な手をパースできる", () => {
    const kif = `手数----指し手---------消費時間--
   1 ７六歩(77)        ( 0:01/00:00:01)
   2 ３四歩(33)        ( 0:01/00:00:01)
   3 ２六歩(27)        ( 0:01/00:00:02)`;

    const moves = kifToUsiMoves(kif);
    expect(moves).toEqual(["7g7f", "3c3d", "2g2f"]);
  });

  it("「同」記法をパースできる", () => {
    const kif = `   1 ７六歩(77)
   2 ３四歩(33)
   3 ２二角成(88)
   4 同　銀(31)`;

    const moves = kifToUsiMoves(kif);
    expect(moves).toEqual(["7g7f", "3c3d", "8h2b+", "3a2b"]);
  });

  it("駒打ちをパースできる", () => {
    const kif = `   1 ３三歩打`;
    const moves = kifToUsiMoves(kif);
    expect(moves).toEqual(["P*3c"]);
  });

  it("成り/不成をパースできる", () => {
    const kif = `   1 ７七角成(88)
   2 ２三歩不成(24)`;

    const moves = kifToUsiMoves(kif);
    expect(moves[0]).toBe("8h7g+");
    expect(moves[1]).toBe("2d2c");
  });

  it("▲△付きの手をパースできる", () => {
    const kif = `▲７六歩(77)
△３四歩(33)`;

    const moves = kifToUsiMoves(kif);
    expect(moves).toEqual(["7g7f", "3c3d"]);
  });

  it("終局マーカーで停止する", () => {
    const kif = `   1 ７六歩(77)
   2 ３四歩(33)
まで2手で先手の勝ち`;

    const moves = kifToUsiMoves(kif);
    expect(moves).toEqual(["7g7f", "3c3d"]);
  });

  it("空入力で空配列を返す", () => {
    expect(kifToUsiMoves("")).toEqual([]);
  });
});

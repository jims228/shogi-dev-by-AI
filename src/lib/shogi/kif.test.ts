import { describe, it, expect } from "vitest";
import { kifToUsiMoves, isKifFormat } from "./kif";
import { parseSfen } from "./parser";
import { generatePositions } from "./move";

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

  it("ヘッダー付きの完全なKIF棋譜をパースできる", () => {
    const kif = `棋戦：レーティング対局室
先手：player1
後手：player2
手合割：平手
手数----指し手---------消費時間--
   1 ７六歩(77)        (00:01/00:00:01)
   2 ３四歩(33)        (00:01/00:00:01)
   3 ２六歩(27)        (00:02/00:00:03)
   4 ８四歩(83)        (00:01/00:00:02)
   5 ２五歩(26)        (00:01/00:00:04)
   6 ８五歩(84)        (00:02/00:00:04)
   7 投了
まで6手で後手の勝ち`;

    const moves = kifToUsiMoves(kif);
    expect(moves.length).toBe(6);
    expect(moves[0]).toBe("7g7f");
    expect(moves[1]).toBe("3c3d");
    expect(moves[2]).toBe("2g2f");
    expect(moves[3]).toBe("8c8d");
    expect(moves[4]).toBe("2f2e");
    expect(moves[5]).toBe("8d8e");
  });

  it("投了行で正しく停止する", () => {
    const kif = `   1 ７六歩(77)        (00:01/00:00:01)
   2 ３四歩(33)        (00:01/00:00:01)
   3 投了
まで2手で先手の勝ち`;

    const moves = kifToUsiMoves(kif);
    expect(moves.length).toBe(2);
  });

  it("ヘッダー行をスキップする", () => {
    const kif = `先手：山田太郎
後手：佐藤花子
手合割：平手
   1 ７六歩(77)
   2 ３四歩(33)`;

    const moves = kifToUsiMoves(kif);
    expect(moves.length).toBe(2);
    expect(moves[0]).toBe("7g7f");
    expect(moves[1]).toBe("3c3d");
  });

  it("KIF→USI→盤面適用の統合テスト", () => {
    // 10手の棋譜で盤面適用まで通しで確認
    const kif = `手数----指し手---------消費時間--
   1 ７六歩(77)        (00:01/00:00:01)
   2 ３四歩(33)        (00:01/00:00:01)
   3 ２六歩(27)        (00:01/00:00:02)
   4 ８四歩(83)        (00:01/00:00:02)
   5 ２五歩(26)        (00:01/00:00:03)
   6 ８五歩(84)        (00:01/00:00:03)
   7 ７八金(69)        (00:01/00:00:04)
   8 ３二金(41)        (00:01/00:00:04)
   9 ２四歩(25)        (00:01/00:00:05)
  10 同　歩(23)        (00:01/00:00:05)`;

    const moves = kifToUsiMoves(kif);
    expect(moves.length).toBe(10);
    expect(moves[9]).toBe("2c2d"); // 同歩: from 23 to 24 (lastTo from move 9)

    // 盤面適用テスト
    const startPos = parseSfen("lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1");
    const positions = generatePositions(startPos, moves);
    expect(positions.length).toBe(11); // 初期 + 10手
  });
});

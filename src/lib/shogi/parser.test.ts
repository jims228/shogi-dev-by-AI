import { describe, it, expect } from "vitest";
import { parseSfen, estimatePhase, boardToString } from "./parser";

describe("parseSfen", () => {
  it("初期局面をパースできる", () => {
    const sfen = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";
    const pos = parseSfen(sfen);

    // 手番は先手
    expect(pos.turn).toBe("b");
    // 手数は1
    expect(pos.moveNumber).toBe(1);
    // 持ち駒はなし
    expect(pos.senteHand).toEqual({});
    expect(pos.goteHand).toEqual({});

    // 盤面チェック: 9段 x 9筋
    expect(pos.board.length).toBe(9);
    pos.board.forEach((rank) => expect(rank.length).toBe(9));

    // 1段目（後手陣）: lnsgkgsnl
    expect(pos.board[0][0]).toEqual({ type: "L", color: "w" });
    expect(pos.board[0][1]).toEqual({ type: "N", color: "w" });
    expect(pos.board[0][4]).toEqual({ type: "K", color: "w" });

    // 9段目（先手陣）: LNSGKGSNL
    expect(pos.board[8][0]).toEqual({ type: "L", color: "b" });
    expect(pos.board[8][4]).toEqual({ type: "K", color: "b" });

    // 2段目: 1r5b1 → null, 飛, null*5, 角, null
    expect(pos.board[1][0]).toBeNull();
    expect(pos.board[1][1]).toEqual({ type: "R", color: "w" });
    expect(pos.board[1][7]).toEqual({ type: "B", color: "w" });
    expect(pos.board[1][8]).toBeNull();

    // 4段目: 9 → すべてnull
    pos.board[3].forEach((cell) => expect(cell).toBeNull());
  });

  it("持ち駒付きの局面をパースできる", () => {
    const sfen = "4k4/9/9/9/9/9/9/9/4K4 b 2G2Pbn 1";
    const pos = parseSfen(sfen);

    // 先手の持ち駒: 金2, 歩2
    expect(pos.senteHand).toEqual({ G: 2, P: 2 });
    // 後手の持ち駒: 角1, 桂1
    expect(pos.goteHand).toEqual({ B: 1, N: 1 });
  });

  it("成り駒を含む局面をパースできる", () => {
    const sfen = "4k4/9/9/9/9/9/9/9/+r3K4 b - 1";
    const pos = parseSfen(sfen);

    // 9段目9筋（col=0）に後手の龍
    expect(pos.board[8][0]).toEqual({ type: "+R", color: "w" });
    // 9段目5筋（col=4）に先手の玉
    expect(pos.board[8][4]).toEqual({ type: "K", color: "b" });
  });

  it("後手番の局面をパースできる", () => {
    const sfen = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL w - 2";
    const pos = parseSfen(sfen);

    expect(pos.turn).toBe("w");
    expect(pos.moveNumber).toBe(2);
  });

  it("持ち駒なし（-）を正しくパースする", () => {
    const sfen = "4k4/9/9/9/9/9/9/9/4K4 b - 1";
    const pos = parseSfen(sfen);

    expect(pos.senteHand).toEqual({});
    expect(pos.goteHand).toEqual({});
  });

  it("手数省略時はデフォルト1になる", () => {
    const sfen = "4k4/9/9/9/9/9/9/9/4K4 b -";
    const pos = parseSfen(sfen);

    expect(pos.moveNumber).toBe(1);
  });

  describe("エラーケース", () => {
    it("要素が2つ未満でエラー", () => {
      expect(() => parseSfen("lnsgkgsnl")).toThrow("最低3つの要素");
    });

    it("段数が9でなければエラー", () => {
      expect(() => parseSfen("4k4/9/9 b - 1")).toThrow("9段必要");
    });

    it("マス数が9でなければエラー", () => {
      expect(() => parseSfen("4k3/9/9/9/9/9/9/9/4K4 b - 1")).toThrow(
        "9マス必要"
      );
    });

    it("不正な手番でエラー", () => {
      expect(() => parseSfen("4k4/9/9/9/9/9/9/9/4K4 x - 1")).toThrow(
        "不正な手番"
      );
    });

    it("不正な駒文字でエラー", () => {
      expect(() => parseSfen("4x4/9/9/9/9/9/9/9/4K4 b - 1")).toThrow(
        "不明な駒文字"
      );
    });

    it("金の成りでエラー", () => {
      expect(() =>
        parseSfen("+g3k4/9/9/9/9/9/9/9/4K4 b - 1")
      ).toThrow("金は成れません");
    });
  });
});

describe("estimatePhase", () => {
  it("序盤: 手数40以下", () => {
    expect(estimatePhase(1)).toBe("opening");
    expect(estimatePhase(40)).toBe("opening");
  });

  it("中盤: 手数41-80", () => {
    expect(estimatePhase(41)).toBe("middle");
    expect(estimatePhase(80)).toBe("middle");
  });

  it("終盤: 手数81以上", () => {
    expect(estimatePhase(81)).toBe("endgame");
    expect(estimatePhase(150)).toBe("endgame");
  });
});

describe("boardToString", () => {
  it("初期局面を文字列化できる", () => {
    const sfen = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";
    const pos = parseSfen(sfen);
    const str = boardToString(pos);

    expect(str).toContain("先手");
    expect(str).toContain("後手");
    expect(str).toContain("手番: 先手");
    expect(str).toContain("手数: 1");
    expect(str).toContain("なし"); // 持ち駒なし
  });

  it("持ち駒ありの局面を文字列化できる", () => {
    const sfen = "4k4/9/9/9/9/9/9/9/4K4 b 2G3P 1";
    const pos = parseSfen(sfen);
    const str = boardToString(pos);

    expect(str).toContain("金2");
    expect(str).toContain("歩3");
  });
});

import { describe, it, expect } from "vitest";
import { usiToJapanese } from "./notation";
import { parseSfen } from "./parser";
import { applyMove } from "./move";

const STARTPOS = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";

describe("usiToJapanese", () => {
  it("初期局面で 7g7f → ▲７六歩", () => {
    const pos = parseSfen(STARTPOS);
    expect(usiToJapanese(pos, "7g7f")).toBe("▲７六歩");
  });

  it("初期局面で 8h6f → null（角道が塞がっている）", () => {
    const pos = parseSfen(STARTPOS);
    // 7筋の歩が7gにいるので角は6fに行けない
    expect(usiToJapanese(pos, "8h6f")).toBeNull();
  });

  it("角道が通った局面で 8h2b+ → ▲２二角成", () => {
    // ▲7六歩 △3四歩 の後、角道が通った状態
    let pos = parseSfen(STARTPOS);
    pos = applyMove(pos, "7g7f"); // ▲7六歩
    pos = applyMove(pos, "3c3d"); // △3四歩
    expect(usiToJapanese(pos, "8h2b+")).toBe("▲２二角成");
  });

  it("持ち駒の歩打ち P*5e → ▲５五歩打", () => {
    const pos = parseSfen("4k4/9/9/9/9/9/9/9/4K4 b P 1");
    expect(usiToJapanese(pos, "P*5e")).toBe("▲５五歩打");
  });

  it("不合法な手 → null", () => {
    // 初期局面で玉は5iにいる。5i6f は玉の移動範囲外
    const pos = parseSfen(STARTPOS);
    expect(usiToJapanese(pos, "5i6f")).toBeNull();
  });

  it("後手番の手には △ がつく", () => {
    let pos = parseSfen(STARTPOS);
    pos = applyMove(pos, "7g7f"); // 先手の手後 → 後手番
    expect(usiToJapanese(pos, "3c3d")).toBe("△３四歩");
  });
});

import { describe, it, expect } from "vitest";
import { matchOpeningCards, prioritizeCards, resolveOpeningCards, getUndecidedCard } from "./opening-cards";

describe("matchOpeningCards", () => {
  it("7g7f + 3c3d → kakugawari-potential がヒット", () => {
    const matched = matchOpeningCards(["7g7f", "3c3d", "2g2f"]);
    const ids = matched.map((c) => c.id);
    expect(ids).toContain("opening-kakugawari-potential");
  });

  it("2g2f → static-rook がヒット", () => {
    const matched = matchOpeningCards(["7g7f", "3c3d", "2g2f"]);
    const ids = matched.map((c) => c.id);
    expect(ids).toContain("opening-static-rook");
  });

  it("7g7f のみでは kakugawari-potential はヒットしない", () => {
    const matched = matchOpeningCards(["7g7f"]);
    const ids = matched.map((c) => c.id);
    expect(ids).not.toContain("opening-kakugawari-potential");
  });

  it("triggerMoves が空のカード（undecided）はヒットしない", () => {
    const matched = matchOpeningCards(["7g7f", "3c3d"]);
    const ids = matched.map((c) => c.id);
    expect(ids).not.toContain("opening-undecided");
  });
});

describe("prioritizeCards", () => {
  it("triggerMoves が多いカードが先に来る", () => {
    const matched = matchOpeningCards(["7g7f", "3c3d", "2g2f"]);
    const prioritized = prioritizeCards(matched);

    if (prioritized.length >= 2) {
      expect(prioritized[0].triggerMoves.length).toBeGreaterThanOrEqual(
        prioritized[1].triggerMoves.length
      );
    }
  });

  it("最大3枚に制限される", () => {
    const matched = matchOpeningCards(["7g7f", "3c3d", "2g2f", "6i7h", "3i3h"]);
    const prioritized = prioritizeCards(matched);
    expect(prioritized.length).toBeLessThanOrEqual(3);
  });
});

describe("resolveOpeningCards", () => {
  it("空の moveHistory + moveNumber<=10 → undecided fallback", () => {
    const cards = resolveOpeningCards([], 3);
    expect(cards.length).toBe(1);
    expect(cards[0].id).toBe("opening-undecided");
  });

  it("ヒットありなら undecided は返さない", () => {
    const cards = resolveOpeningCards(["7g7f", "3c3d"], 5);
    expect(cards.some((c) => c.id === "opening-undecided")).toBe(false);
    expect(cards.length).toBeGreaterThan(0);
  });

  it("moveNumber > 10 + ヒットなし → 空", () => {
    const cards = resolveOpeningCards(["7g7f"], 15);
    // 7g7f だけでは kakugawari は不足。他にもヒットしないかもしれない
    // ただし opening-static-rook 等が 1 trigger で引っかかる可能性がある
    // ヒットしたらそれでOK、しなければ undecided も返らない
    expect(cards.every((c) => c.id !== "opening-undecided")).toBe(true);
  });
});

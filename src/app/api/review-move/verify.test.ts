import { describe, it, expect } from "vitest";
import { verifyMistakeReview } from "./verify";
import type { MistakeReviewPlan } from "../../../lib/ai/plan";

const basePlan: MistakeReviewPlan = {
  audience: "beginner",
  context: {
    previousMoves: [],
    reviewedMove: { usi: "3i3h", ja: "▲3八銀" },
    phase: "opening",
    narrativeRole: "slow_move",
  },
  whyChains: [{
    topic: "手の方向性",
    links: [{
      kind: "lesson",
      statement: "この手は悪くないが最善手の方が効率的",
      confidence: "low",
    }],
  }],
  betterIdea: {
    usi: "6i7h",
    ja: "▲7八金",
    reason: "角頭を守りつつ囲いの準備",
  },
  keyTerms: [],
  nextLookFor: "攻守のバランスを意識しましょう",
  retryQuestion: "▲3八銀と▲7八金の違いは？",
  confidence: "high",
  forbiddenClaims: [
    "評価値の数字（+127等）を直接言わない",
    "ユーザーを責めない（「ダメな手」ではなく「もったいない手」等）",
  ],
  facts: ["手番: 先手", "フェーズ: 序盤"],
};

describe("verifyMistakeReview", () => {
  it("正常な出力 → passed", () => {
    const output =
      "▲3八銀はもったいない手でした。▲7八金なら角頭を守りながら囲いの準備ができます。" +
      "次に同じような場面では、攻守のバランスを意識してみましょう。";

    const result = verifyMistakeReview(output, basePlan);
    expect(result.passed).toBe(true);
  });

  it("reviewedMove が言及されていない → fail", () => {
    const output =
      "この局面では守りを固めることが大切です。角頭の守りを意識しましょう。7八金が良い手です。";

    const result = verifyMistakeReview(output, basePlan);
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes("レビュー対象の手"))).toBe(true);
  });

  it("評価値の数字が出ている → fail", () => {
    const output =
      "▲3八銀は+43で、▲7八金の+127より劣ります。7八金を選びましょう。";

    const result = verifyMistakeReview(output, basePlan);
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes("評価値の数字"))).toBe(true);
  });

  it("短すぎる出力 → fail (truncation)", () => {
    const output = "3八銀は悪手。";

    const result = verifyMistakeReview(output, basePlan);
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes("途中で切れ"))).toBe(true);
  });

  it("betterIdea が言及されていない → warning (not fail)", () => {
    const output =
      "▲3八銀はもったいない手でした。この局面では守りを固める手が有力です。" +
      "角頭の守りを意識して駒を配置すると良いでしょう。";

    const result = verifyMistakeReview(output, basePlan);
    // betterIdea 未言及は warning
    expect(result.warnings.some((w) => w.includes("より良い手"))).toBe(true);
    // reviewedMove は言及されているので pass（他の issue がなければ）
  });
});

import { describe, it, expect } from "vitest";
import { verifyExplanation } from "./verifier";
import type { ExplanationPlan } from "./plan";

const basePlan: ExplanationPlan = {
  audience: "beginner",
  focus: ["bestmove_meaning", "comparison"],
  facts: [
    "手番: 先手",
    "先手玉: ５九（盤の中央下）",
    "後手玉: ５一（盤の上部中央）",
    "先手の飛車は２八にいる",
    "候補手 ▲7八金 (評価値: +127)",
    "候補手 ▲2六歩 (評価値: +103)",
  ],
  bestMove: {
    usi: "6i7h",
    ja: "▲7八金",
    reason: "角頭を守りつつ囲いの準備",
  },
  meaningfulAlternative: {
    usi: "2g2f",
    ja: "▲2六歩",
    whyWorse: "攻めの準備だが守りが遅れる",
  },
  teachingPoint: "序盤は攻守のバランスが大切",
  forbiddenClaims: [
    "評価値の数字（+127等）を直接言わない",
    "先手の飛車は２八にいる（これと矛盾する位置を述べてはいけない）",
  ],
  confidence: "high",
};

describe("verifyExplanation", () => {
  it("正常な出力 → passed=true", () => {
    const output =
      "この局面では▲7八金が最善手です。角頭を守りながら囲いの準備ができます。" +
      "▲2六歩も有力ですが、守りが遅れるため7八金が優ります。";

    const result = verifyExplanation(output, basePlan);
    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("評価値の数字が直接出ている → issues", () => {
    const output =
      "▲7八金が最善手です。評価値は+127で先手が有利です。";

    const result = verifyExplanation(output, basePlan);
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes("評価値の数字"))).toBe(true);
  });

  it("bestMove が言及されていない → issues", () => {
    const output =
      "この局面では先手が有利です。次に攻めの準備をすると良いでしょう。";

    const result = verifyExplanation(output, basePlan);
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes("最善手"))).toBe(true);
  });

  it("facts にない座標が出力に含まれる → issues（警告）", () => {
    const output =
      "▲7八金が最善手です。後手の角が３三にいるため注意が必要です。";

    const result = verifyExplanation(output, basePlan);
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes("factsにない座標"))).toBe(true);
  });

  it("飛車の位置を間違えている → forbiddenClaims 違反", () => {
    const output =
      "▲7八金が最善手です。飛車が５八にいるので安心です。";

    const result = verifyExplanation(output, basePlan);
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes("飛車") && i.includes("位置"))).toBe(true);
  });

  it("小さい数字（手数等）は評価値として誤検出しない", () => {
    const output =
      "▲7八金が最善手です。3手先まで読むと先手が有利になります。";

    const result = verifyExplanation(output, basePlan);
    // +3 は50未満なので検出されない
    expect(result.issues.some((i) => i.includes("評価値の数字"))).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildMistakeReviewPlan } from "./mistake-planner";
import { buildMistakeReviewPrompt } from "./prompt";
import { fromSfenPosition } from "../shogi/canonical";
import { parseSfen } from "../shogi/parser";
import type { ExtendedEngineData } from "./planner";

function loadPosition(filename: string) {
  const raw = readFileSync(
    join(process.cwd(), "data/prompt-examples", filename),
    "utf-8"
  );
  const data = JSON.parse(raw);
  const pos = parseSfen(data.sfen);
  const canonical = fromSfenPosition(pos);
  const engineData: ExtendedEngineData = {
    ...data.engine_data,
    bestmove_ja: data.engine_data.candidates?.[0]?.move_ja,
    common_mistake: data.common_mistake,
    learning_point: data.learning_point,
  };
  return { canonical, engineData, data };
}

describe("buildMistakeReviewPlan", () => {
  it("pos-001: 最善手以外の手をレビュー → whyChains が生成される", () => {
    const { canonical, engineData } = loadPosition("pos-001-opening.json");

    // ユーザーが▲3八銀（次善手）を指した場合
    const plan = buildMistakeReviewPlan(
      canonical,
      { usi: "3i3h", ja: "▲3八銀" },
      { usi: "6i7h", ja: "▲7八金" },
      engineData
    );

    expect(plan.whyChains.length).toBeGreaterThanOrEqual(1);
    expect(plan.whyChains[0].links.length).toBeGreaterThanOrEqual(1);
    expect(plan.nextLookFor).toBeTruthy();
    expect(plan.context.narrativeRole).toBeTruthy();
    expect(plan.context.phase).toBe("opening");
    expect(plan.betterIdea?.ja).toBe("▲7八金");
    expect(plan.confidence).toBe("high");
  });

  it("whyChains の link に statement がある", () => {
    const { canonical, engineData } = loadPosition("pos-001-opening.json");

    const plan = buildMistakeReviewPlan(
      canonical,
      { usi: "3i3h", ja: "▲3八銀" },
      { usi: "6i7h", ja: "▲7八金" },
      engineData
    );

    for (const chain of plan.whyChains) {
      for (const link of chain.links) {
        expect(link.statement).toBeTruthy();
        expect(link.kind).toBeTruthy();
      }
    }
  });

  it("context.narrativeRole が有効な値", () => {
    const { canonical, engineData } = loadPosition("pos-002-middle.json");

    const plan = buildMistakeReviewPlan(
      canonical,
      { usi: "8h6f", ja: "▲6六角" },  // 適当な手
      { usi: "P*2d", ja: "▲2四歩打" },
      engineData
    );

    const validRoles = [
      "missed_defense", "overattack", "bad_exchange",
      "slow_move", "king_exposed", "missed_tactic",
    ];
    expect(validRoles).toContain(plan.context.narrativeRole);
  });

  it("不合法な reviewedMove → confidence=low + failReason", () => {
    const pos = parseSfen(
      "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"
    );
    const canonical = fromSfenPosition(pos);

    const plan = buildMistakeReviewPlan(
      canonical,
      { usi: "9a1i" },  // 不合法な手
      { usi: "7g7f" }
    );

    expect(plan.confidence).toBe("low");
    expect(plan.failReason).toBeDefined();
  });

  it("正常な reviewedMove → ja が盤面から自動生成される", () => {
    const pos = parseSfen(
      "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"
    );
    const canonical = fromSfenPosition(pos);

    const plan = buildMistakeReviewPlan(
      canonical,
      { usi: "3i3h" },  // ja を渡さない → 自動生成
      { usi: "7g7f" }
    );

    expect(plan.context.reviewedMove.ja).toBe("▲３八銀");
    expect(plan.failReason).toBeUndefined();
  });

  it("pos-003（mate局面）→ whyChains が詰み手順ベース", () => {
    const { canonical, engineData } = loadPosition("pos-003-endgame.json");

    const plan = buildMistakeReviewPlan(
      canonical,
      { usi: "R*5b" },  // 不正解の飛車打ち
      { usi: "R*5a", ja: "▲5一飛打" },
      engineData
    );

    expect(plan.whyChains.length).toBeGreaterThanOrEqual(1);
    expect(plan.whyChains[0].topic).toContain("詰み");
    expect(plan.whyChains[0].links.length).toBeGreaterThanOrEqual(2);
    expect(plan.betterIdea?.reason).toContain("詰み");
    expect(plan.context.narrativeRole).toBe("missed_tactic");
  });

  it("pos-001（非mate局面）→ whyChains が詰み手順ではない", () => {
    const { canonical, engineData } = loadPosition("pos-001-opening.json");

    const plan = buildMistakeReviewPlan(
      canonical,
      { usi: "3i3h", ja: "▲3八銀" },
      { usi: "6i7h", ja: "▲7八金" },
      engineData
    );

    expect(plan.whyChains[0].topic).not.toContain("詰み");
    expect(plan.context.narrativeRole).not.toBe("missed_tactic");
  });

  it("エンジンデータなしでも生成できる（confidence: low）", () => {
    const pos = parseSfen(
      "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"
    );
    const canonical = fromSfenPosition(pos);

    const plan = buildMistakeReviewPlan(
      canonical,
      { usi: "7g7f" },
      { usi: "2g2f" }
    );

    expect(plan.confidence).toBe("low");
    expect(plan.whyChains.length).toBeGreaterThanOrEqual(1);
    expect(plan.nextLookFor).toBeTruthy();
  });
});

describe("buildMistakeReviewPrompt", () => {
  it("固定セクションを含む", () => {
    const { canonical, engineData } = loadPosition("pos-001-opening.json");

    const plan = buildMistakeReviewPlan(
      canonical,
      { usi: "3i3h", ja: "▲3八銀" },
      { usi: "6i7h", ja: "▲7八金" },
      engineData
    );

    const prompt = buildMistakeReviewPrompt(plan);

    expect(prompt).toContain("【あなたの手】");
    expect(prompt).toContain("【より良い手】");
    expect(prompt).toContain("【なぜ差がついたか】");
    expect(prompt).toContain("【次に同じ局面が来たら】");
    expect(prompt).toContain("【考えてみよう】");
    expect(prompt).toContain("【禁止事項】");
    expect(prompt).toContain("ユーザーを責めない");
    expect(prompt).toContain("▲3八銀");
    expect(prompt).toContain("▲7八金");
  });

  it("mate局面のプロンプトに詰み手順説明の指示がある", () => {
    const { canonical, engineData } = loadPosition("pos-003-endgame.json");

    const plan = buildMistakeReviewPlan(
      canonical,
      { usi: "R*5b" },
      { usi: "R*5a", ja: "▲5一飛打" },
      engineData
    );

    const prompt = buildMistakeReviewPrompt(plan);
    expect(prompt).toContain("詰み手順を正確に説明");
    expect(prompt).toContain("詰みを見つけるコツ");
  });
});

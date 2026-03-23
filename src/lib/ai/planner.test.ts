import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildPlan } from "./planner";
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
    common_mistake: data.common_mistake,
    learning_point: data.learning_point,
    verification_note: data.verification_note,
  };
  return { canonical, engineData, data };
}

describe("buildPlan", () => {
  it("pos-001 (序盤): focus に concept を含む", () => {
    const { canonical, engineData } = loadPosition("pos-001-opening.json");
    const plan = buildPlan(canonical, engineData);

    expect(plan.audience).toBe("beginner");
    expect(plan.focus).toContain("concept");
    expect(plan.focus).toContain("bestmove_meaning");
    expect(plan.bestMove.ja).toBe("▲7八金");
    expect(plan.facts.length).toBeGreaterThan(5);
    expect(plan.confidence).toBe("high");
    expect(plan.teachingPoint).toBeTruthy();
  });

  it("pos-002 (中盤): meaningfulAlternative を生成する", () => {
    const { canonical, engineData } = loadPosition("pos-002-middle.json");
    const plan = buildPlan(canonical, engineData);

    expect(plan.bestMove.ja).toBe("▲2四歩打");
    expect(plan.meaningfulAlternative).toBeDefined();
    expect(plan.forbiddenClaims.length).toBeGreaterThan(0);
    expect(plan.forbiddenClaims[0]).toContain("評価値の数字");
  });

  it("pos-003 (終盤詰み): focus に bestmove_meaning + concept, 詰み手順あり", () => {
    const { canonical, engineData } = loadPosition("pos-003-endgame.json");
    const plan = buildPlan(canonical, engineData);

    expect(plan.focus).toEqual(["bestmove_meaning", "concept"]);
    expect(plan.bestMove.ja).toBe("▲5一飛打");
    expect(plan.bestMove.reason).toContain("手で詰み");
    expect(plan.bestMove.mainLine).toBeDefined();
    expect(plan.bestMove.mainLine!.length).toBeGreaterThan(0);
    expect(plan.facts.some((f) => f.includes("詰み手順"))).toBe(true);
    expect(plan.commonMistake).toBeDefined();
  });

  it("pos-004 (四間飛車): 大差時に threat を含む", () => {
    const { canonical, engineData } = loadPosition("pos-004-ranging-rook.json");
    const plan = buildPlan(canonical, engineData);

    // bestmove=+3206 vs second=-201 → delta > 300 → threat
    expect(plan.focus).toContain("threat");
    expect(plan.bestMove.ja).toBe("▲2二角成");
  });

  it("pos-005 (終盤寄せ): forbiddenClaims に大駒位置を含む", () => {
    const { canonical, engineData } = loadPosition("pos-005-endgame-yose.json");
    const plan = buildPlan(canonical, engineData);

    expect(plan.forbiddenClaims.some((c) => c.includes("龍"))).toBe(true);
    expect(plan.teachingPoint).toBeTruthy();
    expect(plan.confidence).toBe("high");
  });

  it("全5局面で facts に生の評価値数字が含まれない", () => {
    const files = [
      "pos-001-opening.json",
      "pos-002-middle.json",
      "pos-003-endgame.json",
      "pos-004-ranging-rook.json",
      "pos-005-endgame-yose.json",
    ];
    const rawEvalPattern = /[+\-]\d{2,}/;

    for (const file of files) {
      const { canonical, engineData } = loadPosition(file);
      const plan = buildPlan(canonical, engineData);

      for (const fact of plan.facts) {
        expect(
          rawEvalPattern.test(fact),
          `${file}: fact "${fact}" に生の評価値が含まれている`
        ).toBe(false);
      }
    }
  });

  it("エンジンデータなしでも生成できる", () => {
    const pos = parseSfen(
      "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"
    );
    const canonical = fromSfenPosition(pos);
    const plan = buildPlan(canonical);

    expect(plan.confidence).toBe("low");
    expect(plan.bestMove.reason).toContain("エンジンデータがありません");
    expect(plan.facts.length).toBeGreaterThan(3);
  });

  it("不合法手を含むエンジンデータ → planからその手が除外される", () => {
    // 初期局面に対して存在しない手をbestmoveに指定
    const pos = parseSfen(
      "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"
    );
    const canonical = fromSfenPosition(pos);
    const fakeEngineData = {
      bestmove: "9a1i",  // 不合法な手
      bestmove_ja: "▲不合法",
      eval: 500,
      candidates: [
        { move: "9a1i", move_ja: "▲不合法", eval: 500 },
        { move: "7g7f", move_ja: "▲7六歩", eval: 100 },
      ],
    };
    const plan = buildPlan(canonical, fakeEngineData);

    // bestMove のUSIが空になっている（不合法手が除外された）
    expect(plan.bestMove.usi).toBe("");
    expect(plan.bestMove.reason).toContain("合法性未確認");
    // 合法な代替手は残る
    expect(plan.meaningfulAlternative?.usi).toBe("7g7f");
  });
});

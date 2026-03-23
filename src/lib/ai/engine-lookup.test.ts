import { describe, it, expect } from "vitest";
import { lookupEngineData } from "./engine-lookup";
import { fromSfenPosition } from "../shogi/canonical";
import { parseSfen } from "../shogi/parser";
import { buildPlan } from "./planner";

describe("lookupEngineData", () => {
  it("pos-001 の SFEN で engineData が返る", () => {
    const sfen = "lnsgkgsnl/1r5b1/pppppp1pp/6p2/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL b - 3";
    const data = lookupEngineData(sfen);

    expect(data).toBeDefined();
    expect(data!.bestmove).toBe("6i7h");
    expect(data!.bestmove_ja).toBe("▲7八金");
    expect(data!.candidates.length).toBeGreaterThanOrEqual(3);
    expect(data!.common_mistake).toBeTruthy();
    expect(data!.learning_point).toBeTruthy();
  });

  it("pos-003 の SFEN（mate局面）で engineData が返る", () => {
    const sfen = "8k/7s1/6+R2/9/9/9/9/9/K8 b R2B4G3S4N4L18P 1";
    const data = lookupEngineData(sfen);

    expect(data).toBeDefined();
    expect(data!.eval_type).toBe("mate");
    expect(data!.bestmove_ja).toBe("▲5一飛打");
  });

  it("手数が異なっても盤面が同じなら一致する", () => {
    // 手数を99に変更しても盤面部分で一致
    const sfen = "lnsgkgsnl/1r5b1/pppppp1pp/6p2/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL b - 99";
    const data = lookupEngineData(sfen);

    expect(data).toBeDefined();
  });

  it("存在しない SFEN では undefined", () => {
    const sfen = "4k4/9/9/9/9/9/9/9/4K4 b - 1";
    const data = lookupEngineData(sfen);

    expect(data).toBeUndefined();
  });

  it("pos-001 lookup 経由で buildPlan が具体的な bestMove を返す", () => {
    // ブラウザ経由相当: engineData なしでSFENだけ送る
    const sfen = "lnsgkgsnl/1r5b1/pppppp1pp/6p2/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL b - 3";
    const data = lookupEngineData(sfen);

    expect(data).toBeDefined();

    // buildPlan に渡して bestMove が空でないことを確認
    const pos = parseSfen(sfen);
    const canonical = fromSfenPosition(pos);
    const plan = buildPlan(canonical, data);

    expect(plan.bestMove.ja).toBe("▲7八金");
    expect(plan.bestMove.usi).not.toBe("");
    expect(plan.facts.length).toBeGreaterThan(5);
  });
});

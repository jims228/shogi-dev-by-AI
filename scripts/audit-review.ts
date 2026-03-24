/**
 * Review mode のトレース収集スクリプト
 *
 * npm run dev でローカルサーバーを起動した状態で実行:
 *   npx tsx scripts/audit-review.ts
 *
 * 結果は data/audit/review-trace-XXX.json に保存される。
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = join(process.cwd(), "data/audit");

interface TestCase {
  id: string;
  position: string;
  reviewedMove: { usi: string; ja?: string };
  bestMove?: { usi: string; ja?: string };
}

const CASES: TestCase[] = [
  // pos-001: 序盤の角道を開けた直後
  {
    id: "case1",
    position: "lnsgkgsnl/1r5b1/pppppp1pp/6p2/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL b - 3",
    reviewedMove: { usi: "3i3h", ja: "▲3八銀" },
    bestMove: { usi: "6i7h", ja: "▲7八金" },
  },
  {
    id: "case2",
    position: "lnsgkgsnl/1r5b1/pppppp1pp/6p2/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL b - 3",
    reviewedMove: { usi: "2g2f", ja: "▲2六歩" },
    bestMove: { usi: "6i7h", ja: "▲7八金" },
  },
  {
    id: "case3",
    position: "lnsgkgsnl/1r5b1/pppppp1pp/6p2/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL b - 3",
    reviewedMove: { usi: "5i5h", ja: "▲5八玉" },
    bestMove: { usi: "6i7h", ja: "▲7八金" },
  },
  // pos-002: 中盤
  {
    id: "case4",
    position: "ln3gg1l/1r4sk1/p3ppppp/1p7/9/2PP5/P2SPPP1P/1KG1G2R1/LN6L b BSNPbsn3p 25",
    reviewedMove: { usi: "8h6f" },
  },
  // pos-003: 終盤詰み
  {
    id: "case5",
    position: "8k/7s1/6+R2/9/9/9/9/9/K8 b R2B4G3S4N4L18P 1",
    reviewedMove: { usi: "R*5b" },
    bestMove: { usi: "R*5a", ja: "▲5一飛打" },
  },
];

async function runCase(tc: TestCase): Promise<Record<string, unknown>> {
  const reqBody: Record<string, unknown> = {
    position: tc.position,
    reviewedMove: tc.reviewedMove,
    audience: "beginner",
  };
  if (tc.bestMove) {
    reqBody.bestMove = tc.bestMove;
  }

  console.log(`\n=== ${tc.id} ===`);
  console.log("Input:", JSON.stringify(reqBody, null, 2));

  const res = await fetch(`${BASE_URL}/api/review-move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reqBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`HTTP ${res.status}: ${errText}`);
    return { case: tc.id, error: `HTTP ${res.status}`, body: errText };
  }

  // Parse SSE
  const text = await res.text();
  const lines = text.split("\n").filter((l) => l.startsWith("data: "));

  let llmOutput = "";
  let verifyResult: Record<string, unknown> = {};
  let finalOutput = "";
  let outputType = "unknown";

  for (const line of lines) {
    const payload = line.slice(6);
    if (payload === "[DONE]") continue;

    try {
      const parsed = JSON.parse(payload);
      if (parsed.type === "text") {
        llmOutput += parsed.content;
        finalOutput = parsed.content;
        outputType = "text";
      } else if (parsed.type === "fallback") {
        finalOutput = parsed.content;
        outputType = "fallback";
      } else if (parsed.type === "verify") {
        verifyResult = parsed;
      }
    } catch {
      // skip
    }
  }

  console.log(`Output type: ${outputType}`);
  console.log(`Verify: passed=${verifyResult.passed}, issues=${JSON.stringify(verifyResult.issues)}`);
  console.log(`Final output (first 200): ${finalOutput.slice(0, 200)}`);

  return {
    case: tc.id,
    input: reqBody,
    outputType,
    llmOutput: llmOutput || "(fallback — no LLM text)",
    verifyResult,
    finalOutput,
  };
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const tc of CASES) {
    try {
      const result = await runCase(tc);
      const path = join(OUTPUT_DIR, `review-trace-${tc.id}.json`);
      writeFileSync(path, JSON.stringify(result, null, 2), "utf-8");
      console.log(`Saved: ${path}`);
    } catch (err) {
      console.error(`Failed ${tc.id}:`, err);
    }
  }

  console.log("\n=== Done ===");
}

main();

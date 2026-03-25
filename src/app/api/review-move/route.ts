/**
 * POST /api/review-move
 *
 * 悪手レビュー API。
 * ユーザーの手と最善手を比較し、差の因果を初心者向けに説明する。
 * 非ストリーミング: LLM全文取得 → verify → 本文 or fallback
 */

import { NextRequest } from "next/server";
import { parseSfen } from "@/lib/shogi/parser";
import { getSystemPrompt, buildMistakeReviewPrompt } from "@/lib/ai/prompt";
import { getClient, MODEL, MAX_TOKENS } from "@/lib/ai/client";
import type { EngineData } from "@/lib/ai/prompt";
import type { MistakeReviewPlan } from "@/lib/ai/plan";
import type { Content } from "@google/genai";
import { fromSfenPosition } from "@/lib/shogi/canonical";
import { buildMistakeReviewPlan } from "@/lib/ai/mistake-planner";
import { verifyMistakeReview } from "./verify";
import { lookupEngineData } from "@/lib/ai/engine-lookup";

interface ReviewRequest {
  position: string;
  reviewedMove: { usi: string; ja?: string };
  bestMove?: { usi: string; ja?: string };
  engineData?: EngineData;
  audience?: "beginner" | "intermediate";
}

export async function POST(request: NextRequest) {
  let body: ReviewRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "リクエストのJSONが不正です" },
      { status: 400 }
    );
  }

  if (!body.position || typeof body.position !== "string") {
    return Response.json(
      { error: "position フィールド（SFEN文字列）が必要です" },
      { status: 400 }
    );
  }

  if (!body.reviewedMove?.usi) {
    return Response.json(
      { error: "reviewedMove.usi が必要です" },
      { status: 400 }
    );
  }

  let sfenPosition;
  try {
    sfenPosition = parseSfen(body.position);
  } catch (e) {
    return Response.json(
      { error: `SFENのパースに失敗しました: ${(e as Error).message}` },
      { status: 400 }
    );
  }

  const canonical = fromSfenPosition(sfenPosition);

  // Engine data: client-provided > lookup
  const engineData = body.engineData ?? lookupEngineData(body.position);

  // bestMove: client-provided > engineData.bestmove
  const bestMove = body.bestMove ?? (engineData
    ? {
        usi: engineData.bestmove,
        ja: engineData.bestmove_ja ?? engineData.candidates?.[0]?.move_ja,
      }
    : { usi: "" });

  if (!bestMove.usi) {
    return Response.json(
      { error: "bestMove が特定できません。bestMove または engineData を指定してください" },
      { status: 400 }
    );
  }

  // Build plan
  console.log("[review] input:", JSON.stringify({ position: body.position, reviewedMove: body.reviewedMove, bestMove }));

  const plan = buildMistakeReviewPlan(
    canonical,
    body.reviewedMove,
    bestMove,
    engineData
  );
  console.log("[review] plan:", JSON.stringify(plan, null, 2));
  if (plan.failReason) {
    console.log("[review] failReason:", plan.failReason);
  }

  const systemPrompt = getSystemPrompt();
  const userMessage = buildMistakeReviewPrompt(plan);
  console.log("[review] prompt:", userMessage.slice(0, 500));

  const contents: Content[] = [
    { role: "user", parts: [{ text: userMessage }] },
  ];

  try {
    const client = getClient();
    const response = await client.models.generateContent({
      model: MODEL,
      config: {
        maxOutputTokens: MAX_TOKENS,
        systemInstruction: systemPrompt,
      },
      contents,
    });

    const fullOutput = response.text ?? "";
    console.log("[review] LLM output:", fullOutput);

    // Verify
    const verifyResult = verifyMistakeReview(fullOutput, plan);
    console.log("[review] verify:", JSON.stringify(verifyResult));

    // SSE response (same format as /api/explain for client compat)
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        if (verifyResult.passed) {
          const data = JSON.stringify({ type: "text", content: fullOutput });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } else {
          const fallback = buildReviewFallback(plan);
          const data = JSON.stringify({ type: "fallback", content: fallback });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }

        const verifyData = JSON.stringify({
          type: "verify",
          passed: verifyResult.passed,
          issues: verifyResult.issues,
          warnings: verifyResult.warnings,
        });
        controller.enqueue(encoder.encode(`data: ${verifyData}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("Gemini API error:", err);
    return Response.json(
      { error: "Gemini APIの呼び出しに失敗しました" },
      { status: 500 }
    );
  }
}

function buildReviewFallback(plan: MistakeReviewPlan): string {
  const lines: string[] = [];

  lines.push(`【あなたの手】${plan.context.reviewedMove.ja ?? plan.context.reviewedMove.usi}`);

  if (plan.betterIdea) {
    lines.push(`【より良い手】${plan.betterIdea.ja}。${plan.betterIdea.reason}`);
  }

  if (plan.whyChains.length > 0) {
    const summary = plan.whyChains[0].links[0]?.statement ?? "";
    lines.push(`【要点】${summary}`);
  }

  lines.push(`【次に見るべきこと】${plan.nextLookFor}`);

  if (plan.retryQuestion) {
    lines.push(`【考えてみよう】${plan.retryQuestion}`);
  }

  lines.push("");
  lines.push("※ 詳細な因果説明はまだ安定しなかったため、要点のみを表示しています。");

  return lines.join("\n");
}

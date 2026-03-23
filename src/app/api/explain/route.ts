/**
 * POST /api/explain
 *
 * パイプライン切り替え:
 *   X-Pipeline: plan   → ExplanationPlan ベース（デフォルト）
 *     - 非ストリーミング: LLM全文取得 → verify → 本文 or fallback
 *   X-Pipeline: legacy → 従来の buildUserMessage（ストリーミング）
 */

import { NextRequest } from "next/server";
import { parseSfen } from "@/lib/shogi/parser";
import {
  getSystemPrompt,
  buildUserMessage,
  buildPlanPrompt,
} from "@/lib/ai/prompt";
import { getClient, MODEL, MAX_TOKENS } from "@/lib/ai/client";
import type { EngineData } from "@/lib/ai/prompt";
import type { ExplanationPlan } from "@/lib/ai/plan";
import type { Content } from "@google/genai";
import { fromSfenPosition } from "@/lib/shogi/canonical";
import { buildPlan } from "@/lib/ai/planner";
import { verifyExplanation } from "@/lib/ai/verifier";
import { lookupEngineData } from "@/lib/ai/engine-lookup";
import { positionToSfen } from "@/lib/shogi/move";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ExplainRequest {
  position: string;
  question?: string;
  engineData?: EngineData;
  history?: Message[];
}

export async function POST(request: NextRequest) {
  const pipeline = request.headers.get("X-Pipeline") ?? "plan";

  let body: ExplainRequest;
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

  let sfenPosition;
  try {
    sfenPosition = parseSfen(body.position);
  } catch (e) {
    return Response.json(
      { error: `SFENのパースに失敗しました: ${(e as Error).message}` },
      { status: 400 }
    );
  }

  if (pipeline === "plan") {
    return handlePlanPipeline(sfenPosition, body);
  } else {
    return handleLegacyPipeline(sfenPosition, body);
  }
}

// ============================================================
// Plan pipeline (non-streaming, verify-before-display)
// ============================================================

async function handlePlanPipeline(
  sfenPosition: ReturnType<typeof parseSfen>,
  body: ExplainRequest
) {
  const systemPrompt = getSystemPrompt();
  const canonical = fromSfenPosition(sfenPosition);

  // Engine data: client-provided > lookup from pre-computed data
  const engineData = body.engineData ?? lookupEngineData(body.position);

  const plan = buildPlan(canonical, engineData);
  const userMessage = buildPlanPrompt(plan);

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

    // Verify before display
    const verifyResult = verifyExplanation(fullOutput, plan);

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        if (verifyResult.passed) {
          // Verified: send the full output
          const data = JSON.stringify({ type: "text", content: fullOutput });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } else {
          // Failed: send fallback
          const fallbackContent = buildFallback(plan, verifyResult.issues);
          const data = JSON.stringify({ type: "fallback", content: fallbackContent });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }

        // Always send verify result
        const verifyData = JSON.stringify({
          type: "verify",
          passed: verifyResult.passed,
          issues: verifyResult.issues,
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

function buildFallback(plan: ExplanationPlan, issues: string[]): string {
  const factsSummary = plan.facts.slice(0, 3).join("\n");
  return (
    `【局面の要点】\n${factsSummary}\n\n` +
    `【学びのポイント】\n${plan.teachingPoint}\n\n` +
    `※ 詳細な手順説明はまだ安定しなかったため、要点のみを表示しています。`
  );
}

// ============================================================
// Legacy pipeline (streaming, backward compat)
// ============================================================

async function handleLegacyPipeline(
  sfenPosition: ReturnType<typeof parseSfen>,
  body: ExplainRequest
) {
  const systemPrompt = getSystemPrompt();
  const userMessage = buildUserMessage({
    position: sfenPosition,
    engineData: body.engineData,
    question: body.question,
  });

  const contents: Content[] = [];

  if (body.history && body.history.length > 0) {
    for (const msg of body.history) {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      });
    }
  }

  const isFollowUp = body.history && body.history.length > 0 && body.question;
  contents.push({
    role: "user",
    parts: [{ text: isFollowUp ? body.question! : userMessage }],
  });

  try {
    const client = getClient();
    const stream = await client.models.generateContentStream({
      model: MODEL,
      config: {
        maxOutputTokens: MAX_TOKENS,
        systemInstruction: systemPrompt,
      },
      contents,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.text;
            if (text) {
              const data = JSON.stringify({ type: "text", content: text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("Stream error:", err);
          const errorData = JSON.stringify({
            type: "error",
            content: "解説の生成中にエラーが発生しました",
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
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

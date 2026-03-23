/**
 * POST /api/explain
 *
 * SFEN局面を受け取り、Gemini APIで解説を生成してストリーミングで返す。
 * history パラメータで会話コンテキストを維持する。
 *
 * パイプライン切り替え:
 *   X-Pipeline: plan   → ExplanationPlan ベース（デフォルト）
 *   X-Pipeline: legacy → 従来の buildUserMessage
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

  const systemPrompt = getSystemPrompt();

  // Build user message and plan based on pipeline
  let userMessage: string;
  let plan: ExplanationPlan | null = null;

  if (pipeline === "plan") {
    const canonical = fromSfenPosition(sfenPosition);
    plan = buildPlan(canonical, body.engineData);
    userMessage = buildPlanPrompt(plan);
  } else {
    userMessage = buildUserMessage({
      position: sfenPosition,
      engineData: body.engineData,
      question: body.question,
    });
  }

  // Build conversation contents from history + current message
  const contents: Content[] = [];

  if (body.history && body.history.length > 0) {
    for (const msg of body.history) {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      });
    }
  }

  // For follow-up questions in legacy mode, send just the question text
  const isFollowUp =
    pipeline !== "plan" &&
    body.history &&
    body.history.length > 0 &&
    body.question;
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
        let fullOutput = "";
        try {
          for await (const chunk of stream) {
            const text = chunk.text;
            if (text) {
              fullOutput += text;
              const data = JSON.stringify({
                type: "text",
                content: text,
              });
              controller.enqueue(
                encoder.encode(`data: ${data}\n\n`)
              );
            }
          }

          // Run verifier for plan pipeline
          if (plan) {
            const verifyResult = verifyExplanation(fullOutput, plan);
            const verifyData = JSON.stringify({
              type: "verify",
              passed: verifyResult.passed,
              issues: verifyResult.issues,
            });
            controller.enqueue(
              encoder.encode(`data: ${verifyData}\n\n`)
            );
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("Stream error:", err);
          const errorData = JSON.stringify({
            type: "error",
            content: "解説の生成中にエラーが発生しました",
          });
          controller.enqueue(
            encoder.encode(`data: ${errorData}\n\n`)
          );
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

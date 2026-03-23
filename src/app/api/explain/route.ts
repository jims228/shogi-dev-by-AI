/**
 * POST /api/explain
 *
 * SFEN局面を受け取り、Gemini APIで解説を生成してストリーミングで返す。
 * history パラメータで会話コンテキストを維持する。
 */

import { NextRequest } from "next/server";
import { parseSfen } from "@/lib/shogi/parser";
import { getSystemPrompt, buildUserMessage } from "@/lib/ai/prompt";
import { getClient, MODEL, MAX_TOKENS } from "@/lib/ai/client";
import type { EngineData } from "@/lib/ai/prompt";
import type { Content } from "@google/genai";

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
  const userMessage = buildUserMessage({
    position: sfenPosition,
    engineData: body.engineData,
    question: body.question,
  });

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

  // For follow-up questions, send just the question text (context is in history)
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
              const data = JSON.stringify({
                type: "text",
                content: text,
              });
              controller.enqueue(
                encoder.encode(`data: ${data}\n\n`)
              );
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

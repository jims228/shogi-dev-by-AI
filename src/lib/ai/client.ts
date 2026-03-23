/**
 * Gemini API クライアント
 */

import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

export function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY 環境変数が設定されていません");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export const MODEL = "gemini-2.5-flash";
export const MAX_TOKENS = 4096;

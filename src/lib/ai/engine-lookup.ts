/**
 * エンジンデータの事前計算キャッシュ
 *
 * data/prompt-examples/*.json を読み込み、SFENをキーにルックアップする。
 * 5局面限定の応急処置。一般局面には別途 engine API が必要。
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { EngineData } from "./prompt";
import type { ExtendedEngineData } from "./planner";

interface PositionData {
  sfen: string;
  engine_data: EngineData;
  common_mistake?: string;
  learning_point?: string;
  verification_note?: string;
}

let cache: Map<string, ExtendedEngineData> | null = null;

/**
 * SFEN の盤面部分のみで比較するための正規化
 * "lnsgkgsnl/... b - 1" → "lnsgkgsnl/... b -" (手数を除去)
 */
function normalizeSfen(sfen: string): string {
  const parts = sfen.trim().split(/\s+/);
  // 盤面 + 手番 + 持ち駒（手数は無視）
  return parts.slice(0, 3).join(" ");
}

function loadCache(): Map<string, ExtendedEngineData> {
  if (cache) return cache;

  cache = new Map();
  const dir = join(process.cwd(), "data/prompt-examples");

  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return cache;
  }

  for (const file of files) {
    try {
      const raw = readFileSync(join(dir, file), "utf-8");
      const data: PositionData = JSON.parse(raw);
      const key = normalizeSfen(data.sfen);

      // bestmove_ja を candidates[0].move_ja から補完
      const bestmoveJa = data.engine_data.bestmove_ja
        ?? data.engine_data.candidates?.[0]?.move_ja;

      const extended: ExtendedEngineData = {
        ...data.engine_data,
        bestmove_ja: bestmoveJa,
        common_mistake: data.common_mistake,
        learning_point: data.learning_point,
        verification_note: data.verification_note,
      };

      cache.set(key, extended);
    } catch {
      // skip malformed files
    }
  }

  return cache;
}

/**
 * SFENに一致するエンジンデータをルックアップする
 * 見つからない場合は undefined
 */
export function lookupEngineData(sfen: string): ExtendedEngineData | undefined {
  const c = loadCache();
  const key = normalizeSfen(sfen);
  return c.get(key);
}

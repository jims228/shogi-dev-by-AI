/**
 * Opening card loader & matcher
 *
 * data/opening-cards/*.json を読み込み、moveHistory に基づいて
 * マッチするカードを返す。
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

export interface OpeningCard {
  id: string;
  name: string;
  category: string;
  triggerMoves: string[];
  phase: string;
  shortDescription: string;
  coachAngle: string;
  caution?: string | null;
  keyTerms?: string[];
  relatedCards?: string[];
}

let cache: OpeningCard[] | null = null;

function loadCards(): OpeningCard[] {
  if (cache) return cache;

  cache = [];
  const dir = join(process.cwd(), "data/opening-cards");

  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return cache;
  }

  for (const file of files) {
    try {
      const raw = readFileSync(join(dir, file), "utf-8");
      const card = JSON.parse(raw) as OpeningCard;
      cache.push(card);
    } catch {
      // skip malformed
    }
  }

  return cache;
}

/**
 * moveHistory に含まれる手と triggerMoves を照合してヒットするカードを返す。
 * triggerMoves の全要素が moveHistory に含まれていればヒット（順序不問）。
 * triggerMoves が空のカード（opening-undecided）は除外。
 */
export function matchOpeningCards(
  moveHistory: string[],
  cards?: OpeningCard[]
): OpeningCard[] {
  const allCards = cards ?? loadCards();
  const moveSet = new Set(moveHistory);

  return allCards.filter((card) => {
    if (card.triggerMoves.length === 0) return false;
    return card.triggerMoves.every((m) => moveSet.has(m));
  });
}

/**
 * triggerMoves が多いカードを優先し、最大3枚に絞る。
 */
export function prioritizeCards(matched: OpeningCard[]): OpeningCard[] {
  return [...matched]
    .sort((a, b) => b.triggerMoves.length - a.triggerMoves.length)
    .slice(0, 3);
}

/**
 * opening-undecided カードを返す（fallback 用）。
 */
export function getUndecidedCard(cards?: OpeningCard[]): OpeningCard | undefined {
  const allCards = cards ?? loadCards();
  return allCards.find((c) => c.id === "opening-undecided");
}

/**
 * 序盤の moveHistory に基づいてヒットしたカードを返す。
 * ヒットなし かつ moveNumber <= 10 の場合は undecided を fallback として返す。
 */
export function resolveOpeningCards(
  moveHistory: string[],
  moveNumber: number
): OpeningCard[] {
  const matched = matchOpeningCards(moveHistory);
  const prioritized = prioritizeCards(matched);

  if (prioritized.length > 0) return prioritized;

  // Fallback: undecided
  if (moveNumber <= 10) {
    const undecided = getUndecidedCard();
    if (undecided) return [undecided];
  }

  return [];
}

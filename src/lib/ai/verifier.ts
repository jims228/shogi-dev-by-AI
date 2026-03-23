/**
 * Lightweight verifier
 *
 * LLM出力をExplanationPlanと照合し、事実の逸脱を検出する。
 * LLMは使わず、パターンマッチのみで高速に動作する。
 */

import type { ExplanationPlan } from "./plan";

export interface VerifyResult {
  passed: boolean;
  issues: string[];
}

/** 評価値の数字パターン: +127, -300, +1500 等 */
const RAW_EVAL_PATTERN = /[+\-]\d{2,}/g;

/** 将棋座標パターン: ○筋○段 or ○○（数字+漢数字） */
const COORDINATE_PATTERN = /[１２３４５６７８９][一二三四五六七八九]/g;

/**
 * LLM出力をExplanationPlanと照合して検証する
 */
export function verifyExplanation(
  output: string,
  plan: ExplanationPlan
): VerifyResult {
  const issues: string[] = [];

  // 1. forbiddenClaims 違反チェック
  checkForbiddenClaims(output, plan.forbiddenClaims, issues);

  // 2. 評価値の数字が直接出ていないか
  checkRawEvalValues(output, issues);

  // 3. bestMove の言及チェック
  checkBestMoveMentioned(output, plan, issues);

  // 4. facts 外の座標言及チェック
  checkUnknownCoordinates(output, plan.facts, plan.forbiddenClaims, issues);

  // 5. 出力の切断チェック
  if (isTruncated(output)) {
    issues.push("出力が途中で切れています");
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

/**
 * forbiddenClaims の違反を検出する
 */
function checkForbiddenClaims(
  output: string,
  forbiddenClaims: string[],
  issues: string[]
): void {
  for (const claim of forbiddenClaims) {
    // 「○○は△△にいる（これと矛盾する位置を述べてはいけない）」形式をパース
    const piecePositionMatch = claim.match(
      /(.+の(?:飛車?|角|龍|馬))は([１２３４５６７８９][一二三四五六七八九])にいる/
    );
    if (piecePositionMatch) {
      const [, pieceName, correctPos] = piecePositionMatch;
      // 同じ駒が別の位置に言及されていないか確認
      const pieceBase = pieceName.replace(/先手の|後手の/, "");
      // 「飛車が○○にいる」「飛車は○○」等の柔軟なパターン
      const mentionPattern = new RegExp(
        `${pieceBase}[がはをの].*?([１２３４５６７８９][一二三四五六七八九])`,
        "g"
      );
      let match;
      while ((match = mentionPattern.exec(output)) !== null) {
        if (match[1] !== correctPos) {
          issues.push(
            `禁止事項違反: ${pieceName}の位置が${correctPos}ではなく${match[1]}と記述されています`
          );
        }
      }
      continue;
    }

    // 「評価値の数字を直接言わない」はcheckRawEvalValuesで別途チェック
    if (claim.includes("評価値の数字")) continue;

    // その他の禁止事項: キーワードマッチ
    // claim から括弧内の補足を除去してキーワードを抽出
    const keyword = claim.replace(/（.*?）/g, "").trim();
    if (keyword.length > 2 && output.includes(keyword)) {
      issues.push(`禁止事項違反: "${keyword}" が出力に含まれています`);
    }
  }
}

/**
 * 評価値の数字が直接出力されていないか検出する
 */
function checkRawEvalValues(output: string, issues: string[]): void {
  const matches = output.match(RAW_EVAL_PATTERN);
  if (matches) {
    // 手数表記（例: "3手詰み"の前の数字）や手順番号を除外
    const suspicious = matches.filter((m) => {
      const num = parseInt(m, 10);
      const absNum = Math.abs(num);
      // 1桁の数字や、年号・手数として自然な範囲は除外
      return absNum >= 50 && absNum < 10000;
    });
    if (suspicious.length > 0) {
      issues.push(
        `評価値の数字が直接出力されています: ${suspicious.join(", ")}`
      );
    }
  }
}

/**
 * bestMove が出力に言及されているか確認する
 */
function checkBestMoveMentioned(
  output: string,
  plan: ExplanationPlan,
  issues: string[]
): void {
  const bestMoveJa = plan.bestMove.ja;
  if (!bestMoveJa || bestMoveJa === "不明") return;

  // ▲/△ を除去して駒名+位置で検索
  const stripped = bestMoveJa.replace(/^[▲△]/, "");
  if (stripped.length >= 2 && !output.includes(stripped)) {
    issues.push(
      `最善手 ${bestMoveJa} が出力に含まれていません`
    );
  }
}

/**
 * facts に存在しない将棋座標が出力に含まれていないか検出する
 */
function checkUnknownCoordinates(
  output: string,
  facts: string[],
  forbiddenClaims: string[],
  issues: string[]
): void {
  // facts から座標を抽出
  const knownCoords = new Set<string>();
  for (const fact of facts) {
    const matches = fact.match(COORDINATE_PATTERN);
    if (matches) {
      for (const m of matches) {
        knownCoords.add(m);
      }
    }
  }
  // forbiddenClaims からも座標を抽出
  for (const claim of forbiddenClaims) {
    const matches = claim.match(COORDINATE_PATTERN);
    if (matches) {
      for (const m of matches) {
        knownCoords.add(m);
      }
    }
  }

  // facts に座標がない場合（エンジンデータなし等）はチェックしない
  if (knownCoords.size === 0) return;

  // 出力から座標を抽出
  const outputCoords = output.match(COORDINATE_PATTERN);
  if (!outputCoords) return;

  const unknownCoords = new Set<string>();
  for (const coord of outputCoords) {
    if (!knownCoords.has(coord)) {
      unknownCoords.add(coord);
    }
  }

  if (unknownCoords.size > 0) {
    issues.push(
      `plan.factsにない座標への言及: ${[...unknownCoords].join(", ")}`
    );
  }
}

// ============================================================
// Truncation guard
// ============================================================

/**
 * 出力が途中で切れていないかチェックする
 */
export function isTruncated(output: string): boolean {
  const trimmed = output.trim();

  // 明らかに短すぎる
  if (trimmed.length < 50) return true;

  // 閉じていない括弧
  const openParens = (trimmed.match(/[（「『【]/g) || []).length;
  const closeParens = (trimmed.match(/[）」』】]/g) || []).length;
  if (openParens > closeParens) return true;

  // 句点で終わっていない（最後の文字が。でない場合）
  const lastChar = trimmed[trimmed.length - 1];
  const endsWithTerminator = lastChar === "。" || lastChar === "」" || lastChar === "）" || lastChar === "！" || lastChar === "？" || lastChar === "】";
  if (!endsWithTerminator) return true;

  return false;
}

/**
 * MistakeReviewPlan 用の検証
 *
 * 既存の verifier ロジックを MistakeReviewPlan に適用するアダプタ。
 */

import type { MistakeReviewPlan } from "../../../lib/ai/plan";
import { isTruncated, type VerifyResult } from "../../../lib/ai/verifier";

/**
 * 悪手レビュー出力を検証する
 */
export function verifyMistakeReview(
  output: string,
  plan: MistakeReviewPlan
): VerifyResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  // 1. truncation チェック
  if (isTruncated(output)) {
    issues.push("出力が途中で切れています");
  }

  // 2. 評価値の数字チェック
  const rawEvalPattern = /[+\-]\d{2,}/g;
  const matches = output.match(rawEvalPattern);
  if (matches) {
    const suspicious = matches.filter((m) => {
      const absNum = Math.abs(parseInt(m, 10));
      return absNum >= 50 && absNum < 10000;
    });
    if (suspicious.length > 0) {
      issues.push(`評価値の数字が直接出力されています: ${suspicious.join(", ")}`);
    }
  }

  // 3. reviewedMove が出力に言及されているか
  const reviewedJa = plan.context.reviewedMove.ja;
  if (reviewedJa) {
    const stripped = reviewedJa.replace(/^[▲△]/, "");
    if (stripped.length >= 2 && !output.includes(stripped)) {
      issues.push(`レビュー対象の手 ${reviewedJa} が出力に含まれていません`);
    }
  }

  // 4. betterIdea が出力に言及されているか
  if (plan.betterIdea) {
    const betterJa = plan.betterIdea.ja;
    const stripped = betterJa.replace(/^[▲△]/, "");
    if (stripped.length >= 2 && !output.includes(stripped)) {
      warnings.push(`より良い手 ${betterJa} が出力に含まれていません`);
    }
  }

  // 5. forbiddenClaims チェック（キーワードレベル）
  for (const claim of plan.forbiddenClaims) {
    if (claim.includes("評価値の数字")) continue; // 上でチェック済み
    const keyword = claim.replace(/（.*?）/g, "").trim();
    if (keyword.length > 2 && output.includes(keyword)) {
      issues.push(`禁止事項違反: "${keyword}" が出力に含まれています`);
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    warnings,
  };
}

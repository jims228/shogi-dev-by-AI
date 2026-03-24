/**
 * ExplanationPlan 型定義
 *
 * LLM に渡す前に「何を説明すべきか」を構造化するための中間表現。
 * buildPlan() がこの型を生成し、プロンプト構築がこれを言語化する。
 */

/** 解説の焦点カテゴリ */
export type FocusCategory =
  | "threat"
  | "bestmove_meaning"
  | "comparison"
  | "king_safety"
  | "piece_activity"
  | "concept"
  | "common_mistake";

/** 解説計画 */
export type ExplanationPlan = {
  /** ターゲット棋力 */
  audience: "beginner" | "intermediate";

  /** 解説の焦点（優先順） */
  focus: FocusCategory[];

  /** LLM に伝える事実（盤面から導出された客観的情報） */
  facts: string[];

  /** 最善手の情報 */
  bestMove: {
    usi: string;
    ja: string;
    reason: string;
    mainLine?: string[];
  };

  /** 比較対象の候補手（1つだけ） */
  meaningfulAlternative?: {
    usi: string;
    ja: string;
    whyWorse: string;
  };

  /** 初心者がやりがちなミス */
  commonMistake?: {
    ja: string;
    whyTempting: string;
    whyBad: string;
  };

  /** この局面から学べること（1文） */
  teachingPoint: string;

  /** LLM が言ってはいけない主張のリスト */
  forbiddenClaims: string[];

  /** 生成後に LLM に自問させる質問 */
  retryQuestion?: string;

  /** plan の確信度（エンジンデータの有無等で決まる） */
  confidence: "high" | "medium" | "low";
};

// ============================================================
// MistakeReviewPlan 関連の型
// ============================================================

/** WhyLink の種別 */
export type WhyLinkKind =
  | "local_fact"
  | "exchange"
  | "safety"
  | "line_opening"
  | "piece_activity"
  | "king_safety"
  | "future_threat"
  | "lesson";

/** 因果の1リンク */
export type WhyLink = {
  kind: WhyLinkKind;
  statement: string;
  evidence?: string;
  confidence: "high" | "medium" | "low";
};

/** 因果チェーン（1つのトピック） */
export type WhyChain = {
  topic: string;
  links: WhyLink[];
};

/** 悪手の物語的役割 */
export type NarrativeRole =
  | "missed_defense"
  | "overattack"
  | "bad_exchange"
  | "slow_move"
  | "king_exposed"
  | "missed_tactic";

/** レビュー対象の文脈 */
export type ContextWindow = {
  previousMoves: string[];
  reviewedMove: { usi: string; ja?: string };
  expectedReply?: { usi: string; ja?: string };
  phase: "opening" | "middle" | "endgame";
  narrativeRole: NarrativeRole;
};

/** 悪手レビュー計画 */
export type MistakeReviewPlan = {
  audience: "beginner" | "intermediate";
  context: ContextWindow;
  whyChains: WhyChain[];
  betterIdea?: {
    usi: string;
    ja: string;
    reason: string;
    evalExpression?: string;
  };
  keyTerms: string[];
  nextLookFor: string;
  retryQuestion?: string;
  confidence: "high" | "medium" | "low";
  /** LLM が言ってはいけない主張 */
  forbiddenClaims: string[];
  /** LLM に伝える事実 */
  facts: string[];
  /** 入力検証の失敗理由（設定されていれば LLM 呼び出しをスキップすべき） */
  failReason?: "invalid_from_square" | "no_piece_on_from" | "illegal_move" | "notation_generation_failed" | "best_move_mismatch";
};

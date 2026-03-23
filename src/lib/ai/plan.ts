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

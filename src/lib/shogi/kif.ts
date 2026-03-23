/**
 * KIF形式の棋譜パーサー
 *
 * KIF形式（長形式）をUSI指し手リストに変換する。
 * 「同」記法、駒打ち（"３三歩打"）、成り（"成"/"不成"）に対応。
 *
 * KIF形式の例:
 *   1 ７六歩(77)        ( 0:01/00:00:01)
 *   2 ３四歩(34)        ( 0:01/00:00:01)
 *   3 同　銀(43)        ( 0:05/00:00:06)
 */

/** 漢数字 → 半角数字 */
const KANJI_TO_NUM: Record<string, string> = {
  "一": "1", "二": "2", "三": "3", "四": "4", "五": "5",
  "六": "6", "七": "7", "八": "8", "九": "9",
};

/** 全角数字 → 半角数字 */
const ZEN_TO_HAN: Record<string, string> = {
  "１": "1", "２": "2", "３": "3", "４": "4", "５": "5",
  "６": "6", "７": "7", "８": "8", "９": "9", "０": "0",
};

/** 数字(1-9) → USIランク文字(a-i) */
const NUM_TO_RANK: Record<string, string> = {
  "1": "a", "2": "b", "3": "c", "4": "d", "5": "e",
  "6": "f", "7": "g", "8": "h", "9": "i",
};

/** 駒名 → USI駒文字 */
const PIECE_TO_USI: Record<string, string> = {
  "歩": "P", "香": "L", "桂": "N", "銀": "S", "金": "G",
  "角": "B", "飛": "R", "玉": "K", "王": "K",
};

/**
 * テキストを正規化する（全角→半角、NFKC正規化、改行統一）
 */
function normalize(src: string): string {
  let s = src.normalize("NFKC");
  // 全角数字を半角に
  s = s.replace(/[０-９]/g, (ch) => ZEN_TO_HAN[ch] ?? ch);
  // CR除去
  s = s.replace(/\r/g, "");
  return s;
}

/**
 * 数字文字または漢数字を半角数字に変換
 */
function toHalfNum(ch: string): string {
  return KANJI_TO_NUM[ch] ?? ZEN_TO_HAN[ch] ?? ch;
}

/**
 * 入力テキストがKIF形式かどうかを判定する
 */
export function isKifFormat(text: string): boolean {
  const normalized = normalize(text);
  // KIF形式の特徴的なパターン
  if (/手数.*指し?手/.test(normalized)) return true;
  if (/^\s*\d+\s+[1-9一二三四五六七八九]/.test(normalized)) return true;
  if (/[▲△]\s*[1-9一二三四五六七八九]/.test(normalized)) return true;
  if (/^\s*\d+\s+同/.test(normalized)) return true;
  return false;
}

/**
 * KIF形式の棋譜テキストをUSI指し手リストに変換する
 *
 * 対応形式:
 * - 長形式: "７六歩(77)" — 移動元の座標が括弧内に記載
 * - 「同」記法: "同　銀(43)" — 前の手と同じ地点への移動
 * - 駒打ち: "３三歩打" — 持ち駒を打つ
 * - 成り: "７七角成(88)" — 成りを明示
 * - 不成: "２三歩不成(24)" — 不成を明示
 */
export function kifToUsiMoves(kif: string): string[] {
  const normalized = normalize(kif);
  const lines = normalized.split("\n");
  const moves: string[] = [];
  let lastTo: string | null = null;
  let inMoveSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // 手数ヘッダーを検出
    if (/手数.*指し?手/.test(line)) {
      inMoveSection = true;
      continue;
    }

    // 終局マーカーで終了
    if (/まで\d+手で/.test(line) || /中断/.test(line) || /投了/.test(line)) {
      break;
    }

    // 指し手行の自動検出
    if (!inMoveSection) {
      if (/^\s*\d+\s+[1-9一二三四五六七八九同▲△]/.test(line) || /^[▲△]/.test(line)) {
        inMoveSection = true;
      } else {
        continue;
      }
    }

    // コメント行、空行、時間のみの行をスキップ
    if (line.startsWith("*") || line.startsWith("#") || !line) continue;
    if (/^\(\d{2}:\d{2}/.test(line)) continue;

    // 指し手部分を抽出（"1 ７六歩(77) (0:01/...)" → "７六歩(77)"）
    let movePart = line;
    const lineMatch = /^\s*\d+\s+(.+)/.exec(line);
    if (lineMatch) {
      movePart = lineMatch[1];
    } else if (/^[▲△]/.test(line)) {
      movePart = line;
    } else {
      continue;
    }

    // 時間情報を除去（コロンを含む括弧のみ = 時間表記）
    movePart = movePart.replace(/\s*\(\s*\d+:\d+[^)]*\).*$/, "").trim();

    const usi = parseKifMove(movePart, lastTo);
    if (usi) {
      moves.push(usi.move);
      lastTo = usi.to;
    }
  }

  return moves;
}

interface ParsedMove {
  move: string; // USI形式の指し手
  to: string;   // 移動先 (次の「同」で使う)
}

/**
 * 1つのKIF指し手をUSI形式に変換する
 */
function parseKifMove(movePart: string, lastTo: string | null): ParsedMove | null {
  // 駒打ち: "▲３三歩打" or "３三歩打"
  const dropRe = /^[▲△]?\s*([1-9一二三四五六七八九])([1-9一二三四五六七八九])\s*([歩香桂銀金角飛玉王])\s*打/;
  const dropMatch = dropRe.exec(movePart);
  if (dropMatch) {
    const [, colRaw, rowRaw, pieceKanji] = dropMatch;
    const col = toHalfNum(colRaw);
    const row = toHalfNum(rowRaw);
    const rank = NUM_TO_RANK[row];
    const piece = PIECE_TO_USI[pieceKanji];
    if (!piece || !rank) return null;
    const to = `${col}${rank}`;
    return { move: `${piece}*${to}`, to };
  }

  // 「同」記法: "同　銀(43)" or "▲同歩(76)"
  const sameRe = /^[▲△]?\s*同\s*[^\(]*\((\d)(\d)\)/;
  const sameMatch = sameRe.exec(movePart);
  if (sameMatch) {
    if (!lastTo) return null;
    const [, fromCol, fromRow] = sameMatch;
    if (fromCol === "0" || fromRow === "0") return null;
    const fromRank = NUM_TO_RANK[fromRow];
    if (!fromRank) return null;
    const from = `${fromCol}${fromRank}`;
    const promote = /成/.test(movePart) && !/不成/.test(movePart) ? "+" : "";
    return { move: `${from}${lastTo}${promote}`, to: lastTo };
  }

  // 長形式: "▲７六歩(77)" or "７六歩(77)"
  const longRe = /^[▲△]?\s*([1-9一二三四五六七八九])([1-9一二三四五六七八九])\s*[^\(]*\((\d)(\d)\)/;
  const longMatch = longRe.exec(movePart);
  if (longMatch) {
    const [, colRaw, rowRaw, fromCol, fromRow] = longMatch;
    if (fromCol === "0" || fromRow === "0") return null;
    const col = toHalfNum(colRaw);
    const row = toHalfNum(rowRaw);
    const toRank = NUM_TO_RANK[row];
    const fromRank = NUM_TO_RANK[fromRow];
    if (!toRank || !fromRank) return null;
    const from = `${fromCol}${fromRank}`;
    const to = `${col}${toRank}`;
    const promote = /成/.test(movePart) && !/不成/.test(movePart) ? "+" : "";
    return { move: `${from}${to}${promote}`, to };
  }

  return null;
}

"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import ShogiBoard from "./ShogiBoard";
import { parseSfen } from "@/lib/shogi/parser";
import { generatePositions, positionToSfen } from "@/lib/shogi/move";
import { isKifFormat, kifToUsiMoves } from "@/lib/shogi/kif";
import type { SfenPosition } from "@/lib/shogi/types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SAMPLE_SFEN = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";

const SAMPLE_KIF = `手数----指し手---------消費時間--
   1 ７六歩(77)        ( 0:01/00:00:01)
   2 ３四歩(33)        ( 0:01/00:00:01)
   3 ２六歩(27)        ( 0:01/00:00:02)`;

export default function Chat() {
  const [rawInput, setRawInput] = useState("");
  const [inputMode, setInputMode] = useState<"sfen" | "kif" | null>(null);
  const [parseError, setParseError] = useState("");
  const [positions, setPositions] = useState<SfenPosition[]>([]);
  const [moveIndex, setMoveIndex] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentPosition = useMemo(
    () => (positions.length > 0 ? positions[moveIndex] : null),
    [positions, moveIndex]
  );

  const currentSfen = useMemo(
    () => (currentPosition ? positionToSfen(currentPosition) : ""),
    [currentPosition]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInputChange = (value: string) => {
    setRawInput(value);
    setParseError("");
    setPositions([]);
    setMoveIndex(0);

    const trimmed = value.trim();
    if (!trimmed) {
      setInputMode(null);
      return;
    }

    if (isKifFormat(trimmed)) {
      setInputMode("kif");
      try {
        const moves = kifToUsiMoves(trimmed);
        const startPos = parseSfen(SAMPLE_SFEN.replace(/ \d+$/, " 1"));
        const posArray = generatePositions(startPos, moves);
        setPositions(posArray);
        setMoveIndex(posArray.length - 1);
      } catch (e) {
        setParseError((e as Error).message);
      }
    } else {
      setInputMode("sfen");
      try {
        const pos = parseSfen(trimmed);
        setPositions([pos]);
        setMoveIndex(0);
      } catch (e) {
        setParseError((e as Error).message);
      }
    }
  };

  const streamResponse = useCallback(
    async (
      position: string,
      question: string | undefined,
      history: ChatMessage[]
    ) => {
      setLoading(true);
      setError("");

      const controller = new AbortController();
      abortRef.current = controller;

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      try {
        const res = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            position,
            question,
            history: history.length > 0 ? history : undefined,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error ?? `エラー (${res.status})`);
          setMessages((prev) => prev.slice(0, -1));
          setLoading(false);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setError("ストリームの取得に失敗しました");
          setMessages((prev) => prev.slice(0, -1));
          setLoading(false);
          return;
        }

        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") break;

            try {
              const parsed = JSON.parse(payload);
              if (parsed.type === "text" || parsed.type === "fallback") {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === "assistant") {
                    const prefix = parsed.type === "fallback" && !last.content
                      ? "⚠ "
                      : "";
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + prefix + parsed.content,
                    };
                  }
                  return updated;
                });
              } else if (parsed.type === "error") {
                setError(parsed.content);
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("通信エラーが発生しました");
          setMessages((prev) => prev.slice(0, -1));
        }
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    []
  );

  const handleStart = useCallback(async () => {
    if (positions.length === 0) {
      setParseError("局面を入力してください");
      return;
    }

    setStarted(true);
    setMessages([]);

    const sfenStr = positionToSfen(positions[moveIndex]);
    const userMsg: ChatMessage = {
      role: "user",
      content: "この局面を解説してください。",
    };
    setMessages([userMsg]);
    await streamResponse(sfenStr, undefined, []);
  }, [positions, moveIndex, streamResponse]);

  const handleFollowUp = useCallback(async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setChatInput("");

    await streamResponse(currentSfen, trimmed, messages);
  }, [chatInput, loading, messages, currentSfen, streamResponse]);

  const handleExplainAtMove = useCallback(async () => {
    if (!currentSfen || loading) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: `${currentPosition?.moveNumber ?? "?"}手目の局面を解説してください。`,
    };
    setMessages((prev) => [...prev, userMsg]);
    await streamResponse(currentSfen, undefined, messages);
  }, [currentSfen, currentPosition, loading, messages, streamResponse]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (started) {
        handleFollowUp();
      }
    }
  };

  const handleReset = () => {
    setStarted(false);
    setMessages([]);
    setError("");
    setPositions([]);
    setMoveIndex(0);
    setRawInput("");
    setInputMode(null);
    abortRef.current?.abort();
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full">
      {/* Input area */}
      <div className="p-4 border-b dark:border-zinc-700 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <label htmlFor="sfen-input" className="text-sm font-medium">
            SFEN / KIF
          </label>
          {inputMode && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
              {inputMode === "kif" ? "KIF形式" : "SFEN形式"}
            </span>
          )}
          {started && (
            <button
              onClick={handleReset}
              className="text-xs px-2 py-0.5 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:border-zinc-600"
            >
              別の局面
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <textarea
            id="sfen-input"
            className="flex-1 h-20 p-2 border rounded-md font-mono text-xs resize-y bg-white dark:bg-zinc-900 dark:border-zinc-700"
            placeholder={"SFENまたはKIF形式の棋譜を貼り付けてください\n例: " + SAMPLE_SFEN}
            value={rawInput}
            onChange={(e) => handleInputChange(e.target.value)}
            disabled={started}
          />
          {!started && (
            <button
              onClick={handleStart}
              disabled={positions.length === 0 || !!parseError}
              className="px-4 py-2 bg-zinc-900 text-white rounded-md text-sm hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 self-end"
            >
              解説する
            </button>
          )}
        </div>
        {parseError && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{parseError}</p>
        )}
        {!started && (
          <div className="flex gap-3 mt-1">
            <button
              onClick={() => handleInputChange(SAMPLE_SFEN)}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              サンプルSFEN
            </button>
            <button
              onClick={() => handleInputChange(SAMPLE_KIF)}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              サンプルKIF
            </button>
          </div>
        )}
      </div>

      {/* Board + navigation */}
      {currentPosition && (
        <div className="p-4 border-b dark:border-zinc-700 shrink-0 overflow-x-auto">
          <ShogiBoard position={currentPosition} />

          {/* Move navigation (only for multi-position games) */}
          {positions.length > 1 && (
            <div className="flex items-center justify-center gap-3 mt-3">
              <button
                onClick={() => setMoveIndex(0)}
                disabled={moveIndex === 0}
                className="px-2 py-1 text-sm border rounded disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:border-zinc-600"
              >
                |◀
              </button>
              <button
                onClick={() => setMoveIndex(Math.max(0, moveIndex - 1))}
                disabled={moveIndex === 0}
                className="px-2 py-1 text-sm border rounded disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:border-zinc-600"
              >
                ◀
              </button>
              <span className="text-sm text-zinc-600 dark:text-zinc-400 min-w-32 text-center">
                {moveIndex === 0
                  ? "開始局面"
                  : `${moveIndex}手目`}{" "}
                / 全{positions.length - 1}手
              </span>
              <button
                onClick={() =>
                  setMoveIndex(Math.min(positions.length - 1, moveIndex + 1))
                }
                disabled={moveIndex === positions.length - 1}
                className="px-2 py-1 text-sm border rounded disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:border-zinc-600"
              >
                ▶
              </button>
              <button
                onClick={() => setMoveIndex(positions.length - 1)}
                disabled={moveIndex === positions.length - 1}
                className="px-2 py-1 text-sm border rounded disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:border-zinc-600"
              >
                ▶|
              </button>
              {started && (
                <button
                  onClick={handleExplainAtMove}
                  disabled={loading}
                  className="px-2 py-1 text-xs border rounded text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:border-zinc-600 disabled:opacity-50"
                >
                  この局面を解説
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
              }`}
            >
              {msg.content || (loading && i === messages.length - 1 ? "..." : "")}
            </div>
          </div>
        ))}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Follow-up input */}
      {started && (
        <div className="p-4 border-t dark:border-zinc-700 shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 p-2 border rounded-md text-sm bg-white dark:bg-zinc-900 dark:border-zinc-700"
              placeholder="追加の質問を入力..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              onClick={handleFollowUp}
              disabled={loading || !chatInput.trim()}
              className="px-4 py-2 bg-zinc-900 text-white rounded-md text-sm hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {loading ? "..." : "送信"}
            </button>
            {loading && (
              <button
                onClick={() => abortRef.current?.abort()}
                className="px-3 py-2 border rounded-md text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:border-zinc-600"
              >
                中止
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

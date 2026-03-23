"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ShogiBoard from "./ShogiBoard";
import { parseSfen } from "@/lib/shogi/parser";
import type { SfenPosition } from "@/lib/shogi/types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SAMPLE_SFEN = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";

export default function Chat() {
  const [sfen, setSfen] = useState("");
  const [parsedPosition, setParsedPosition] = useState<SfenPosition | null>(null);
  const [parseError, setParseError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSfenChange = (value: string) => {
    setSfen(value);
    setParseError("");
    try {
      if (value.trim()) {
        const pos = parseSfen(value.trim());
        setParsedPosition(pos);
      } else {
        setParsedPosition(null);
      }
    } catch (e) {
      setParsedPosition(null);
      setParseError((e as Error).message);
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

      // Add placeholder for assistant response
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
          // Remove empty assistant message
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
              if (parsed.type === "text") {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === "assistant") {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + parsed.content,
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
    const trimmed = sfen.trim();
    if (!trimmed) {
      setParseError("SFEN を入力してください");
      return;
    }

    try {
      parseSfen(trimmed);
    } catch (e) {
      setParseError((e as Error).message);
      return;
    }

    setStarted(true);
    setMessages([]);

    const userMsg: ChatMessage = {
      role: "user",
      content: "この局面を解説してください。",
    };
    setMessages([userMsg]);
    await streamResponse(trimmed, undefined, []);
  }, [sfen, streamResponse]);

  const handleFollowUp = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");

    await streamResponse(sfen.trim(), trimmed, messages);
  }, [input, loading, messages, sfen, streamResponse]);

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
    abortRef.current?.abort();
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full">
      {/* SFEN input area */}
      <div className="p-4 border-b dark:border-zinc-700 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <label htmlFor="sfen-input" className="text-sm font-medium">
            SFEN / KIF
          </label>
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
            className="flex-1 h-16 p-2 border rounded-md font-mono text-sm resize-none bg-white dark:bg-zinc-900 dark:border-zinc-700"
            placeholder={SAMPLE_SFEN}
            value={sfen}
            onChange={(e) => handleSfenChange(e.target.value)}
            disabled={started}
          />
          {!started && (
            <button
              onClick={handleStart}
              disabled={!sfen.trim() || !!parseError}
              className="px-4 py-2 bg-zinc-900 text-white rounded-md text-sm hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 self-end"
            >
              解説する
            </button>
          )}
        </div>
        {parseError && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{parseError}</p>
        )}
        <button
          onClick={() => handleSfenChange(SAMPLE_SFEN)}
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mt-1"
          disabled={started}
        >
          サンプル局面を使う
        </button>
      </div>

      {/* Board display */}
      {parsedPosition && (
        <div className="p-4 border-b dark:border-zinc-700 flex-shrink-0 overflow-x-auto">
          <ShogiBoard position={parsedPosition} />
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
        <div className="p-4 border-t dark:border-zinc-700 flex-shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 p-2 border rounded-md text-sm bg-white dark:bg-zinc-900 dark:border-zinc-700"
              placeholder="追加の質問を入力..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              onClick={handleFollowUp}
              disabled={loading || !input.trim()}
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

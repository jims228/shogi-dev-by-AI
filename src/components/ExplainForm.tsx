"use client";

import { useState, useRef, useCallback } from "react";

export default function ExplainForm() {
  const [input, setInput] = useState("");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setError("SFEN または KIF を入力してください");
      return;
    }

    setError("");
    setResult("");
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position: trimmed,
          question: question.trim() || undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? `エラー (${res.status})`);
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("ストリームの取得に失敗しました");
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
              setResult((prev) => prev + parsed.content);
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
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [input, question]);

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-2xl">
      <div>
        <label htmlFor="sfen-input" className="block text-sm font-medium mb-1">
          SFEN / KIF
        </label>
        <textarea
          id="sfen-input"
          className="w-full h-28 p-3 border rounded-md font-mono text-sm resize-y bg-white dark:bg-zinc-900 dark:border-zinc-700"
          placeholder="lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="question-input" className="block text-sm font-medium mb-1">
          質問（任意）
        </label>
        <input
          id="question-input"
          type="text"
          className="w-full p-2 border rounded-md text-sm bg-white dark:bg-zinc-900 dark:border-zinc-700"
          placeholder="例: この局面ではどう指せばいいですか？"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-4 py-2 bg-zinc-900 text-white rounded-md text-sm hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {loading ? "解説中..." : "解説する"}
        </button>
        {loading && (
          <button
            onClick={handleCancel}
            className="px-4 py-2 border rounded-md text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            中止
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="p-4 border rounded-md text-sm leading-relaxed whitespace-pre-wrap dark:border-zinc-700">
          {result}
        </div>
      )}
    </div>
  );
}

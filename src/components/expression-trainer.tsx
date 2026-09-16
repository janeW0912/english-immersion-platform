"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CoachMarkdown } from "@/components/coach-markdown";
import { EXPRESSION_STYLE_PRESETS } from "@/lib/expression-styles";
import type { ExpressionMsg } from "@/lib/expression-storage";
import { newId } from "@/lib/expression-storage";
import { cn } from "@/lib/utils";

export type ExpressionTrainerProps = {
  messages: ExpressionMsg[];
  onMessagesChange: (messages: ExpressionMsg[]) => void;
};

export function ExpressionTrainer({
  messages,
  onMessagesChange,
}: ExpressionTrainerProps) {
  const [input, setInput] = useState("");
  const [presetIds, setPresetIds] = useState<string[]>([]);
  const [customStyle, setCustomStyle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"mock" | "live" | null>(null);
  const [provider, setProvider] = useState<"gemini" | "openai" | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ExpressionMsg = {
      id: newId(),
      role: "user",
      content: text,
    };
    setInput("");
    setError(null);

    const afterUser = [...messages, userMsg];
    onMessagesChange(afterUser);
    setLoading(true);
    scrollDown();

    const payload = afterUser.map(({ role, content }) => ({
      role,
      content,
    }));

    try {
      const res = await fetch("/api/expression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: payload,
          stylePresetIds: presetIds,
          styleCustom: customStyle.trim().slice(0, 400),
        }),
      });
      const data = (await res.json()) as {
        content?: string;
        error?: string;
        mode?: "mock" | "live";
        provider?: "gemini" | "openai";
      };

      if (!res.ok) {
        throw new Error(data.error || res.statusText);
      }
      if (!data.content) {
        throw new Error("Empty response");
      }

      setMode(data.mode ?? null);
      setProvider(data.provider ?? null);
      onMessagesChange([
        ...afterUser,
        {
          id: newId(),
          role: "assistant",
          content: data.content,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
      scrollDown();
    }
  }, [
    input,
    loading,
    messages,
    onMessagesChange,
    scrollDown,
    presetIds,
    customStyle,
  ]);

  const togglePreset = useCallback((id: string) => {
    setPresetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col md:min-h-screen">
      {(mode === "mock" || mode === "live") && (
        <div className="border-b border-zinc-800 px-4 py-2 md:px-8">
          {mode === "mock" && (
            <p className="text-xs text-amber-400/90">
              Demo mode · 配置 GEMINI_API_KEY（与官网一致）；或
              GOOGLE_GENERATIVE_AI_API_KEY；未配时可设 OPENAI_API_KEY 回退
            </p>
          )}
          {mode === "live" && provider === "gemini" && (
            <p className="text-xs text-emerald-400/90">
              Live · Google Gemini 已连接
            </p>
          )}
          {mode === "live" && provider === "openai" && (
            <p className="text-xs text-emerald-400/90">Live · OpenAI 已连接</p>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-8">
        {messages.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 px-4 py-8 text-center text-sm text-zinc-500">
            Try:{" "}
            <span className="font-mono text-zinc-400">
              I think social media is bad.
            </span>
          </p>
        )}

        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "rounded-2xl border px-4 py-3 text-sm leading-relaxed",
                  m.role === "user"
                    ? "ml-8 border-zinc-800 bg-zinc-900/60 text-zinc-200"
                    : "mr-4 border-zinc-800/80 bg-zinc-900/30 text-zinc-300",
                )}
              >
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                  {m.role === "user" ? "You" : "Coach"}
                </span>
                {m.role === "assistant" ? (
                  <CoachMarkdown content={m.content} />
                ) : (
                  <pre className="font-sans whitespace-pre-wrap break-words">
                    {m.content}
                  </pre>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mr-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/20 px-4 py-3 text-sm text-zinc-500"
            >
              Thinking…
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-zinc-800 p-4 md:px-8 md:pb-6">
        {error && (
          <p className="mb-2 text-center text-xs text-red-400">{error}</p>
        )}

        <div className="mx-auto mb-4 max-w-3xl rounded-xl border border-zinc-800/90 bg-zinc-900/25 px-3 py-3 md:px-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            改写风格 · 可多选
          </p>
          <p className="mt-1 text-[11px] leading-snug text-zinc-600">
            不勾选且自定义留空时，教练按原先默认输出「Casual Native / Academic /
            Sophisticated」三档。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {EXPRESSION_STYLE_PRESETS.map((p) => {
              const on = presetIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePreset(p.id)}
                  disabled={loading}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-left text-[11px] transition-colors disabled:opacity-40",
                    on
                      ? "border-emerald-600/70 bg-emerald-950/40 text-emerald-200"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300",
                  )}
                >
                  <span className="font-medium">{p.heading.replace(/（.+）$/, "")}</span>
                  <span className="block text-[10px] text-zinc-500">
                    {p.heading.match(/（(.+)）/)?.[1] ?? ""}
                  </span>
                </button>
              );
            })}
          </div>
          <label className="mt-3 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            自定义风格（可选，回答里会显示为 Custom（你的文字））
          </label>
          <input
            type="text"
            value={customStyle}
            onChange={(e) => setCustomStyle(e.target.value.slice(0, 400))}
            placeholder="例如：像播客开场、偏幽默、更克制…"
            disabled={loading}
            className="mt-1.5 w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600"
          />
        </div>

        <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={3}
            placeholder="Type in English…（Shift+Enter 换行）"
            className="min-h-[5.5rem] w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={loading || !input.trim()}
            className="h-11 shrink-0 rounded-xl bg-emerald-600 px-6 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send 发送
          </button>
        </div>
      </div>
    </div>
  );
}

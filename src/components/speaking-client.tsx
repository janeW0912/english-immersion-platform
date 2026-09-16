"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageIntro } from "@/components/page-intro";
import { CoachMarkdown } from "@/components/coach-markdown";
import { requestCoach } from "@/hooks/use-coach-api";
import { useEnglishSpeechDictation } from "@/hooks/use-english-speech-dictation";
import type { CoachVariant } from "@/lib/coach-prompts";
import { newId } from "@/lib/expression-storage";
import type { SpeakingMemoryEntry } from "@/lib/coach-modules-storage";
import {
  loadSpeakingPersist,
  pushSpeakingMemoryEntry,
  saveSpeakingPersist,
} from "@/lib/coach-modules-storage";
import { cn } from "@/lib/utils";

type Msg = { id: string; role: "user" | "assistant"; content: string };

const tabs: {
  id: "conv" | "debate" | "shadow";
  label: string;
  sub: string;
  variant?: CoachVariant;
}[] = [
  {
    id: "conv",
    label: "Conversation",
    sub: "追问式对话",
    variant: "speaking-conversation",
  },
  {
    id: "debate",
    label: "Debate",
    sub: "站反方",
    variant: "speaking-debate",
  },
  {
    id: "shadow",
    label: "Shadowing",
    sub: "跟读",
    variant: "speaking-shadowing",
  },
];

export function SpeakingClient() {
  const [persistReady, setPersistReady] = useState(false);
  const [tab, setTab] = useState<"conv" | "debate" | "shadow">("conv");
  const [conv, setConv] = useState<Msg[]>([]);
  const [deb, setDeb] = useState<Msg[]>([]);
  const [shadowRef, setShadowRef] = useState("");
  const [shadowRead, setShadowRead] = useState("");
  const [shadowMsgs, setShadowMsgs] = useState<Msg[]>([]);
  const [memory, setMemory] = useState<SpeakingMemoryEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    interim: shadowInterim,
    setInterim: setShadowInterim,
    speechError: shadowSpeechError,
    setSpeechError: setShadowSpeechError,
    micState: shadowMicState,
    speechSupported: shadowSpeechSupported,
    clientReady: shadowClientReady,
    startListening: startShadowListening,
    stopListening: stopShadowListening,
  } = useEnglishSpeechDictation({
    setTranscript: setShadowRead,
    blocked: loading,
  });

  useEffect(() => {
    const d = loadSpeakingPersist();
    setTab(d.tab);
    setConv(d.conv as Msg[]);
    setDeb(d.deb as Msg[]);
    setShadowRef(d.shadowRef ?? "");
    setShadowRead(d.shadowRead ?? "");
    setShadowMsgs((d.shadowMsgs ?? []) as Msg[]);
    setInput(d.draftInput);
    setMemory(d.memory ?? []);
    setPersistReady(true);
  }, []);

  useEffect(() => {
    if (!persistReady) return;
    saveSpeakingPersist({
      version: 2,
      tab,
      conv,
      deb,
      draftInput: input,
      memory,
      shadowRef,
      shadowRead,
      shadowMsgs,
    });
  }, [
    persistReady,
    tab,
    conv,
    deb,
    input,
    memory,
    shadowRef,
    shadowRead,
    shadowMsgs,
  ]);

  const messages = tab === "conv" ? conv : tab === "debate" ? deb : shadowMsgs;
  const setMessages =
    tab === "conv" ? setConv : tab === "debate" ? setDeb : setShadowMsgs;
  const variant: CoachVariant =
    tab === "conv"
      ? "speaking-conversation"
      : tab === "debate"
        ? "speaking-debate"
        : "speaking-shadowing";

  const send = useCallback(async () => {
    if (loading) return;

    if (tab === "shadow") {
      const ref = shadowRef.trim();
      const wasFirst = shadowMsgs.length === 0;
      const line = wasFirst ? shadowRead.trim() : input.trim();
      if (!ref || !line) return;

      const snapshot = shadowMsgs;
      const userMsg: Msg = { id: newId(), role: "user", content: line };
      const next = [...snapshot, userMsg];
      setShadowMsgs(next);
      if (wasFirst) {
        setShadowRead("");
        setShadowInterim("");
      } else {
        setInput("");
      }
      setLoading(true);
      setError(null);

      const payload = next.map(({ role, content }) => ({ role, content }));

      try {
        const data = await requestCoach("speaking-shadowing", payload, {
          systemContext: ref,
        });
        setShadowMsgs([
          ...next,
          { id: newId(), role: "assistant", content: data.content },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
        setShadowMsgs(snapshot);
        if (wasFirst) {
          setShadowRead(line);
        } else {
          setInput(line);
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    const text = input.trim();
    if (!text) return;

    const snapshot = messages;
    const userMsg: Msg = { id: newId(), role: "user", content: text };
    const next = [...snapshot, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);

    const payload = next.map(({ role, content }) => ({ role, content }));

    try {
      const data = await requestCoach(variant, payload);
      setMessages([
        ...next,
        { id: newId(), role: "assistant", content: data.content },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setMessages(snapshot);
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    tab,
    shadowRef,
    shadowRead,
    shadowMsgs,
    input,
    messages,
    setMessages,
    variant,
    setShadowInterim,
  ]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const saveThreadToMemory = useCallback(() => {
    if (messages.length === 0) return;
    if (tab === "shadow" && shadowMsgs.length === 0) return;

    const mode = tab === "conv" ? "conv" : tab === "debate" ? "debate" : "shadow";
    const firstUser = messages.find((m) => m.role === "user")?.content?.trim() ?? "";
    const label =
      mode === "shadow"
        ? (() => {
            const head =
              shadowRef.trim().split(/\n/)[0]?.trim() ||
              firstUser ||
              "跟读";
            return head.length > 88 ? `${head.slice(0, 85)}…` : head;
          })()
        : firstUser.length > 88
          ? `${firstUser.slice(0, 85)}…`
          : firstUser || `${mode === "conv" ? "对话" : "辩论"} · ${new Date().toLocaleString("zh-CN")}`;

    setMemory((prev) =>
      pushSpeakingMemoryEntry(prev, {
        mode,
        label,
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        })),
        ...(mode === "shadow"
          ? { shadowRef: shadowRef.trim().slice(0, 14_000) }
          : {}),
      }),
    );
  }, [messages, tab, shadowRef]);

  const loadMemoryEntry = useCallback(
    (entry: SpeakingMemoryEntry) => {
      const activeCount =
        tab === "shadow" ? shadowMsgs.length : messages.length;
      const ok =
        typeof window !== "undefined" &&
        (activeCount === 0 ||
          window.confirm("载入将替换当前标签页下的会话，确定？"));
      if (!ok) return;

      if (entry.mode === "shadow") {
        setTab("shadow");
        setShadowRef(entry.shadowRef ?? "");
        setShadowMsgs(
          entry.messages.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        );
        setShadowRead("");
        setConv([]);
        setDeb([]);
      } else {
        setTab(entry.mode === "debate" ? "debate" : "conv");
        const msgs = entry.messages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
        }));
        if (entry.mode === "debate") {
          setDeb(msgs);
          setConv([]);
        } else {
          setConv(msgs);
          setDeb([]);
        }
        setShadowMsgs([]);
        setShadowRef("");
        setShadowRead("");
      }
      setInput("");
      setError(null);
    },
    [messages.length, shadowMsgs.length, tab],
  );

  const deleteMemoryEntry = useCallback((id: string) => {
    setMemory((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const partnerLabel =
    tab === "shadow" ? "Coach" : tab === "debate" ? "Opponent" : "Partner";

  return (
    <div className="flex min-h-0 flex-1 flex-col md:min-h-screen">
      <PageIntro titleEn="Mind Arena" titleZh="思维竞技场">
        训练即时反应与论点组织：对话模式温和追问；辩论模式<strong className="text-zinc-400">站反方</strong>
        、语气直截了当。跟读：粘贴参考英文，用语音或键盘录入你的跟读转写，教练对照参考稿给节奏、重音与纠偏建议。会话与底部
        <strong className="text-zinc-400">记忆库</strong>
        写入本机{" "}
        <code className="rounded bg-zinc-900 px-1 text-[10px]">localStorage</code>
        ；清除站点数据会丢失。
      </PageIntro>

      <div className="flex gap-1 border-b border-zinc-800 px-4 md:px-8">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-3 text-left text-xs transition-colors md:text-sm",
              tab === t.id
                ? "border-emerald-500 text-emerald-300"
                : "border-transparent text-zinc-500 hover:text-zinc-300",
            )}
          >
            <span className="font-medium">{t.label}</span>
            <span className="ml-1 text-[10px] text-zinc-600 md:block md:ml-0">
              {t.sub}
            </span>
          </button>
        ))}
      </div>

      {tab === "shadow" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-8">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              <div>
                <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                  Reference · 参考稿（粘贴要跟读的英文）
                </label>
                <textarea
                  value={shadowRef}
                  onChange={(e) => setShadowRef(e.target.value)}
                  rows={5}
                  placeholder="Paste a short paragraph, news lede, or script you want to shadow…"
                  disabled={loading}
                  className="mt-2 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
                />
              </div>

              {shadowMsgs.length > 0 && (
                <div className="flex flex-col gap-3 border-t border-zinc-800/80 pt-4">
                  <AnimatePresence initial={false}>
                    {shadowMsgs.map((m) => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "rounded-2xl border px-4 py-3 text-sm",
                          m.role === "user"
                            ? "ml-6 border-zinc-800 bg-zinc-900/60"
                            : "mr-2 border-zinc-800/80 bg-zinc-900/30",
                        )}
                      >
                        <span className="text-[10px] uppercase text-zinc-600">
                          {m.role === "user" ? "You" : "Coach"}
                        </span>
                        {m.role === "assistant" ? (
                          <CoachMarkdown content={m.content} />
                        ) : (
                          <pre className="mt-1 whitespace-pre-wrap font-sans text-zinc-200">
                            {m.content}
                          </pre>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {loading && (
                    <p className="text-sm text-zinc-500">Thinking…</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-zinc-800 p-4 md:px-8">
            {error && (
              <p className="mb-2 text-center text-xs text-red-400">{error}</p>
            )}

            {shadowMsgs.length === 0 ? (
              <div className="mx-auto flex max-w-3xl flex-col gap-3">
                <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                  Your read · 你的跟读（语音或键盘）
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      shadowMicState === "idle"
                        ? startShadowListening()
                        : stopShadowListening()
                    }
                    disabled={loading || !shadowSpeechSupported}
                    className={cn(
                      "rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40",
                      shadowMicState !== "idle"
                        ? "bg-red-900/80 text-red-100 hover:bg-red-800/90"
                        : "bg-emerald-600 text-white hover:bg-emerald-500",
                    )}
                  >
                    {shadowMicState === "idle"
                      ? "语音录入"
                      : shadowMicState === "starting"
                        ? "准备中…"
                        : "停止"}
                  </button>
                  {!shadowSpeechSupported && shadowClientReady && (
                    <span className="text-[11px] text-amber-500/90">
                      本浏览器无语音识别，请换 Chrome / Edge 或键盘输入。
                    </span>
                  )}
                  {shadowMicState !== "idle" && (
                    <span className="text-[11px] text-emerald-400/90">
                      {shadowMicState === "starting"
                        ? "连接麦克风…"
                        : "聆听中…"}
                    </span>
                  )}
                </div>
                {shadowSpeechError && (
                  <p className="text-xs text-amber-400/95">{shadowSpeechError}</p>
                )}
                {shadowInterim && (
                  <p className="rounded-lg border border-zinc-800/80 bg-zinc-900/30 px-3 py-2 text-xs italic text-zinc-500">
                    实时：{shadowInterim}
                  </p>
                )}
                <textarea
                  value={shadowRead}
                  onChange={(e) => setShadowRead(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={4}
                  placeholder="说完或输入你的跟读英文…（Enter 提交并获取教练反馈）"
                  disabled={loading}
                  className="min-h-[5rem] w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={
                      loading ||
                      !shadowRef.trim() ||
                      !shadowRead.trim()
                    }
                    className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
                  >
                    提交并获取反馈
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShadowRead("");
                      setShadowInterim("");
                      setShadowSpeechError(null);
                    }}
                    disabled={loading || (!shadowRead.trim() && !shadowInterim)}
                    className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800/60 disabled:opacity-40"
                  >
                    清空跟读稿
                  </button>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-end">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={2}
                  placeholder="追问教练…（Enter 发送）"
                  disabled={loading}
                  className="min-h-[3.5rem] w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={loading || !input.trim()}
                  className="h-11 shrink-0 rounded-xl bg-emerald-600 px-6 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            )}

            <div className="mx-auto mt-4 flex max-w-3xl flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={saveThreadToMemory}
                disabled={messages.length === 0}
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:border-emerald-700/50 hover:bg-zinc-800 disabled:opacity-40"
              >
                保存本轮到记忆
              </button>
              <button
                type="button"
                onClick={() => {
                  setShadowMsgs([]);
                  setShadowRead("");
                  setShadowInterim("");
                  setShadowSpeechError(null);
                  setInput("");
                  setError(null);
                }}
                disabled={loading}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-[11px] text-zinc-500 hover:bg-zinc-800 disabled:opacity-40"
              >
                清空跟读对话
              </button>
              <span className="text-[10px] text-zinc-600">
                共 {memory.length} 条存档 · 最多保留约 25 条
              </span>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-8">
            <div className="mx-auto flex max-w-3xl flex-col gap-3">
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-sm",
                      m.role === "user"
                        ? "ml-6 border-zinc-800 bg-zinc-900/60"
                        : "mr-2 border-zinc-800/80 bg-zinc-900/30",
                    )}
                  >
                    <span className="text-[10px] uppercase text-zinc-600">
                      {m.role === "user" ? "You" : partnerLabel}
                    </span>
                    {m.role === "assistant" ? (
                      <CoachMarkdown content={m.content} />
                    ) : (
                      <pre className="mt-1 whitespace-pre-wrap font-sans text-zinc-200">
                        {m.content}
                      </pre>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              {loading && (
                <p className="text-sm text-zinc-500">Thinking…</p>
              )}
            </div>
          </div>
          <div className="border-t border-zinc-800 p-4 md:px-8">
            {error && (
              <p className="mb-2 text-center text-xs text-red-400">{error}</p>
            )}
            <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-end">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={3}
                placeholder="英文输出观点…（Enter 发送，Shift+Enter 换行）"
                disabled={loading}
                className="min-h-[4.5rem] w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={loading || !input.trim()}
                className="h-11 shrink-0 rounded-xl bg-emerald-600 px-6 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                Send
              </button>
            </div>
            <div className="mx-auto mt-4 flex max-w-3xl flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={saveThreadToMemory}
                disabled={messages.length === 0}
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:border-emerald-700/50 hover:bg-zinc-800 disabled:opacity-40"
              >
                保存本轮到记忆
              </button>
              <span className="text-[10px] text-zinc-600">
                共 {memory.length} 条存档 · 最多保留约 25 条
              </span>
            </div>
          </div>
        </>
      )}

      {memory.length > 0 && (
        <div className="border-t border-zinc-800 px-4 py-5 md:px-8">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            记忆库
          </h3>
          <ul className="mt-3 space-y-2">
            {memory.map((en) => (
              <li
                key={en.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-900/35 px-3 py-2.5 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-zinc-500">
                    {en.mode === "debate"
                      ? "辩论"
                      : en.mode === "shadow"
                        ? "跟读"
                        : "对话"}{" "}
                    · {new Date(en.createdAt).toLocaleString("zh-CN")}
                  </span>
                  <p className="mt-1 line-clamp-2 text-zinc-300">{en.label}</p>
                  <span className="text-[10px] text-zinc-600">
                    {en.messages.length} 条消息
                  </span>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => loadMemoryEntry(en)}
                    className="rounded-lg bg-emerald-900/40 px-2 py-1 text-[10px] text-emerald-300 hover:bg-emerald-900/60"
                  >
                    载入
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMemoryEntry(en.id)}
                    className="rounded-lg border border-zinc-700 px-2 py-1 text-[10px] text-zinc-500 hover:bg-zinc-800"
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

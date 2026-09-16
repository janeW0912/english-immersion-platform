"use client";

import { useCallback, useEffect, useState } from "react";
import { PageIntro } from "@/components/page-intro";
import { CoachMarkdown } from "@/components/coach-markdown";
import { requestCoach } from "@/hooks/use-coach-api";
import { useEnglishSpeechDictation } from "@/hooks/use-english-speech-dictation";
import type { NativeBrainMemoryEntry } from "@/lib/coach-modules-storage";
import {
  loadNativeBrainPersist,
  pushNativeBrainMemory,
  saveNativeBrainPersist,
} from "@/lib/coach-modules-storage";
import { cn } from "@/lib/utils";

const SPOKEN_USER_PREFIX =
  "[Spoken English — browser speech-to-text transcript; may have ASR errors, missing punctuation, or wrong words.]\n\n";

export function NativeBrainClient() {
  const [persistReady, setPersistReady] = useState(false);
  const [text, setText] = useState("");
  const [memory, setMemory] = useState<NativeBrainMemoryEntry[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    interim,
    setInterim,
    speechError,
    setSpeechError,
    micState,
    speechSupported,
    clientReady,
    startListening,
    stopListening,
  } = useEnglishSpeechDictation({ setTranscript: setText, blocked: loading });

  useEffect(() => {
    const d = loadNativeBrainPersist();
    setText(d.text);
    setResult(d.result);
    setMemory(d.memory ?? []);
    setPersistReady(true);
  }, []);

  useEffect(() => {
    if (!persistReady) return;
    saveNativeBrainPersist({ version: 2, text, result, memory });
  }, [persistReady, text, result, memory]);

  const run = useCallback(async () => {
    const t = text.trim();
    if (!t || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await requestCoach("native-brain", [
        { role: "user", content: `${SPOKEN_USER_PREFIX}${t}` },
      ]);
      setResult(data.content);
      setMemory((prev) => pushNativeBrainMemory(prev, t, data.content));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [text, loading]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageIntro titleEn="Native Brain" titleZh="语言直觉">
        用<strong className="text-zinc-400">英文语音输入</strong>
        （浏览器听写）说出你的想法；也可在转写框里手动改字或粘贴已有转写。AI
        按<strong className="text-zinc-400">口语自然度</strong>
        做矫正与优化（节奏、搭配、口头连贯），不是作文批改。每次生成成功的记录会进入下方<strong className="text-zinc-400">语言直觉记忆</strong>
        （可回看 / 载入）；当前编辑区与结果同样保存在本机{" "}
        <code className="rounded bg-zinc-900 px-1 text-[10px]">localStorage</code>
        。建议使用 Chrome / Edge 并允许麦克风。
      </PageIntro>

      <div className="flex flex-1 flex-col gap-6 p-4 md:flex-row md:gap-8 md:p-8">
        <div className="flex min-h-0 flex-1 flex-col">
          <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Voice · 语音输入
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                micState === "idle" ? startListening() : stopListening()
              }
              disabled={loading || !speechSupported}
              className={cn(
                "rounded-xl px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-40",
                micState !== "idle"
                  ? "bg-red-900/80 text-red-100 hover:bg-red-800/90"
                  : "bg-emerald-600 text-white hover:bg-emerald-500",
              )}
            >
              {micState === "idle"
                ? "开始说英文"
                : micState === "starting"
                  ? "准备中…（点此处取消）"
                  : "停止录音"}
            </button>
            <button
              type="button"
              onClick={() => {
                setText("");
                setInterim("");
                setSpeechError(null);
              }}
              disabled={loading || (!text.trim() && !interim)}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800/60 disabled:opacity-40"
            >
              清空转写
            </button>
            {!speechSupported && clientReady && (
              <span className="text-[11px] text-amber-500/90">
                本浏览器无语音识别，请换 Chrome / Edge 或使用文本框。
              </span>
            )}
            {micState !== "idle" && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400/90">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                {micState === "starting"
                  ? "正在连接麦克风…"
                  : "正在聆听…"}
              </span>
            )}
          </div>
          {speechError && (
            <p className="mt-2 text-xs text-amber-400/95">{speechError}</p>
          )}
          {interim && (
            <p className="mt-2 rounded-lg border border-zinc-800/80 bg-zinc-900/30 px-3 py-2 text-xs italic text-zinc-500">
              实时：{interim}
            </p>
          )}

          <label className="mt-4 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Transcript · 转写文本（可编辑 / 可粘贴）
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            placeholder="说完英文后会出现在这里；也可直接粘贴第三方转写结果…"
            className="mt-2 min-h-[10rem] flex-1 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
          />
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading || !text.trim()}
            className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40 md:w-auto md:px-8"
          >
            {loading ? "…" : "生成口语优化"}
          </button>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col md:max-w-xl">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Coach · 当前输出
          </p>
          <div className="mt-2 max-h-[min(40vh,22rem)] min-h-[10rem] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm">
            {result ? (
              <CoachMarkdown content={result} />
            ) : (
              <p className="text-sm text-zinc-600">
                口语分析与改写会出现在这里；刷新页面后仍会保留。
              </p>
            )}
          </div>

          <details className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/25 open:bg-zinc-900/35">
            <summary className="cursor-pointer px-3 py-2 text-[11px] font-medium text-zinc-400">
              语言直觉记忆 · {memory.length} 条（每次生成后自动保存，最多约 25 条）
            </summary>
            <div className="max-h-[min(36vh,18rem)] space-y-2 overflow-y-auto border-t border-zinc-800/80 px-2 py-2">
              {memory.length === 0 ? (
                <p className="px-2 py-3 text-[11px] text-zinc-600">
                  尚无记录；点击「生成口语优化」后会在此累积。
                </p>
              ) : (
                memory.map((en) => (
                  <div
                    key={en.id}
                    className="rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-2.5 py-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="text-[10px] text-zinc-500">
                        {new Date(en.createdAt).toLocaleString("zh-CN")}
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setText(en.transcript);
                            setResult(en.result);
                          }}
                          className="rounded bg-emerald-900/45 px-2 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-900/65"
                        >
                          载入
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setMemory((prev) => prev.filter((x) => x.id !== en.id))
                          }
                          className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-800"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] text-zinc-400">
                      {en.transcript}
                    </p>
                  </div>
                ))
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageIntro } from "@/components/page-intro";
import { CoachMarkdown } from "@/components/coach-markdown";
import { requestCoach } from "@/hooks/use-coach-api";
import {
  WRITING_PROMPT_BANK,
  writingPromptEntryForToday,
  writingPromptForDateSeed,
} from "@/lib/writing-prompt-bank";
import {
  loadWritingPersist,
  reconcileDraftWeaveTopic,
  saveWritingPersist,
} from "@/lib/coach-modules-storage";
import {
  buildWritingPromptFirstOfDayUserMessage,
  buildWritingPromptSpinUserMessage,
  parseWritingPromptSpinJson,
  resolveWritingEffectiveTopic,
  writingSpinLocalDateKey,
} from "@/lib/writing-prompt-spin";
import {
  appendOnlineToHistory,
  dayHeadBilingualFromHistory,
  firstWritingDayHead,
  matchesEffectiveTopic,
  needsDailyAiFirstTopic,
  parseTopicHistoryFromStorage,
  WRITING_TOPIC_HISTORY_MAX,
  type WritingTopicHistoryItem,
} from "@/lib/writing-topic-history";
import { cn } from "@/lib/utils";

const ONLINE_SPIN_DAILY_MAX = 5;

function readOnlineSpinFromStorage(): {
  online: { zh: string; en: string } | null;
  count: number;
} {
  if (typeof window === "undefined") {
    return { online: null, count: 0 };
  }
  const w = loadWritingPersist();
  const zh = w.writingOnlineTopicZh?.trim();
  const en = w.writingOnlineTopicEn?.trim();
  const online = zh && en ? { zh, en } : null;
  const count = Math.min(
    ONLINE_SPIN_DAILY_MAX,
    Math.max(0, w.writingOnlineSpinCount ?? 0),
  );
  return { online, count };
}

export function WritingClient() {
  const todayEntry = useMemo(() => writingPromptEntryForToday(), []);

  const [persistReady, setPersistReady] = useState(false);
  const [topicSource, setTopicSource] = useState<"daily" | "custom">("daily");
  const [customTopic, setCustomTopic] = useState("");
  const [dailyDraft, setDailyDraft] = useState("");
  const [dailyOut, setDailyOut] = useState<string | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);

  const [upgradeIn, setUpgradeIn] = useState("");
  const [upgradeOut, setUpgradeOut] = useState<string | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const lastEffectiveTopicRef = useRef<string | null>(null);
  const dailyFirstRunGen = useRef(0);
  const dailyFirstLoadCount = useRef(0);

  const [onlineTopic, setOnlineTopic] = useState<{
    zh: string;
    en: string;
  } | null>(() => readOnlineSpinFromStorage().online);
  const [spinCount, setSpinCount] = useState(() => readOnlineSpinFromStorage().count);
  const [spinLoading, setSpinLoading] = useState(false);
  const [dailyFirstLoading, setDailyFirstLoading] = useState(false);
  const [topicHistory, setTopicHistory] = useState<WritingTopicHistoryItem[]>([]);
  const [writingDayHeadDateKey, setWritingDayHeadDateKey] = useState("");
  const [dailyFirstError, setDailyFirstError] = useState<string | null>(null);
  const [dailyFirstRetryTick, setDailyFirstRetryTick] = useState(0);

  const dayHeadBilingual = useMemo(
    () => dayHeadBilingualFromHistory(topicHistory, todayEntry),
    [topicHistory, todayEntry],
  );

  const effectiveTopic = useMemo(
    () =>
      resolveWritingEffectiveTopic({
        topicSource,
        customTopic,
        todayBilingual: dayHeadBilingual,
        onlineZh: onlineTopic?.zh,
        onlineEn: onlineTopic?.en,
      }),
    [topicSource, customTopic, dayHeadBilingual, onlineTopic],
  );

  useEffect(() => {
    const w = loadWritingPersist();
    const ts: "daily" | "custom" =
      w.writingTopicSource === "custom" ? "custom" : "daily";
    const ct =
      typeof w.customWritingTopic === "string" ? w.customWritingTopic : "";
    const spin = readOnlineSpinFromStorage();
    setOnlineTopic(spin.online);
    setSpinCount(spin.count);
    const parsed = parseTopicHistoryFromStorage(w.writingTopicHistory);
    const hist = parsed[0]?.source === "bank" ? parsed.slice(1) : parsed;
    setTopicHistory(hist);
    setWritingDayHeadDateKey(
      typeof w.writingDayHeadDateKey === "string"
        ? w.writingDayHeadDateKey.trim()
        : "",
    );
    const dayBi = dayHeadBilingualFromHistory(hist, todayEntry);
    const effective = resolveWritingEffectiveTopic({
      topicSource: ts,
      customTopic: ct,
      todayBilingual: dayBi,
      onlineZh: spin.online?.zh,
      onlineEn: spin.online?.en,
    });
    const r = reconcileDraftWeaveTopic(w, effective);
    setTopicSource(ts);
    setCustomTopic(ct);
    setDailyDraft(r.dailyDraft);
    setDailyOut(r.dailyOut);
    setUpgradeIn(w.upgradeIn);
    setUpgradeOut(w.upgradeOut);
    lastEffectiveTopicRef.current = effective;
    setPersistReady(true);
  }, [todayEntry]);

  useEffect(() => {
    if (!persistReady) return;
    const prev = lastEffectiveTopicRef.current;
    if (prev != null && prev !== effectiveTopic) {
      setDailyOut(null);
    }
    lastEffectiveTopicRef.current = effectiveTopic;
  }, [effectiveTopic, persistReady]);

  useEffect(() => {
    if (!persistReady) return;
    saveWritingPersist({
      version: 1,
      dailyDraft,
      dailyOut,
      dailyPromptSnapshot: effectiveTopic,
      writingTopicSource: topicSource,
      customWritingTopic: customTopic,
      upgradeIn,
      upgradeOut,
      writingOnlineSpinDate: writingSpinLocalDateKey(),
      writingOnlineSpinCount: spinCount,
      writingOnlineTopicZh: onlineTopic?.zh ?? "",
      writingOnlineTopicEn: onlineTopic?.en ?? "",
      writingTopicHistory: topicHistory,
      writingDayHeadDateKey,
    });
  }, [
    persistReady,
    dailyDraft,
    dailyOut,
    effectiveTopic,
    topicSource,
    customTopic,
    upgradeIn,
    upgradeOut,
    spinCount,
    onlineTopic,
    topicHistory,
    writingDayHeadDateKey,
  ]);

  useEffect(() => {
    if (topicSource !== "daily") setDailyFirstError(null);
  }, [topicSource]);

  useEffect(() => {
    if (!persistReady || topicSource !== "daily") return;
    if (!needsDailyAiFirstTopic(topicHistory)) {
      setDailyFirstError(null);
      return;
    }
    if (dailyFirstError) return;

    const runId = ++dailyFirstRunGen.current;
    const seed = writingPromptForDateSeed(writingSpinLocalDateKey());

    dailyFirstLoadCount.current += 1;
    setDailyFirstLoading(true);
    setError(null);
    void (async () => {
      try {
        const data = await requestCoach("writing-prompt-spin", [
          {
            role: "user",
            content: buildWritingPromptFirstOfDayUserMessage(seed),
          },
        ]);
        const parsed = parseWritingPromptSpinJson(data.content);
        if (!parsed) throw new Error("题目格式无法识别，请重试");
        if (runId !== dailyFirstRunGen.current) return;
        setTopicHistory((prev) => {
          const tail = prev.filter((x) => x.source === "online");
          return [
            {
              zh: parsed.title_zh,
              en: parsed.title_en,
              source: "ai_first" as const,
            },
            ...tail,
          ];
        });
        setWritingDayHeadDateKey(writingSpinLocalDateKey());
        setDailyFirstError(null);
      } catch (e) {
        if (runId === dailyFirstRunGen.current) {
          setDailyFirstError(
            e instanceof Error ? e.message : "今日首题生成失败",
          );
        }
      } finally {
        dailyFirstLoadCount.current -= 1;
        if (dailyFirstLoadCount.current <= 0) {
          dailyFirstLoadCount.current = 0;
          setDailyFirstLoading(false);
        }
      }
    })();
  }, [
    persistReady,
    topicSource,
    topicHistory,
    dailyFirstError,
    dailyFirstRetryTick,
  ]);

  const submitDraftWeave = useCallback(async () => {
    const t = dailyDraft.trim();
    if (!t || !effectiveTopic.trim() || dailyLoading) return;
    setDailyLoading(true);
    setError(null);
    try {
      const data = await requestCoach("writing-draft-weave", [
        {
          role: "user",
          content: `Writing topic:\n${effectiveTopic}\n\nMy raw draft:\n${t}`,
        },
      ]);
      setDailyOut(data.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setDailyOut(null);
    } finally {
      setDailyLoading(false);
    }
  }, [dailyDraft, dailyLoading, effectiveTopic]);

  const submitThinkTrail = useCallback(async () => {
    const t = upgradeIn.trim();
    if (!t || !effectiveTopic.trim() || upgradeLoading) return;
    setUpgradeLoading(true);
    setError(null);
    try {
      const data = await requestCoach("writing-think-trail", [
        {
          role: "user",
          content: `Writing topic (context):\n${effectiveTopic}\n\nMy draft / excerpt:\n${t}`,
        },
      ]);
      setUpgradeOut(data.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setUpgradeOut(null);
    } finally {
      setUpgradeLoading(false);
    }
  }, [upgradeIn, upgradeLoading, effectiveTopic]);

  const spinOnlineTopic = useCallback(async () => {
    if (spinLoading || dailyFirstLoading || spinCount >= ONLINE_SPIN_DAILY_MAX)
      return;
    const head = firstWritingDayHead(topicHistory);
    if (!head || head.source !== "ai_first") {
      setError("请等待今日首题生成完成后再换题。");
      return;
    }
    setSpinLoading(true);
    setError(null);
    try {
      const data = await requestCoach("writing-prompt-spin", [
        {
          role: "user",
          content: buildWritingPromptSpinUserMessage(
            topicHistory.map((it) => ({ zh: it.zh, en: it.en })),
          ),
        },
      ]);
      const parsed = parseWritingPromptSpinJson(data.content);
      if (!parsed) {
        throw new Error("题目格式无法识别，请重试");
      }
      setOnlineTopic({ zh: parsed.title_zh, en: parsed.title_en });
      setSpinCount((c) => Math.min(ONLINE_SPIN_DAILY_MAX, c + 1));
      setTopicHistory((prev) => appendOnlineToHistory(prev, head, parsed));
    } catch (e) {
      setError(e instanceof Error ? e.message : "换题失败");
    } finally {
      setSpinLoading(false);
    }
  }, [spinLoading, dailyFirstLoading, spinCount, topicHistory]);

  const retryDailyFirst = useCallback(() => {
    dailyFirstRunGen.current++;
    setDailyFirstError(null);
    setDailyFirstRetryTick((n) => n + 1);
  }, []);

  const applyTopicFromHistory = useCallback(
    (it: WritingTopicHistoryItem) => {
      const customFilled = topicSource === "custom" && customTopic.trim();
      if (
        customFilled &&
        !window.confirm(
          "将切换到「使用今日题库」并清空自定义主题框，以使用所选题目。确定？",
        )
      ) {
        return;
      }
      setError(null);
      if (topicSource === "custom") {
        if (customFilled) setCustomTopic("");
        setTopicSource("daily");
      }
      if (it.source === "online") {
        setOnlineTopic({ zh: it.zh, en: it.en });
      } else if (it.source === "ai_first") {
        setOnlineTopic(null);
        setTopicHistory((prev) => {
          const tail = prev.filter((x) => x.source === "online");
          return [{ zh: it.zh, en: it.en, source: "ai_first" as const }, ...tail];
        });
      }
    },
    [topicSource, customTopic],
  );

  const resetTodayTopicsAndSpinQuota = useCallback(() => {
    if (
      !window.confirm(
        "将清空今日在线生成题、换题次数归零，并清空「今日看过的题」里除今日首题外的记录。今日首题（AI）不变。草稿与自定义主题不变。确定？",
      )
    ) {
      return;
    }
    setError(null);
    setDailyFirstError(null);
    setOnlineTopic(null);
    setSpinCount(0);
    const head = topicHistory[0];
    const keep = head?.source === "ai_first" ? [head] : [];
    setTopicHistory(keep);
    if (keep.length === 0) setWritingDayHeadDateKey("");
  }, [topicHistory]);

  const customEmpty = topicSource === "custom" && !customTopic.trim();
  const spinsLeft = Math.max(0, ONLINE_SPIN_DAILY_MAX - spinCount);
  const topicGenBusy = dailyFirstLoading || spinLoading;
  const needsFirst = needsDailyAiFirstTopic(topicHistory);

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-8">
      <PageIntro titleEn="Writing Studio" titleZh="写作工作室">
        Daily Thoughts 练真实表达，你可以随意落笔，天马行空，不必在意拼写和语法，织稿（DraftWeave）会帮你整理零散想法、优化英文表达，并提升整体写作逻辑与语言质感；思径（ThinkTrail）会基于你已经写出的内容，主动提出进一步的问题、角度与逻辑挑战，帮你不断深化扩展，建立更完整的写作结构。草稿与教练回复保存在本机{" "}
        <code className="rounded bg-zinc-900 px-1 text-[10px]">localStorage</code>
        ；若<strong className="text-zinc-400">写作主题</strong>
        变更（今日题库换题、或你修改自定义主题），织稿一侧的旧教练回复会清空，草稿与思径结果保留至你再次生成。
        打开页面且选择「使用今日题库」时，会<strong className="text-zinc-400">自动</strong>
        用本地题库中<strong className="text-zinc-400">按日选定的一则</strong>
        作为<strong className="text-zinc-400">随机种子</strong>
        调用模型生成<strong className="text-zinc-400">一道中英双语首题</strong>
        ——种子<strong className="text-zinc-400">不会</strong>
        原样出现在题目里；<strong className="text-zinc-400">同一自然日内</strong>
        只生成这一道首题，刷新页面也不会变，<strong className="text-zinc-400">跨日（本地 0 点后）</strong>
        再打开才会换新首题。首题<strong className="text-zinc-400">不计入</strong>
        「在线换题」的 {ONLINE_SPIN_DAILY_MAX}{" "}
        次额度。「在线换题」会把<strong className="text-zinc-400">今日已出现过的题目</strong>
        发给模型，只用于要求新题在主题、领域或问法上与前面<strong className="text-zinc-400">拉开差距</strong>
        ，仍<strong className="text-zinc-400">不使用用户画像</strong>
        ；不满意可自定义主题。今日最多在「今日看过的题」中保留 {WRITING_TOPIC_HISTORY_MAX}{" "}
        条，可随时<strong className="text-zinc-400">设为题</strong>
        切换。
      </PageIntro>

      {(error || dailyFirstError) && (
        <p className="px-4 text-center text-xs text-red-400 md:px-8">
          {error ?? dailyFirstError}
        </p>
      )}

      <section className="border-b border-zinc-800 px-4 py-8 md:px-8">
        <h2 className="text-sm font-semibold text-zinc-200">
          DraftWeave · 织稿 · 今日问题
        </h2>
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
          选择使用系统轮换的「今日问题」，或填写你自己的写作主题；下方灰框内为<strong className="text-zinc-400">当前生效主题</strong>
          。
        </p>

        <div className="mt-3 flex flex-wrap gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
            <input
              type="radio"
              name="writing-topic"
              checked={topicSource === "daily"}
              onChange={() => setTopicSource("daily")}
              className="border-zinc-600 bg-zinc-900 text-emerald-600"
            />
            使用今日题库
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
            <input
              type="radio"
              name="writing-topic"
              checked={topicSource === "custom"}
              onChange={() => setTopicSource("custom")}
              className="border-zinc-600 bg-zinc-900 text-emerald-600"
            />
            自定义主题
          </label>
        </div>

        {topicSource === "custom" && (
          <label className="mt-3 block text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            自定义写作主题
            <textarea
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              rows={2}
              placeholder="中文或英文均可，例如：人工智能会不会让中等技能岗位永久消失？"
              className="mt-1 w-full max-w-3xl rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
            />
            {customEmpty && (
              <span className="mt-1 block text-[10px] text-amber-500/90">
                未填写时仍沿用「今日题库」下的 AI 首题作为主题。
              </span>
            )}
          </label>
        )}

        {topicSource === "daily" && (
          <div className="mt-2 space-y-1 text-[11px] text-zinc-600">
            <p>
              本地题库共 {WRITING_PROMPT_BANK.length}{" "}
              则，仅作按日随机种子；界面上看到的是模型生成的首题。在线换题会把<strong className="text-zinc-400">今日已出现过的题目</strong>
              发给模型，只用于要求新题在主题、领域或问法上与前面<strong className="text-zinc-400">拉开差距</strong>
              ，避免连续同一类或像「续集」；生活向与思辨向都可以，关键是不扎堆。仍不使用用户画像。
            </p>
            <p>
              今日在线换题：已用{" "}
              <span className="text-zinc-400">{spinCount}</span> /{" "}
              {ONLINE_SPIN_DAILY_MAX}，剩余{" "}
              <span className="text-zinc-400">{spinsLeft}</span> 次。
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {dailyFirstError ? (
                <button
                  type="button"
                  onClick={() => retryDailyFirst()}
                  disabled={!persistReady || dailyFirstLoading}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors",
                    persistReady && !dailyFirstLoading
                      ? "border-sky-800/80 text-sky-200/95 hover:bg-sky-950/35"
                      : "cursor-not-allowed border-zinc-800 text-zinc-600",
                  )}
                >
                  {dailyFirstLoading ? "生成中…" : "重试今日首题"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void spinOnlineTopic()}
                disabled={
                  !persistReady ||
                  topicGenBusy ||
                  needsFirst ||
                  spinCount >= ONLINE_SPIN_DAILY_MAX
                }
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors",
                  persistReady &&
                    !topicGenBusy &&
                    !needsFirst &&
                    spinCount < ONLINE_SPIN_DAILY_MAX
                    ? "border-emerald-800/80 text-emerald-300 hover:bg-emerald-950/40"
                    : "cursor-not-allowed border-zinc-800 text-zinc-600",
                )}
              >
                {spinLoading ? "换题中…" : "在线换题"}
              </button>
              <button
                type="button"
                onClick={resetTodayTopicsAndSpinQuota}
                disabled={!persistReady || topicGenBusy}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors",
                  persistReady && !topicGenBusy
                    ? "border-amber-900/70 text-amber-200/90 hover:bg-amber-950/35"
                    : "cursor-not-allowed border-zinc-800 text-zinc-600",
                )}
              >
                重置今日题目与次数
              </button>
            </div>
          </div>
        )}

        {topicSource === "custom" && customEmpty && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetTodayTopicsAndSpinQuota}
              disabled={!persistReady || topicGenBusy}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors",
                persistReady && !topicGenBusy
                  ? "border-amber-900/70 text-amber-200/90 hover:bg-amber-950/35"
                  : "cursor-not-allowed border-zinc-800 text-zinc-600",
              )}
            >
              重置今日题目与次数
            </button>
          </div>
        )}

        {topicSource === "custom" && customTopic.trim() && (
          <div className="mt-2">
            <button
              type="button"
              onClick={resetTodayTopicsAndSpinQuota}
              disabled={!persistReady || topicGenBusy}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors",
                persistReady && !topicGenBusy
                  ? "border-amber-900/70 text-amber-200/90 hover:bg-amber-950/35"
                  : "cursor-not-allowed border-zinc-800 text-zinc-600",
              )}
            >
              重置今日题目与次数（仅清在线题 / 次数 / 今日看过的题，不改自定义主题）
            </button>
          </div>
        )}

        {topicSource === "custom" && customTopic.trim() ? (
          <p className="mt-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm italic text-zinc-300">
            {customTopic.trim()}
          </p>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-300">
            {onlineTopic &&
            !(topicSource === "custom" && customTopic.trim()) ? (
              <>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  今日题库 · 在线生成
                </p>
                <p className="mt-1 font-medium not-italic text-zinc-100">
                  {onlineTopic.zh}
                </p>
                <p className="mt-2 not-italic text-zinc-400">{onlineTopic.en}</p>
              </>
            ) : dailyFirstLoading && !dayHeadBilingual ? (
              <p className="text-[12px] text-zinc-500">
                正在生成今日首题（本地题库仅作后台随机种子，不会出现在题面）…
              </p>
            ) : dayHeadBilingual ? (
              <>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  今日题库 · 今日首题（AI）
                </p>
                {(() => {
                  const [zhLine, enLine] = dayHeadBilingual.split("\n");
                  return (
                    <>
                      <p className="mt-1 font-medium not-italic text-zinc-100">
                        {zhLine}
                      </p>
                      <p className="mt-2 not-italic text-zinc-400">{enLine}</p>
                    </>
                  );
                })()}
              </>
            ) : (
              <p className="text-[12px] text-zinc-500">
                等待今日首题。请配置可用的写作教练 API Key；失败时可点「重试今日首题」。
              </p>
            )}
          </div>
        )}

        {topicHistory.some((it) => it.source !== "bank") && (
          <div className="mt-3 max-w-3xl rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-3 text-[11px] text-zinc-400">
            <p className="font-medium text-zinc-300">今日看过的题</p>
            <p className="mt-1 leading-relaxed text-zinc-500">
              含<strong className="text-zinc-400">今日首题（AI）</strong>
              与<strong className="text-zinc-400">在线生成</strong>
              出现过的题。点<strong className="text-zinc-400">设为题</strong>
              即可切到该题作为今日写作主题。
            </p>
            <ul className="mt-3 space-y-3">
              {topicHistory
                .map((it, idx) => ({ it, idx }))
                .filter(({ it }) => it.source !== "bank")
                .map(({ it, idx }) => {
                const customFilled =
                  topicSource === "custom" && customTopic.trim().length > 0;
                const isCurrent =
                  !customFilled && matchesEffectiveTopic(it, effectiveTopic);
                const onlineIdx =
                  it.source === "online"
                    ? topicHistory
                        .slice(0, idx + 1)
                        .filter((x) => x.source === "online").length
                    : 0;
                return (
                  <li
                    key={`${idx}-${it.zh.slice(0, 16)}`}
                    className={cn(
                      "rounded-lg border border-zinc-800/80 bg-zinc-900/30 px-3 py-2",
                      isCurrent && "border-emerald-900/50 bg-emerald-950/20",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-zinc-500">
                          {it.source === "ai_first"
                            ? "今日首题（AI）"
                            : `在线生成 · 第 ${onlineIdx} 题`}
                          {isCurrent ? (
                            <span className="text-emerald-400/90"> · 当前主题</span>
                          ) : null}
                        </span>
                        <p className="mt-1 font-medium text-zinc-200">{it.zh}</p>
                        <p className="mt-0.5 text-zinc-500">{it.en}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => applyTopicFromHistory(it)}
                        disabled={isCurrent}
                        className={cn(
                          "shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-medium transition-colors",
                          isCurrent
                            ? "cursor-not-allowed border-zinc-800 text-zinc-600"
                            : "border-zinc-600 text-zinc-200 hover:border-emerald-700/60 hover:bg-zinc-800/80",
                        )}
                      >
                        设为题
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <textarea
          value={dailyDraft}
          onChange={(e) => setDailyDraft(e.target.value)}
          rows={8}
          placeholder="随意用英文落笔，凌乱也没关系…"
          className="mt-4 w-full max-w-3xl rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
        />
        <button
          type="button"
          onClick={() => void submitDraftWeave()}
          disabled={dailyLoading || !dailyDraft.trim() || !effectiveTopic.trim()}
          className="mt-3 rounded-xl bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          {dailyLoading ? "…" : "织稿整理"}
        </button>
        {dailyOut && (
          <div className="mt-6 max-w-3xl rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <CoachMarkdown content={dailyOut} />
          </div>
        )}
      </section>

      <section className="px-4 py-8 md:px-8">
        <h2 className="text-sm font-semibold text-zinc-200">
          ThinkTrail · 思径
        </h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-500">
          粘贴你已写下的正文（可与织稿上方草稿相同或节选）。AI
          以追问、新角度与逻辑挑战为主，不做全文代写。
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setUpgradeIn(dailyDraft)}
            disabled={!dailyDraft.trim()}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors",
              dailyDraft.trim()
                ? "border-zinc-600 text-zinc-300 hover:border-emerald-700/50 hover:bg-zinc-800/60"
                : "cursor-not-allowed border-zinc-800 text-zinc-600",
            )}
          >
            填入上方织稿草稿
          </button>
        </div>
        <textarea
          value={upgradeIn}
          onChange={(e) => setUpgradeIn(e.target.value)}
          rows={6}
          placeholder="Paste your draft or a paragraph you want to push further…"
          className="mt-3 w-full max-w-3xl rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
        />
        <button
          type="button"
          onClick={() => void submitThinkTrail()}
          disabled={upgradeLoading || !upgradeIn.trim() || !effectiveTopic.trim()}
          className="mt-3 rounded-xl bg-zinc-800 px-6 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
        >
          {upgradeLoading ? "…" : "生成思径"}
        </button>
        {upgradeOut && (
          <div className="mt-6 max-w-3xl rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <CoachMarkdown content={upgradeOut} />
          </div>
        )}
      </section>
    </div>
  );
}

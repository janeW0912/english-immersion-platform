import type { WritingPromptEntry } from "@/lib/writing-prompt-bank";
import type { SpinPromptPair } from "@/lib/writing-prompt-spin";

/** Max items: 1 day-head (bank or AI first) + up to 5 online spins. */
export const WRITING_TOPIC_HISTORY_MAX = 6;

/** First slot of the day: calendar bank row, or AI-generated first topic. */
export type WritingTopicHeadSource = "bank" | "ai_first";

export type WritingTopicHistoryItem = {
  zh: string;
  en: string;
  source: WritingTopicHeadSource | "online";
};

export function bankHistoryItem(e: WritingPromptEntry): WritingTopicHistoryItem {
  return { zh: e.title_zh, en: e.title_en, source: "bank" };
}

/** @deprecated use bankHistoryItem */
export function localHistoryItem(e: WritingPromptEntry): WritingTopicHistoryItem {
  return bankHistoryItem(e);
}

function normalizeHistorySource(
  src: unknown,
): WritingTopicHistoryItem["source"] | null {
  if (src === "online") return "online";
  if (src === "ai_first") return "ai_first";
  if (src === "bank" || src === "local") return "bank";
  return null;
}

export function parseTopicHistoryFromStorage(raw: unknown): WritingTopicHistoryItem[] {
  if (!Array.isArray(raw)) return [];
  const out: WritingTopicHistoryItem[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const zh = typeof o.zh === "string" ? o.zh.trim() : "";
    const en = typeof o.en === "string" ? o.en.trim() : "";
    const src = normalizeHistorySource(o.source);
    if (!zh || !en || !src) continue;
    out.push({ zh, en, source: src });
  }
  return out.slice(0, WRITING_TOPIC_HISTORY_MAX);
}

/** First slot of the day: `bank` or `ai_first` (not `online`). */
export function isWritingTopicDayHead(
  it: WritingTopicHistoryItem | undefined,
): it is WritingTopicHistoryItem {
  return it != null && it.source !== "online";
}

function isDayHead(it: WritingTopicHistoryItem | undefined): boolean {
  return isWritingTopicDayHead(it);
}

/** First day-head row in history (may not be at index 0 if data is odd). */
export function firstWritingDayHead(
  history: WritingTopicHistoryItem[],
): WritingTopicHistoryItem | undefined {
  return history.find((x) => isDayHead(x));
}

/**
 * Bilingual string for the **shown** day topic — only when a day-head row exists.
 * No fallback to calendar bank (bank is seed-only for AI, not user-facing text).
 */
export function dayHeadBilingualFromHistory(
  history: WritingTopicHistoryItem[],
  _bank: WritingPromptEntry,
): string {
  const h = history[0];
  if (isDayHead(h)) return `${h!.zh}\n${h!.en}`;
  return "";
}

/**
 * After a successful online spin: keep day-head, append online, cap tail at 5.
 * `dayHead` is today's fixed first row (normally `ai_first`); if `prev` is empty, it becomes the only head before the new online row.
 */
export function appendOnlineToHistory(
  prev: WritingTopicHistoryItem[],
  dayHead: WritingTopicHistoryItem,
  online: SpinPromptPair,
): WritingTopicHistoryItem[] {
  const base = prev.length > 0 ? prev : [dayHead];
  const head = isDayHead(base[0]) ? base[0]! : dayHead;
  const tail = base.slice(1).filter((x) => x.source === "online");
  const nextTail = [
    ...tail,
    {
      zh: online.title_zh,
      en: online.title_en,
      source: "online" as const,
    },
  ].slice(-(WRITING_TOPIC_HISTORY_MAX - 1));
  return [head, ...nextTail];
}

export function topicHistoryItemKey(it: WritingTopicHistoryItem): string {
  return `${it.zh}\n${it.en}`;
}

export function matchesEffectiveTopic(
  it: WritingTopicHistoryItem,
  effectiveTopic: string,
): boolean {
  return topicHistoryItemKey(it).trim() === effectiveTopic.trim();
}

/** True when we must call AI to obtain today's non-bank day-head (empty, bank head, or online-only head). */
export function needsDailyAiFirstTopic(history: WritingTopicHistoryItem[]): boolean {
  if (history.length === 0) return true;
  const h0 = history[0];
  if (h0.source === "bank") return true;
  if (h0.source === "ai_first") return false;
  return true;
}

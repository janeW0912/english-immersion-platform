/** Browser localStorage for Speaking / Native Brain / Writing (no account sync). */

import { writingSpinLocalDateKey } from "@/lib/writing-prompt-spin";
import {
  parseTopicHistoryFromStorage,
  type WritingTopicHistoryItem,
} from "@/lib/writing-topic-history";

export type SpeakingMsgPersist = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

/** @deprecated migrated to SpeakingPersistV2 */
export type SpeakingPersistV1 = {
  version: 1;
  tab: "conv" | "debate" | "shadow";
  conv: SpeakingMsgPersist[];
  deb: SpeakingMsgPersist[];
  draftInput: string;
};

/** Saved Mind Arena threads (对话 / 辩论 / 跟读), newest first in UI */
export type SpeakingMemoryEntry = {
  id: string;
  mode: "conv" | "debate" | "shadow";
  createdAt: string;
  /** List title — e.g. first user turn truncated */
  label: string;
  messages: SpeakingMsgPersist[];
  /** When mode is shadow: reference script snapshot for reload */
  shadowRef?: string;
};

export type SpeakingPersistV2 = {
  version: 2;
  tab: "conv" | "debate" | "shadow";
  conv: SpeakingMsgPersist[];
  deb: SpeakingMsgPersist[];
  draftInput: string;
  memory: SpeakingMemoryEntry[];
  shadowRef: string;
  shadowRead: string;
  shadowMsgs: SpeakingMsgPersist[];
};

const MAX_ARENA_MEMORY = 25;

/** @deprecated migrated to NativeBrainPersistV2 */
export type NativeBrainPersistV1 = {
  version: 1;
  text: string;
  result: string | null;
};

export type NativeBrainMemoryEntry = {
  id: string;
  createdAt: string;
  transcript: string;
  result: string;
};

export type NativeBrainPersistV2 = {
  version: 2;
  text: string;
  result: string | null;
  memory: NativeBrainMemoryEntry[];
};

const MAX_NATIVE_MEMORY = 25;
const MAX_NATIVE_TRANSCRIPT_CHARS = 14_000;
const MAX_NATIVE_RESULT_CHARS = 80_000;

export type WritingPersistV1 = {
  version: 1;
  dailyDraft: string;
  dailyOut: string | null;
  /** Effective writing topic last tied to `dailyOut` (cleared when topic changes). */
  dailyPromptSnapshot: string | null;
  /** "daily" = calendar 今日问题; "custom" = `customWritingTopic` */
  writingTopicSource?: "daily" | "custom";
  customWritingTopic?: string;
  upgradeIn: string;
  upgradeOut: string | null;
  /** Local calendar day (YYYY-MM-DD) for online spin quota + override validity. */
  writingOnlineSpinDate?: string;
  /** Successful online topic spins today; max 5; resets when `writingOnlineSpinDate` ≠ today. */
  writingOnlineSpinCount?: number;
  /** When set (same day as spin date), overrides static "今日" topic for `daily` mode. */
  writingOnlineTopicZh?: string;
  writingOnlineTopicEn?: string;
  /** Today's topic roll call (day-head + online spins); cleared on new calendar day. */
  writingTopicHistory?: WritingTopicHistoryItem[];
  /** Local YYYY-MM-DD when today's AI day-head was fixed; empty until first success that day. */
  writingDayHeadDateKey?: string;
};

const KEY_SPEAKING = "eip.speaking.v1";
const KEY_NATIVE = "eip.native-brain.v1";
const KEY_WRITING = "eip.writing.v1";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const o = JSON.parse(raw) as T;
    return o && typeof o === "object" ? o : fallback;
  } catch {
    return fallback;
  }
}

export function loadSpeakingPersist(): SpeakingPersistV2 {
  const fallback: SpeakingPersistV2 = {
    version: 2,
    tab: "conv",
    conv: [],
    deb: [],
    draftInput: "",
    memory: [],
    shadowRef: "",
    shadowRead: "",
    shadowMsgs: [],
  };
  if (typeof window === "undefined") return fallback;
  const p = safeParse<Record<string, unknown>>(
    localStorage.getItem(KEY_SPEAKING),
    {},
  );

  const tab: SpeakingPersistV2["tab"] =
    p.tab === "debate" || p.tab === "shadow" || p.tab === "conv"
      ? p.tab
      : "conv";
  const conv = Array.isArray(p.conv) ? p.conv : [];
  const deb = Array.isArray(p.deb) ? p.deb : [];
  const draftInput = typeof p.draftInput === "string" ? p.draftInput : "";
  const shadowRef =
    typeof p.shadowRef === "string" ? p.shadowRef.slice(0, 14_000) : "";
  const shadowRead =
    typeof p.shadowRead === "string" ? p.shadowRead.slice(0, 14_000) : "";
  const shadowMsgs = Array.isArray(p.shadowMsgs) ? p.shadowMsgs : [];

  if (p.version === 2 || p.version === "2") {
    return {
      version: 2,
      tab,
      conv,
      deb,
      draftInput,
      memory: sanitizeArenaMemory(p.memory),
      shadowRef,
      shadowRead,
      shadowMsgs: shadowMsgs.filter(
        (m): m is SpeakingMsgPersist =>
          typeof m?.id === "string" &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string",
      ),
    };
  }

  if (p.version === 1 || p.version === "1") {
    return {
      version: 2,
      tab,
      conv,
      deb,
      draftInput,
      memory: [],
      shadowRef: "",
      shadowRead: "",
      shadowMsgs: [],
    };
  }

  return fallback;
}

function sanitizeArenaMemory(
  raw: unknown,
): SpeakingMemoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: SpeakingMemoryEntry[] = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const x = e as Partial<SpeakingMemoryEntry>;
    if (typeof x.id !== "string" || !Array.isArray(x.messages)) continue;
    const mode: SpeakingMemoryEntry["mode"] =
      x.mode === "debate"
        ? "debate"
        : x.mode === "shadow"
          ? "shadow"
          : "conv";
    out.push({
      id: x.id,
      mode,
      createdAt:
        typeof x.createdAt === "string"
          ? x.createdAt
          : new Date().toISOString(),
      label: typeof x.label === "string" ? x.label.slice(0, 200) : "Session",
      messages: x.messages.filter(
        (m): m is SpeakingMsgPersist =>
          typeof m?.id === "string" &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string",
      ),
      shadowRef:
        mode === "shadow" && typeof x.shadowRef === "string"
          ? x.shadowRef.slice(0, 14_000)
          : undefined,
    });
  }
  return out.slice(0, MAX_ARENA_MEMORY);
}

export function saveSpeakingPersist(data: SpeakingPersistV2): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed: SpeakingPersistV2 = {
      ...data,
      memory: data.memory.slice(0, MAX_ARENA_MEMORY),
    };
    localStorage.setItem(KEY_SPEAKING, JSON.stringify(trimmed));
  } catch {
    /* quota */
  }
}

/** Append a saved round; keeps newest `MAX_ARENA_MEMORY` entries. */
export function pushSpeakingMemoryEntry(
  prev: SpeakingMemoryEntry[],
  entry: Omit<SpeakingMemoryEntry, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): SpeakingMemoryEntry[] {
  const id = entry.id ?? `arena-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const full: SpeakingMemoryEntry = {
    id,
    mode: entry.mode,
    createdAt: entry.createdAt ?? new Date().toISOString(),
    label: entry.label.slice(0, 200),
    messages: entry.messages,
    ...(entry.mode === "shadow"
      ? {
          shadowRef:
            typeof entry.shadowRef === "string"
              ? entry.shadowRef.slice(0, 14_000)
              : undefined,
        }
      : {}),
  };
  return [full, ...prev.filter((x) => x.id !== id)].slice(0, MAX_ARENA_MEMORY);
}

export function loadNativeBrainPersist(): NativeBrainPersistV2 {
  const fallback: NativeBrainPersistV2 = {
    version: 2,
    text: "",
    result: null,
    memory: [],
  };
  if (typeof window === "undefined") return fallback;
  const p = safeParse<Record<string, unknown>>(
    localStorage.getItem(KEY_NATIVE),
    {},
  );

  const text = typeof p.text === "string" ? p.text : "";
  const result = typeof p.result === "string" ? p.result : null;

  if (p.version === 2 || p.version === "2") {
    return {
      version: 2,
      text,
      result,
      memory: sanitizeNativeMemory(p.memory),
    };
  }

  if (p.version === 1 || p.version === "1") {
    return {
      version: 2,
      text,
      result,
      memory: [],
    };
  }

  return fallback;
}

function sanitizeNativeMemory(raw: unknown): NativeBrainMemoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: NativeBrainMemoryEntry[] = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const x = e as Partial<NativeBrainMemoryEntry>;
    if (typeof x.id !== "string") continue;
    const transcript =
      typeof x.transcript === "string"
        ? x.transcript.slice(0, MAX_NATIVE_TRANSCRIPT_CHARS)
        : "";
    const result =
      typeof x.result === "string"
        ? x.result.slice(0, MAX_NATIVE_RESULT_CHARS)
        : "";
    out.push({
      id: x.id,
      createdAt:
        typeof x.createdAt === "string"
          ? x.createdAt
          : new Date().toISOString(),
      transcript,
      result,
    });
  }
  return out.slice(0, MAX_NATIVE_MEMORY);
}

export function saveNativeBrainPersist(data: NativeBrainPersistV2): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed: NativeBrainPersistV2 = {
      ...data,
      memory: data.memory.slice(0, MAX_NATIVE_MEMORY),
    };
    localStorage.setItem(KEY_NATIVE, JSON.stringify(trimmed));
  } catch {
    /* quota */
  }
}

/** After a successful coach run; prepends and trims list. */
export function pushNativeBrainMemory(
  prev: NativeBrainMemoryEntry[],
  transcript: string,
  result: string,
): NativeBrainMemoryEntry[] {
  const id = `nb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const entry: NativeBrainMemoryEntry = {
    id,
    createdAt: new Date().toISOString(),
    transcript: transcript.slice(0, MAX_NATIVE_TRANSCRIPT_CHARS),
    result: result.slice(0, MAX_NATIVE_RESULT_CHARS),
  };
  return [entry, ...prev.filter((x) => x.id !== id)].slice(0, MAX_NATIVE_MEMORY);
}

export function loadWritingPersist(): WritingPersistV1 {
  const fallback: WritingPersistV1 = {
    version: 1,
    dailyDraft: "",
    dailyOut: null,
    dailyPromptSnapshot: null,
    writingTopicSource: "daily",
    customWritingTopic: "",
    upgradeIn: "",
    upgradeOut: null,
    writingOnlineSpinDate: writingSpinLocalDateKey(),
    writingOnlineSpinCount: 0,
    writingOnlineTopicZh: "",
    writingOnlineTopicEn: "",
    writingTopicHistory: [],
    writingDayHeadDateKey: "",
  };
  if (typeof window === "undefined") return fallback;
  const p = safeParse<Partial<WritingPersistV1>>(
    localStorage.getItem(KEY_WRITING),
    {},
  );
  if (p.version !== 1) return fallback;
  const today = writingSpinLocalDateKey();
  let spinDate =
    typeof p.writingOnlineSpinDate === "string" ? p.writingOnlineSpinDate : "";
  let spinCount =
    typeof p.writingOnlineSpinCount === "number" ? p.writingOnlineSpinCount : 0;
  let oz =
    typeof p.writingOnlineTopicZh === "string" ? p.writingOnlineTopicZh.trim() : "";
  let oe =
    typeof p.writingOnlineTopicEn === "string"
      ? p.writingOnlineTopicEn.trim()
      : "";

  let topicHistory: WritingTopicHistoryItem[] = [];
  let dayHeadDateKey =
    typeof p.writingDayHeadDateKey === "string"
      ? p.writingDayHeadDateKey.trim()
      : "";

  if (spinDate !== today) {
    spinDate = today;
    spinCount = 0;
    oz = "";
    oe = "";
    topicHistory = [];
    dayHeadDateKey = "";
  } else {
    topicHistory = parseTopicHistoryFromStorage(p.writingTopicHistory);
    const h0 = topicHistory[0];
    if (h0?.source === "ai_first" && (!dayHeadDateKey || dayHeadDateKey !== today)) {
      dayHeadDateKey = today;
    }
  }
  spinCount = Math.min(5, Math.max(0, Math.floor(spinCount)));

  return {
    version: 1,
    dailyDraft: typeof p.dailyDraft === "string" ? p.dailyDraft : "",
    dailyOut: typeof p.dailyOut === "string" ? p.dailyOut : null,
    dailyPromptSnapshot:
      typeof p.dailyPromptSnapshot === "string"
        ? p.dailyPromptSnapshot
        : null,
    writingTopicSource:
      p.writingTopicSource === "custom" || p.writingTopicSource === "daily"
        ? p.writingTopicSource
        : undefined,
    customWritingTopic:
      typeof p.customWritingTopic === "string" ? p.customWritingTopic : "",
    upgradeIn: typeof p.upgradeIn === "string" ? p.upgradeIn : "",
    upgradeOut: typeof p.upgradeOut === "string" ? p.upgradeOut : null,
    writingOnlineSpinDate: spinDate,
    writingOnlineSpinCount: spinCount,
    writingOnlineTopicZh: oz,
    writingOnlineTopicEn: oe,
    writingTopicHistory: topicHistory,
    writingDayHeadDateKey: dayHeadDateKey,
  };
}

export function saveWritingPersist(data: WritingPersistV1): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY_WRITING, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

/** Drop DraftWeave reply when the effective writing topic changes (calendar rotation or custom edit). */
export function reconcileDraftWeaveTopic(
  loaded: WritingPersistV1,
  effectiveTopic: string,
): Pick<
  WritingPersistV1,
  "dailyDraft" | "dailyOut" | "dailyPromptSnapshot"
> {
  if (
    loaded.dailyPromptSnapshot != null &&
    loaded.dailyPromptSnapshot !== effectiveTopic
  ) {
    return {
      dailyDraft: loaded.dailyDraft,
      dailyOut: null,
      dailyPromptSnapshot: effectiveTopic,
    };
  }
  return {
    dailyDraft: loaded.dailyDraft,
    dailyOut: loaded.dailyOut,
    dailyPromptSnapshot: effectiveTopic,
  };
}

/** @deprecated use reconcileDraftWeaveTopic */
export function reconcileWritingWithTodayPrompt(
  loaded: WritingPersistV1,
  todayPrompt: string,
): Pick<
  WritingPersistV1,
  "dailyDraft" | "dailyOut" | "dailyPromptSnapshot"
> {
  return reconcileDraftWeaveTopic(loaded, todayPrompt);
}


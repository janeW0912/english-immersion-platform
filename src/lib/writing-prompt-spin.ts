import type {
  WritingPromptCategory,
  WritingPromptEntry,
} from "@/lib/writing-prompt-bank";

const CATEGORIES: WritingPromptCategory[] = [
  "contradiction",
  "hypothetical_world",
  "personal_reflection",
  "value_conflict",
  "social_observation",
  "philosophy",
];

/** Light stylistic nudges — any life scale is OK; do not bias away from ordinary life. */
const STYLISTIC_NUDGES_EN = [
  "Try a question shape unlike the bulk of the list below (e.g. if they were all 'why…', switch to 'if…' or 'who decides…').",
  "Change the *domain* of attention (e.g. body, money, nature, work, family, city, memory, future) vs whatever repeats below.",
  "Shift emotional temperature vs the cluster below (cool ↔ heated, funny ↔ solemn) without copying their core worry.",
  "Offer one concrete hook word or image — domestic, public, or abstract are all fine if fresh vs the list.",
] as const;

function pick<T>(arr: readonly T[]): T {
  const i = Math.floor(Math.random() * arr.length);
  return arr[i]!;
}

export type SpinSessionTopic = { zh: string; en: string };

/**
 * `previousTopicsToday`: bilingual prompts already shown today (local + prior spins).
 * Used only so the **next** topic is not a near-duplicate cluster — not user profiling.
 */
export function buildWritingPromptSpinUserMessage(
  previousTopicsToday: SpinSessionTopic[],
): string {
  const category = pick(CATEGORIES);
  const stylistic = pick(STYLISTIC_NUDGES_EN);
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const trimmed = previousTopicsToday
    .map((t) => ({
      zh: t.zh.trim(),
      en: t.en.trim(),
    }))
    .filter((t) => t.zh && t.en);

  const listBlock =
    trimmed.length === 0
      ? "(none yet — still write one strong standalone prompt.)"
      : trimmed.map((t, i) => `${i + 1}. ZH: ${t.zh} / EN: ${t.en}`).join("\n");

  return [
    "Generate ONE short bilingual writing topic for an English learner.",
    "",
    "STRICT RULES:",
    "- Output **only** a single JSON object, no markdown fences, no extra text.",
    '- Shape: {"title_zh":"...","title_en":"..."}',
    "- Do **not** personalize: no user profile, no inferred interests, no \"because you like…\", no demographics.",
    "- Do **not** use anything outside this message except common knowledge.",
    "- Not exam English: no \"Discuss advantages and disadvantages\"; no \"Do you agree or disagree?\".",
    "- Keep it open: one question or invitation to write; emotionally or intellectually inviting.",
    "- **title_zh**: natural spoken Chinese, ≤ 40 characters.",
    "- **title_en**: natural spoken English, ≤ 130 characters.",
    "",
    "CONTRAST VS TODAY'S LIST (session only — not personalization):",
    "- The block **TOPICS_ALREADY_TODAY** is the exact bilingual prompts already shown today in this flow.",
    "- Your new topic must **clearly diverge** from that set: different core theme, domain, or rhetorical move — not a sequel, not a \"part two\", not a small rephrase of the latest line.",
    "- If several below feel like the same *type* (e.g. all relationship angst, all tech dread), deliberately **break the streak** — ordinary life, work, family, inner life, society, or wild hypotheticals are all allowed; do **not** bias against \"small\" life topics if they would still feel **new** relative to the list.",
    "- **Stylistic nudge (soft):** " + stylistic,
    "",
    "TOPICS_ALREADY_TODAY:",
    listBlock,
    "",
    "EXTRA SEED (soft hint; you may ignore if it fights contrast):",
    `- template_category: ${category}`,
    `- nonce: ${nonce}`,
  ].join("\n");
}

/**
 * First topic of the local calendar day: calendar bank row is **seed only** —
 * it must **not** appear in `title_zh` / `title_en` (no quote, no close paraphrase).
 */
export function buildWritingPromptFirstOfDayUserMessage(
  seed: WritingPromptEntry,
): string {
  const category = pick(CATEGORIES);
  const stylistic = pick(STYLISTIC_NUDGES_EN);
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return [
    "Generate ONE short bilingual writing topic for an English learner.",
    "",
    "INTERNAL_CALENDAR_SEED (for your eyes only — **must not** appear in the output JSON):",
    `- ZH: ${seed.title_zh}`,
    `- EN: ${seed.title_en}`,
    "",
    "STRICT RULES:",
    "- Output **only** a single JSON object, no markdown fences, no extra text.",
    '- Shape: {"title_zh":"...","title_en":"..."}',
    "- **title_zh** and **title_en** must be **brand-new questions** — zero reuse of distinctive phrases from INTERNAL_CALENDAR_SEED; a reader must not guess which seed row was used. You may borrow only a very loose vibe (e.g. level of abstraction), not the scenario or wording.",
    "- Do **not** personalize: no user profile, no inferred interests.",
    "- Not exam English: no \"Discuss advantages and disadvantages\"; no \"Do you agree or disagree?\".",
    "- Keep it open: one question or invitation to write; emotionally or intellectually inviting.",
    "- **title_zh**: natural spoken Chinese, ≤ 40 characters.",
    "- **title_en**: natural spoken English, ≤ 130 characters.",
    "",
    "STYLISTIC NUDGE (soft): " + stylistic,
    "",
    `- template_category: ${category}`,
    `- nonce: ${nonce}`,
  ].join("\n");
}

export type SpinPromptPair = { title_zh: string; title_en: string };

export function parseWritingPromptSpinJson(raw: string): SpinPromptPair | null {
  let s = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```\s*$/im.exec(s);
  if (fence) s = fence[1]!.trim();

  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  const jsonSlice =
    start >= 0 && end > start ? s.slice(start, end + 1) : s.trim();

  let obj: unknown;
  try {
    obj = JSON.parse(jsonSlice) as unknown;
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const r = obj as Record<string, unknown>;
  const zh = typeof r.title_zh === "string" ? r.title_zh.trim() : "";
  const en = typeof r.title_en === "string" ? r.title_en.trim() : "";
  if (!zh || !en) return null;
  return {
    title_zh: zh.slice(0, 80),
    title_en: en.slice(0, 200),
  };
}

export function writingSpinLocalDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function resolveWritingEffectiveTopic(params: {
  topicSource: "daily" | "custom";
  customTopic: string;
  todayBilingual: string;
  onlineZh?: string;
  onlineEn?: string;
}): string {
  if (params.topicSource === "custom" && params.customTopic.trim()) {
    return params.customTopic.trim();
  }
  const zh = params.onlineZh?.trim();
  const en = params.onlineEn?.trim();
  if (zh && en) {
    return `${zh}\n${en}`;
  }
  return params.todayBilingual;
}

import rawBank from "./writing-prompt-bank.json";

export type WritingPromptCategory =
  | "contradiction"
  | "hypothetical_world"
  | "personal_reflection"
  | "value_conflict"
  | "social_observation"
  | "philosophy";

export type BilingualLine = { en: string; zh: string };

export type WritingPromptEntry = {
  title_en: string;
  title_zh: string;
  category: WritingPromptCategory;
  emotion: string;
  depth: 1 | 2 | 3;
  tags: string[];
  follow_ups: BilingualLine[];
  related_topics: string[];
};

export const WRITING_PROMPT_BANK: WritingPromptEntry[] =
  rawBank as WritingPromptEntry[];

/** English line only — for immersion writing topic. */
export function writingPromptTitles(): string[] {
  return WRITING_PROMPT_BANK.map((e) => e.title_en);
}

/** One string per prompt: Chinese + English (compact UI). */
export function writingPromptBilingualLines(): string[] {
  return WRITING_PROMPT_BANK.map(
    (e) => `${e.title_zh} ${e.title_en}`,
  );
}

export function writingPromptsByCategory(
  category: WritingPromptCategory,
): WritingPromptEntry[] {
  return WRITING_PROMPT_BANK.filter((e) => e.category === category);
}

/** Stable pseudo-random pick from bank (same index for same date string). */
export function writingPromptForDateSeed(seed: string): WritingPromptEntry {
  let h = 0;
  for (let i = 0; i < seed.length; i++)
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % WRITING_PROMPT_BANK.length;
  return WRITING_PROMPT_BANK[idx]!;
}

/** Same day-index scheme as legacy `dailyPromptForToday` — stable per calendar day. */
export function writingPromptEntryForToday(): WritingPromptEntry {
  const d = new Date();
  const index =
    (d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate()) %
    WRITING_PROMPT_BANK.length;
  return WRITING_PROMPT_BANK[index]!;
}

export function writingTopicBilingualString(e: WritingPromptEntry): string {
  return `${e.title_zh}\n${e.title_en}`;
}

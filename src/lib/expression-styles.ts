/** Preset rewrite targets for Expression Lab (multi-select + optional custom). */

export type ExpressionStylePreset = {
  id: string;
  /** Markdown section heading (English + 中文) */
  heading: string;
  /** Short hint for the model */
  hint: string;
};

export const EXPRESSION_STYLE_PRESETS: ExpressionStylePreset[] = [
  {
    id: "casual",
    heading: "Casual Native（口语化）",
    hint: "Natural spoken English; contractions and rhythm like real chat.",
  },
  {
    id: "formal",
    heading: "Written / Formal（书面化）",
    hint: "Clear formal register suitable for email, essay, or report.",
  },
  {
    id: "sophisticated",
    heading: "Sophisticated（进阶书面）",
    hint: "Nuanced, idiomatic, publication-level when it fits the idea.",
  },
  {
    id: "literary",
    heading: "Literary（文艺化）",
    hint: "Slightly literary or lyrical — still faithful to the user’s meaning.",
  },
  {
    id: "concise",
    heading: "Concise & punchy（简洁有力）",
    hint: "Strip redundancy; short clauses; strong verbs.",
  },
  {
    id: "warm",
    heading: "Warm & friendly（亲切温和）",
    hint: "Approachable, kind tone — not stiff service-speak.",
  },
  {
    id: "persuasive",
    heading: "Persuasive（说服力）",
    hint: "Rhetoric that could stand in a short pitch or argument slide.",
  },
];

const PRESET_BY_ID = new Map(
  EXPRESSION_STYLE_PRESETS.map((p) => [p.id, p] as const),
);

/** Short label for Markdown heading **Custom（…）** — strips chars that break the title. */
export function formatCustomStyleTitle(customNote: string): string {
  let s = customNote
    .trim()
    .replace(/\*\*/g, "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ");
  s = s.replace(/[）)]/g, "").replace(/[（(]/g, "");
  if (!s) return "自定义";
  const max = 28;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** When user picks nothing and leaves custom empty → legacy three-way output. */
export function normalizeExpressionStyleIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    if (PRESET_BY_ID.has(x) && !out.includes(x)) out.push(x);
  }
  return out;
}

/**
 * Appended to the expression coach system prompt so the model knows which
 * rewrite blocks to produce.
 */
export function buildExpressionStyleRequestBlock(
  presetIds: string[],
  customNote: string,
): string {
  const custom = customNote.trim();
  const ids = normalizeExpressionStyleIds(presetIds);
  if (ids.length === 0 && !custom) {
    return [
      "EXPRESSION_STYLE_REQUEST:",
      "default_three",
      "(Produce the classic three blocks: **Casual Native**, **Academic**, **Sophisticated** — same headings as legacy.)",
    ].join("\n");
  }

  const lines = ["EXPRESSION_STYLE_REQUEST:", "Produce one rewrite block per line below, in order."];
  for (const id of ids) {
    const p = PRESET_BY_ID.get(id);
    if (p) {
      lines.push(`- id:${id} → section heading exactly: **${p.heading}** — ${p.hint}`);
    }
  }
  if (custom) {
    const title = formatCustomStyleTitle(custom);
    lines.push(
      `- CUSTOM_STYLE — section heading **exactly** (include the user’s words in parentheses): **Custom（${title}）** — one \`> \` rewrite line that follows this full brief: ${custom.slice(0, 400)}`,
    );
  }
  lines.push(
    "Then **中文** (brief synthesis). Then **Follow-up** (one English question).",
  );
  return lines.join("\n");
}

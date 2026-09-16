/** Pure helpers — safe to import from client or server. */

/** Decode `&#x27;` / `&#39;` / `&apos;` etc. RSS/HTML often encodes apostrophe as `&#x27;`. */
export function decodeHtmlEntities(input: string): string {
  let s = input;

  s = s.replace(/&#x([0-9a-fA-F]{1,6});/gi, (_, hex: string) => {
    const cp = parseInt(hex, 16);
    if (!Number.isFinite(cp) || cp === 0 || cp > 0x10ffff) return "";
    if (cp >= 0xd800 && cp <= 0xdfff) return "\ufffd";
    try {
      return String.fromCodePoint(cp);
    } catch {
      return "";
    }
  });

  s = s.replace(/&#(\d{1,7});/g, (_, dec: string) => {
    const cp = parseInt(dec, 10);
    if (!Number.isFinite(cp) || cp === 0 || cp > 0x10ffff) return "";
    if (cp >= 0xd800 && cp <= 0xdfff) return "\ufffd";
    try {
      return String.fromCodePoint(cp);
    } catch {
      return "";
    }
  });

  const named: [string, string][] = [
    ["&nbsp;", " "],
    ["&apos;", "'"],
    ["&quot;", '"'],
    ["&ldquo;", "\u201c"],
    ["&rdquo;", "\u201d"],
    ["&lsquo;", "\u2018"],
    ["&rsquo;", "\u2019"],
    ["&hellip;", "…"],
    ["&mdash;", "—"],
    ["&ndash;", "–"],
    ["&lt;", "<"],
    ["&gt;", ">"],
    ["&amp;", "&"],
  ];
  for (const [from, to] of named) {
    if (s.includes(from)) s = s.split(from).join(to);
  }

  return s;
}

export function stripHtml(html: string): string {
  if (!html) return "";
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(stripped)
    .replace(/\s+/g, " ")
    .trim();
}

/** Like stripHtml but keeps paragraph breaks from common block / br tags (for article body). */
export function stripHtmlPreserveParagraphs(html: string): string {
  if (!html) return "";
  let h = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(
      /<\/(div|section|article|header|footer|main|blockquote|figure|li|tr|h[1-6])>/gi,
      "\n",
    )
    .replace(/<[^>]+>/g, " ");
  h = decodeHtmlEntities(h);
  h = h.replace(/[^\S\n]+/g, " ");
  h = h.replace(/[ \t]*\n[ \t]*/g, "\n");
  h = h.replace(/\n{3,}/g, "\n\n");
  return h.trim();
}

/** Truncate plain text without collapsing newlines; prefers breaking at paragraph or line. */
export function truncateWithNewlines(text: string, max: number): string {
  const t = text.replace(/\r\n/g, "\n").trimEnd();
  if (t.length <= max) return t.trim();
  let cut = t.slice(0, max - 1);
  const paraBreak = cut.lastIndexOf("\n\n");
  if (paraBreak > max * 0.55) {
    cut = cut.slice(0, paraBreak).trimEnd();
  } else {
    const lineBreak = cut.lastIndexOf("\n");
    if (lineBreak > max * 0.45) {
      cut = cut.slice(0, lineBreak).trimEnd();
    } else {
      const sp = cut.lastIndexOf(" ");
      if (sp > max * 0.35) cut = cut.slice(0, sp).trimEnd();
    }
  }
  return `${cut}…`;
}

/** First sentence or bounded chunk for coaching focus line. */
export function pickFocusLine(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "…";
  const idx = t.search(/[.!?]\s/);
  if (idx !== -1 && idx < 220) return t.slice(0, idx + 1).trim();
  return t.length > 200 ? `${t.slice(0, 197)}…` : t;
}

export function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

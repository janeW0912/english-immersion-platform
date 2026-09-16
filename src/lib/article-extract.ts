import { stripHtml, stripHtmlPreserveParagraphs } from "@/lib/immersion-text";

const MAX_ARTICLE_CHARS = 500_000;

function concatTextBlocks(html: string): string | null {
  const re = /data-component=["']text-block["'][^>]*>([\s\S]*?)<\/div>/gi;
  const parts: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const t = stripHtmlPreserveParagraphs(m[1] ?? "").replace(/\n{3,}/g, "\n\n").trim();
    if (t.length > 20) parts.push(t);
  }
  if (!parts.length) return null;
  return parts.join("\n\n").trim();
}

/** Rough main-content extraction for news pages (BBC / Guardian patterns). */
export function extractArticlePlainText(html: string): string {
  if (!html) return "";

  const h = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  const clip = (s: string) => s.slice(0, MAX_ARTICLE_CHARS);

  const guardian = concatTextBlocks(h);
  if (guardian && guardian.length > 400) return clip(guardian);

  const art = h.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (art?.[1]) {
    const plain = stripHtmlPreserveParagraphs(art[1]).replace(/\n{3,}/g, "\n\n").trim();
    if (plain.length > 400) return clip(plain);
  }

  const bodyMatch = h.match(
    /itemprop=["']articleBody["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i,
  );
  if (bodyMatch?.[1]) {
    const plain = stripHtmlPreserveParagraphs(bodyMatch[1])
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (plain.length > 400) return clip(plain);
  }

  const mainMatch = h.match(/role=["']main["'][^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch?.[1]) {
    const plain = stripHtmlPreserveParagraphs(mainMatch[1])
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (plain.length > 400) return clip(plain);
  }

  const fallback = stripHtmlPreserveParagraphs(h).replace(/\n{3,}/g, "\n\n").trim();
  return clip(fallback);
}

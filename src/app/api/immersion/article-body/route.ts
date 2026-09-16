import { extractArticlePlainText } from "@/lib/article-extract";
import { fetchTextWithRetry } from "@/lib/outbound-fetch";
import { truncateWithNewlines } from "@/lib/immersion-text";
import { immersionRssBodyMaxChars } from "@/lib/immersion-body-limits";

export const runtime = "nodejs";
export const maxDuration = 120;

function articleTimeoutMs(): number {
  const n = Number(process.env.IMMERSION_ARTICLE_TIMEOUT_MS);
  if (Number.isFinite(n) && n >= 10000) return Math.min(n, 180000);
  return 90000;
}

function isAllowedUrl(urlStr: string): URL | null {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("url")?.trim() ?? "";
  const u = isAllowedUrl(raw);
  if (!u) {
    return Response.json({ error: "invalid or missing url" }, { status: 400 });
  }

  try {
    const html = await fetchTextWithRetry(u.toString(), 2, {
      timeoutMs: articleTimeoutMs(),
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const plain = extractArticlePlainText(html);
    const max = immersionRssBodyMaxChars();
    const text = truncateWithNewlines(plain, max);
    return Response.json({
      url: u.toString(),
      charCount: text.length,
      text,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch failed";
    return Response.json({ error: message }, { status: 502 });
  }
}

import { createHash } from "node:crypto";
import Parser from "rss-parser";
import { DEFAULT_IMMERSION_RSS_URLS } from "@/lib/default-rss-feeds";
import {
  FALLBACK_IMMERSION_ITEMS,
  type ImmersionCard,
} from "@/lib/immersion-items";
import { immersionRssBodyMaxChars } from "@/lib/immersion-body-limits";
import { extractRssAudioUrl } from "@/lib/extract-rss-audio-url";
import { inferImmersionTopics } from "@/lib/immersion-metadata";
import { pickFocusLine, stripHtml, truncate } from "@/lib/immersion-text";
import { fetchTextWithRetry } from "@/lib/outbound-fetch";
import { extractYoutubeVideoId } from "@/lib/youtube-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function hashId(link: string, index: number): string {
  return createHash("sha256")
    .update(`${link}:${index}`)
    .digest("hex")
    .slice(0, 22);
}

function rssItemCategories(item: {
  categories?: unknown;
}): string[] {
  const c = item.categories;
  if (!Array.isArray(c)) return [];
  return c
    .map((x) => {
      if (typeof x === "string") return x.trim();
      if (x && typeof x === "object" && "_" in (x as object)) {
        return String((x as { _: string })._).trim();
      }
      return "";
    })
    .filter(Boolean);
}

function parseItemPublishedAt(item: {
  isoDate?: string;
  pubDate?: string;
}): string | undefined {
  if (item.isoDate) {
    const d = Date.parse(item.isoDate);
    if (!Number.isNaN(d)) return new Date(d).toISOString();
  }
  if (item.pubDate) {
    const d = Date.parse(item.pubDate);
    if (!Number.isNaN(d)) return new Date(d).toISOString();
  }
  return undefined;
}

function parseEnvUrls(): string[] {
  const raw = process.env.IMMERSION_RSS_URLS?.trim();
  if (!raw) return [...DEFAULT_IMMERSION_RSS_URLS];
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function parseOneFeed(feedUrl: string): Promise<{
  feedTitle: string;
  items: ImmersionCard[];
  error?: string;
}> {
  const parser = new Parser({
    customFields: {
      item: [["content:encoded", "encodedContent"]],
    },
  });

  try {
    const xml = await fetchTextWithRetry(feedUrl, 3);
    const feed = await parser.parseString(xml);

    const feedTitle =
      stripHtml(feed.title || "").slice(0, 48) ||
      new URL(feedUrl).hostname.replace(/^www\./, "");

    const rawItems = feed.items ?? [];
    const cards: ImmersionCard[] = rawItems.slice(0, 12).map((item, i) => {
      const link =
        item.link ||
        (typeof item.guid === "string" ? item.guid : "") ||
        "";

      const ext = item as typeof item & { encodedContent?: string };
      const itemAny = item as unknown as Record<string, unknown>;
      const blob =
        item.contentSnippet ||
        item.summary ||
        (typeof itemAny.description === "string" ? itemAny.description : "") ||
        item.content ||
        "";
      const excerpt = truncate(stripHtml(blob), 560);
      const videoId = extractYoutubeVideoId(link);
      const audioUrl = videoId ? undefined : extractRssAudioUrl(item);
      const focusLine = audioUrl
        ? pickFocusLine(stripHtml(item.title || "") + " " + excerpt)
        : pickFocusLine(excerpt);

      const htmlParts = [
        ext.encodedContent,
        item.content,
        item.summary,
        typeof itemAny.description === "string" ? itemAny.description : "",
      ].filter((x): x is string => typeof x === "string" && x.trim().length > 0);

      let longestPlain = "";
      for (const h of htmlParts) {
        const plain = stripHtml(h);
        if (plain.length > longestPlain.length) longestPlain = plain;
      }
      if (!longestPlain.length) {
        longestPlain = stripHtml(blob);
      }
      const body = truncate(longestPlain, immersionRssBodyMaxChars());
      const titlePlain = truncate(stripHtml(item.title || ""), 180) || "(untitled)";
      const catList = rssItemCategories(item);
      const publishedAt = parseItemPublishedAt(item);
      const topics = inferImmersionTopics({
        feedUrl,
        feedTitle,
        title: titlePlain,
        excerpt,
        rssCategories: catList,
      });

      return {
        id: hashId(`${link || ""}|${audioUrl || "no-audio"}|${feedUrl}:${i}`, i),
        source: feedTitle,
        tag: videoId ? "YouTube" : audioUrl ? "Podcast" : "RSS",
        title: titlePlain,
        excerpt,
        body,
        focusLine,
        publishedAt,
        topics,
        url: link || undefined,
        videoId,
        audioUrl: audioUrl || undefined,
      };
    });

    return { feedTitle, items: cards };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { feedTitle: "", items: [], error: `${feedUrl}: ${msg}` };
  }
}

export async function GET() {
  const urls = parseEnvUrls();
  const warnings: string[] = [];

  const batches = await Promise.all(urls.map((u) => parseOneFeed(u)));
  for (const b of batches) {
    if (b.error) warnings.push(b.error);
  }

  const merged: ImmersionCard[] = [];
  const seen = new Set<string>();

  for (const b of batches) {
    for (const card of b.items) {
      const key = card.url || card.id;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(card);
    }
  }

  const items = merged.slice(0, 48);

  if (items.length === 0) {
    const hasProxy = Boolean(
      process.env.RSS_HTTP_PROXY?.trim() ||
        process.env.GEMINI_HTTP_PROXY?.trim(),
    );
    const proxyHint = hasProxy
      ? ""
      : "若在国内直连超时：在 .env.local 设置 RSS_HTTP_PROXY=http://127.0.0.1:7890（端口按 Clash），或与 GEMINI 共用同一代理；可选 IMMERSION_RSS_TIMEOUT_MS=60000。";
    const mergedWarnings = [...warnings];
    if (proxyHint) mergedWarnings.push(proxyHint);
    return Response.json({
      source: "fallback" as const,
      fetchedAt: new Date().toISOString(),
      items: FALLBACK_IMMERSION_ITEMS,
      warnings:
        mergedWarnings.length > 0
          ? mergedWarnings
          : ["No RSS items parsed — using offline samples."],
    });
  }

  return Response.json({
    source: "rss" as const,
    fetchedAt: new Date().toISOString(),
    items,
    warnings: warnings.length ? warnings : undefined,
  });
}

import { ProxyAgent, fetch as undiciFetch } from "undici";
import {
  immersionPodcastAudioMaxTotalBytes,
  immersionPodcastAudioTimeoutMs,
} from "@/lib/immersion-body-limits";

/**
 * 出站 HTTP 代理：RSS 等国际站在国内常需代理。
 * 优先 RSS_HTTP_PROXY，否则与 Gemini 共用 GEMINI_HTTP_PROXY / HTTPS_PROXY。
 */
export function getOutboundProxyUrl(): string | undefined {
  return (
    process.env.RSS_HTTP_PROXY?.trim() ||
    process.env.GEMINI_HTTP_PROXY?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim() ||
    undefined
  );
}

function rssTimeoutMs(): number {
  const n = Number(process.env.IMMERSION_RSS_TIMEOUT_MS);
  if (Number.isFinite(n) && n >= 5000) return Math.min(n, 120000);
  return 45000;
}

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept:
    "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

type FetchTextOpts = { headers?: Record<string, string>; timeoutMs?: number };

/** GET 文本；有代理时用 Undici + ProxyAgent（与 Node fetch 行为一致）。 */
export async function fetchTextOutbound(
  url: string,
  opts?: FetchTextOpts,
): Promise<string> {
  const timeoutMs = opts?.timeoutMs ?? rssTimeoutMs();
  const proxy = getOutboundProxyUrl();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const headers = { ...DEFAULT_HEADERS, ...opts?.headers };

  try {
    if (proxy) {
      const dispatcher = new ProxyAgent(proxy);
      const res = await undiciFetch(url, {
        method: "GET",
        headers,
        signal: ac.signal,
        dispatcher,
      } as never);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.text();
    }

    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: ac.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** 超时 / 网络抖动时重试几次（每次重新计时）。 */
export async function fetchTextWithRetry(
  url: string,
  maxAttempts = 3,
  opts?: FetchTextOpts,
): Promise<string> {
  let last: Error = new Error("unknown");
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetchTextOutbound(url, opts);
    } catch (e) {
      last = e instanceof Error ? e : new Error(String(e));
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 600 * attempt));
      }
    }
  }
  throw last;
}

const AUDIO_FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "audio/*,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

/** GET binary body (e.g. podcast MP3); respects RSS_HTTP_PROXY / GEMINI_HTTP_PROXY. */
export async function fetchBytesOutbound(
  url: string,
  opts?: { maxBytes?: number; timeoutMs?: number },
): Promise<{ data: Buffer; contentType: string }> {
  const maxBytes = opts?.maxBytes ?? immersionPodcastAudioMaxTotalBytes();
  const timeoutMs = opts?.timeoutMs ?? immersionPodcastAudioTimeoutMs();
  const proxy = getOutboundProxyUrl();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  try {
    if (proxy) {
      const dispatcher = new ProxyAgent(proxy);
      const res = await undiciFetch(url, {
        method: "GET",
        headers: AUDIO_FETCH_HEADERS,
        signal: ac.signal,
        dispatcher,
      } as never);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > maxBytes) {
        throw new Error(
          `Audio file too large (${buf.length} bytes, max ${maxBytes}). Raise IMMERSION_PODCAST_AUDIO_MAX_TOTAL_BYTES or pick a shorter episode.`,
        );
      }
      const contentType =
        res.headers.get("content-type")?.split(";")[0].trim() || "audio/mpeg";
      return { data: buf, contentType };
    }

    const res = await fetch(url, {
      method: "GET",
      headers: AUDIO_FETCH_HEADERS,
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) {
      throw new Error(
        `Audio file too large (${buf.length} bytes, max ${maxBytes}). Raise IMMERSION_PODCAST_AUDIO_MAX_TOTAL_BYTES or pick a shorter episode.`,
      );
    }
    const contentType =
      res.headers.get("content-type")?.split(";")[0].trim() || "audio/mpeg";
    return { data: buf, contentType };
  } finally {
    clearTimeout(timer);
  }
}

import type { Item } from "rss-parser";

const AUDIO_EXT = /\.(mp3|m4a|aac|opus|wav|ogg|flac)(\?|#|$)/i;

function looksAudioUrl(url: string, mime?: string): boolean {
  const m = (mime || "").toLowerCase();
  if (m.startsWith("audio/")) return true;
  return AUDIO_EXT.test(url);
}

/** First RSS/Atom enclosure that points to an audio file. */
export function extractRssAudioUrl(item: Item): string | undefined {
  const enc = item.enclosure;
  if (enc?.url && looksAudioUrl(enc.url, enc.type)) {
    return enc.url.trim();
  }
  const any = item as Item & {
    enclosures?: { url?: string; type?: string }[];
  };
  const list = any.enclosures;
  if (Array.isArray(list)) {
    for (const e of list) {
      if (e?.url && looksAudioUrl(e.url, e.type)) return e.url.trim();
    }
  }
  return undefined;
}

import {
  immersionPodcastChunkMaxBytes,
} from "@/lib/immersion-body-limits";
import { pickFocusLine, truncate } from "@/lib/immersion-text";
import {
  isLikelySplittableMp3,
  splitMp3IntoFrameAlignedChunks,
} from "@/lib/mp3-chunk-split";
import { fetchBytesOutbound } from "@/lib/outbound-fetch";
import { normalizeAudioMimeType } from "@/lib/podcast-audio-mime";
import {
  mockPodcastTranscript,
  transcribePodcastBuffer,
  transcribePodcastBuffers,
} from "@/lib/podcast-gemini-transcribe";
import { augmentNetworkError, geminiApiKey } from "@/lib/run-llm-coach";

export const runtime = "nodejs";
export const maxDuration = 300;

function isAllowedUrl(urlStr: string): URL | null {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u;
  } catch {
    return null;
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchAudioWithRetry(
  url: string,
): Promise<{ data: Buffer; contentType: string }> {
  let last: Error = new Error("unknown");
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await fetchBytesOutbound(url);
    } catch (e) {
      last = e instanceof Error ? e : new Error(String(e));
      if (attempt < 2) await sleep(500 * attempt);
    }
  }
  throw last;
}

export async function POST(req: Request) {
  let body: { audioUrl?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = typeof body.audioUrl === "string" ? body.audioUrl.trim() : "";
  const u = isAllowedUrl(raw);
  if (!u) {
    return Response.json({ error: "invalid or missing audioUrl" }, { status: 400 });
  }

  const title =
    typeof body.title === "string" ? body.title.trim().slice(0, 500) : "";

  try {
    if (!geminiApiKey()) {
      const text = mockPodcastTranscript(title || "Podcast episode");
      return Response.json({
        text,
        preview: truncate(text, 900),
        focusLine: pickFocusLine(text),
        mode: "mock" as const,
      });
    }

    const { data, contentType } = await fetchAudioWithRetry(u.toString());
    const chunkMax = immersionPodcastChunkMaxBytes();
    const mime = normalizeAudioMimeType(u.toString(), contentType);
    const episodeTitle = title || "(untitled episode)";

    let text: string;
    if (data.length <= chunkMax) {
      text = await transcribePodcastBuffer({
        audioBytes: data,
        audioUrl: u.toString(),
        contentTypeHeader: contentType,
        episodeTitle,
      });
    } else if (isLikelySplittableMp3(u.toString(), mime)) {
      const segments = splitMp3IntoFrameAlignedChunks(data, chunkMax);
      if (segments.length <= 1) {
        throw new Error(
          "音频超过单段上限但无法在 MP3 帧边界分段（可能不是标准 MP3）。可调高 IMMERSION_PODCAST_AUDIO_MAX_BYTES，或换用 MP3/M4A 以外格式暂不支持分段。",
        );
      }
      text = await transcribePodcastBuffers({
        segments,
        audioUrl: u.toString(),
        contentTypeHeader: contentType,
        episodeTitle,
      });
    } else {
      throw new Error(
        `音频约 ${(data.length / (1024 * 1024)).toFixed(1)} MiB，超过单段转写上限 ${(chunkMax / (1024 * 1024)).toFixed(0)} MiB；当前 MIME(${mime}) 不支持自动分段（仅标准 MP3 / audio/mpeg）。可调高 IMMERSION_PODCAST_AUDIO_MAX_BYTES，或选用 MP3 订阅源。`,
      );
    }

    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return Response.json({ error: "Empty transcript" }, { status: 502 });
    }

    return Response.json({
      text: normalized,
      preview: truncate(normalized, 900),
      focusLine: pickFocusLine(normalized),
      mode: "live" as const,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "transcribe failed";
    return Response.json(
      { error: augmentNetworkError(message) },
      { status: 502 },
    );
  }
}

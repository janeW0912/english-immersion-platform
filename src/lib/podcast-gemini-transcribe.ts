import { GoogleGenAI } from "@google/genai";
import { geminiApiKey } from "@/lib/run-llm-coach";
import { withGeminiProxiedFetch } from "@/lib/gemini-fetch";
import { normalizeAudioMimeType } from "@/lib/podcast-audio-mime";

const TRANSCRIBE_PROMPT = `Transcribe this podcast audio into plain English text.

Rules:
- Output only the spoken words as readable prose (short paragraphs when the speaker/topic changes are fine).
- Do not add a summary, title, or meta commentary about the audio.
- Keep proper nouns and technical terms as spoken. Use [unintelligible] only when truly unclear.`;

function podcastTranscribeModel(): string {
  return (
    process.env.GEMINI_PODCAST_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    "gemini-2.0-flash"
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function transcribeSingleUploadedAudio(params: {
  ai: GoogleGenAI;
  modelId: string;
  mimeType: string;
  audioBytes: Buffer;
  episodeTitle: string;
  displayName: string;
  segmentHint: string;
}): Promise<string> {
  const blob = new Blob([new Uint8Array(params.audioBytes)], {
    type: params.mimeType,
  });

  const uploaded = await params.ai.files.upload({
    file: blob,
    config: {
      mimeType: params.mimeType,
      displayName: params.displayName.slice(0, 200) || "podcast-segment",
    },
  });

  const name = uploaded.name;
  if (!name) throw new Error("Upload did not return file name");

  try {
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      const f = await params.ai.files.get({ name });
      if (f.state === "ACTIVE" && f.uri) break;
      if (f.state === "FAILED") {
        throw new Error(f.error?.message || "Audio file processing failed");
      }
      await sleep(2000);
    }

    const final = await params.ai.files.get({ name });
    if (final.state !== "ACTIVE" || !final.uri) {
      throw new Error("Timed out waiting for uploaded audio to become ready");
    }

    const mime = final.mimeType || params.mimeType;
    const userText = [
      TRANSCRIBE_PROMPT,
      "",
      params.segmentHint,
      "",
      `Episode title (context only, do not repeat as a heading): ${params.episodeTitle.slice(0, 500)}`,
    ].join("\n");

    const resp = await params.ai.models.generateContent({
      model: params.modelId,
      contents: [
        {
          role: "user",
          parts: [
            { text: userText },
            { fileData: { fileUri: final.uri, mimeType: mime } },
          ],
        },
      ],
      config: { temperature: 0.15 },
    });

    const text = resp.text?.trim();
    if (!text) throw new Error("Empty transcription from model");
    return text;
  } finally {
    try {
      await params.ai.files.delete({ name });
    } catch {
      /* ignore cleanup errors */
    }
  }
}

export async function transcribePodcastBuffer(params: {
  audioBytes: Buffer;
  audioUrl: string;
  contentTypeHeader: string;
  episodeTitle: string;
}): Promise<string> {
  return transcribePodcastBuffers({
    segments: [params.audioBytes],
    audioUrl: params.audioUrl,
    contentTypeHeader: params.contentTypeHeader,
    episodeTitle: params.episodeTitle,
  });
}

/** Multiple frame-aligned MP3 segments (same episode); transcribed sequentially and concatenated. */
export async function transcribePodcastBuffers(params: {
  segments: Buffer[];
  audioUrl: string;
  contentTypeHeader: string;
  episodeTitle: string;
}): Promise<string> {
  const apiKey = geminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required for podcast audio transcription");
  }

  const mimeType = normalizeAudioMimeType(
    params.audioUrl,
    params.contentTypeHeader,
  );
  const modelId = podcastTranscribeModel();
  const segs = params.segments.filter((b) => b.length > 0);
  if (segs.length === 0) throw new Error("No audio segments to transcribe");

  return withGeminiProxiedFetch(async () => {
    const ai = new GoogleGenAI({ apiKey });
    const parts: string[] = [];
    const n = segs.length;

    for (let i = 0; i < n; i++) {
      const segmentHint =
        n === 1
          ? ""
          : `This is audio segment ${i + 1} of ${n} from the SAME episode. Transcribe ONLY the spoken words in this segment's audio. Do not summarize prior segments; output plain transcript text for this segment only.`;

      const text = await transcribeSingleUploadedAudio({
        ai,
        modelId,
        mimeType,
        audioBytes: segs[i]!,
        episodeTitle: params.episodeTitle,
        displayName: `${params.episodeTitle.slice(0, 80)} · part ${i + 1}/${n}`,
        segmentHint,
      });
      parts.push(text);
      if (i + 1 < n) await sleep(450);
    }

    return parts.join("\n\n");
  });
}

export function mockPodcastTranscript(episodeTitle: string): string {
  const t = episodeTitle.trim() || "this episode";
  return [
    `(Demo — 未配置 GEMINI_API_KEY) 以下为占位稿，非真实转写。`,
    ``,
    `In a real run, the app downloads the episode audio (total size cap + per-chunk cap in env), splits large **MP3** on frame boundaries when needed, sends segment(s) to **Google Gemini**, and shows the English transcript here. You can then use click-to-define and selection lookup like any other text.`,
    ``,
    `Episode: ${t}`,
  ].join("\n");
}

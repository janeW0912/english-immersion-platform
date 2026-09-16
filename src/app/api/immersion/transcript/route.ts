import { YoutubeTranscript } from "youtube-transcript";
import { pickFocusLine, truncate } from "@/lib/immersion-text";

export const runtime = "nodejs";
export const maxDuration = 60;

const ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get("videoId")?.trim() ?? "";

  if (!ID_RE.test(videoId)) {
    return Response.json({ error: "invalid videoId" }, { status: 400 });
  }

  try {
    const chunks = await YoutubeTranscript.fetchTranscript(videoId);
    const text = chunks
      .map((c) => c.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (!text) {
      return Response.json(
        { error: "Empty transcript" },
        { status: 502 },
      );
    }

    return Response.json({
      videoId,
      text,
      preview: truncate(text, 900),
      focusLine: pickFocusLine(text),
      lang: chunks[0]?.lang,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Transcript unavailable";
    return Response.json({ error: message }, { status: 502 });
  }
}

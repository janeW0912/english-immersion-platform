import { TRANSLATE_SYSTEM_PROMPT } from "@/lib/translate-prompt";
import {
  augmentNetworkError,
  completeChat,
  type ChatMessage,
} from "@/lib/run-llm-coach";

export const runtime = "nodejs";

const MAX_LEN = 4500;

export async function POST(req: Request) {
  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = typeof body.text === "string" ? body.text.trim() : "";
  if (!raw) {
    return Response.json({ error: "text required" }, { status: 400 });
  }
  if (raw.length > MAX_LEN) {
    return Response.json(
      { error: `text too long (max ${MAX_LEN})` },
      { status: 400 },
    );
  }

  const messages: ChatMessage[] = [
    {
      role: "user",
      content: `Translate the following into natural Simplified Chinese. Follow system rules exactly.\n\n---\n${raw}\n---`,
    },
  ];

  const mock =
    raw.length > 80
      ? `（Demo 译文 · 未配置 API Key）对「${raw.slice(0, 40)}…」的示例中文占位。`
      : `（Demo 译文）${raw}`;

  try {
    const result = await completeChat(TRANSLATE_SYSTEM_PROMPT, messages, mock);
    return Response.json({
      translation: result.content.trim(),
      mode: result.mode,
      provider: result.provider,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Translate failed";
    return Response.json(
      { error: augmentNetworkError(message) },
      { status: 502 },
    );
  }
}

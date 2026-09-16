import {
  COACH_VARIANTS,
  getSystemPrompt,
  type CoachVariant,
} from "@/lib/coach-prompts";
import {
  augmentNetworkError,
  buildMockForVariant,
  completeChat,
  type ChatMessage,
} from "@/lib/run-llm-coach";

export const runtime = "nodejs";

function isCoachVariant(v: string): v is CoachVariant {
  return (COACH_VARIANTS as readonly string[]).includes(v);
}

const SYSTEM_CONTEXT_MAX = 18_000;

export async function POST(req: Request) {
  let body: {
    variant?: string;
    messages?: ChatMessage[];
    systemContext?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const variant = body.variant;
  if (!variant || !isCoachVariant(variant)) {
    return Response.json({ error: "invalid variant" }, { status: 400 });
  }

  const messages = body.messages?.filter(
    (m): m is ChatMessage =>
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string",
  );
  if (!messages?.length) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  const rawCtx =
    typeof body.systemContext === "string" ? body.systemContext.trim() : "";
  const systemContext =
    rawCtx.length > SYSTEM_CONTEXT_MAX
      ? `${rawCtx.slice(0, SYSTEM_CONTEXT_MAX - 1)}…`
      : rawCtx;

  const basePrompt = getSystemPrompt(variant);
  const systemPrompt =
    systemContext.length > 0
      ? `${basePrompt}\n\n---\nREADING MATERIAL (ground answers in this; do not invent beyond it):\n${systemContext}`
      : basePrompt;
  const mock = buildMockForVariant(variant, messages);

  try {
    const result = await completeChat(systemPrompt, messages, mock);
    return Response.json({
      content: result.content,
      mode: result.mode,
      provider: result.provider,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Model request failed";
    return Response.json(
      { error: augmentNetworkError(message) },
      { status: 502 },
    );
  }
}

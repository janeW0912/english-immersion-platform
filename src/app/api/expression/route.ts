import { EXPRESSION_SYSTEM_PROMPT } from "@/lib/expression-system";
import {
  EXPRESSION_STYLE_PRESETS,
  buildExpressionStyleRequestBlock,
  formatCustomStyleTitle,
  normalizeExpressionStyleIds,
} from "@/lib/expression-styles";
import {
  augmentNetworkError,
  completeChat,
  type ChatMessage,
} from "@/lib/run-llm-coach";

export const runtime = "nodejs";

export type LiveProvider = "gemini" | "openai";

function buildMockReply(
  messages: ChatMessage[],
  presetIds: string[],
  customNote: string,
): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const raw = lastUser?.content?.trim() || "your idea";
  const preview =
    raw.length > 120 ? `${raw.slice(0, 117).trimEnd()}…` : raw;
  const base = preview.toLowerCase().replace(/\.$/, "");
  const custom = customNote.trim();
  const ids = normalizeExpressionStyleIds(presetIds);

  const lines: string[] = [];

  if (ids.length === 0 && !custom) {
    lines.push(
      `**Casual Native**`,
      `> Here's a more natural way to say it: "${preview}" → something like: "Honestly, ${base} — and I think we underestimate how much that shapes everyday life."`,
      ``,
      `**Academic**`,
      `> A clearer formal version: "The proposition that ${base} warrants closer examination in light of contemporary evidence."`,
      ``,
      `**Sophisticated**`,
      `> A tighter, more native rhythm: "If we take that claim seriously, it quietly rearranges how we think about agency, habit, and social structure."`,
      ``,
    );
  } else {
    const presetMap = new Map(
      EXPRESSION_STYLE_PRESETS.map((p) => [p.id, p] as const),
    );
    for (const id of ids) {
      const p = presetMap.get(id);
      if (!p) continue;
      lines.push(
        `**${p.heading}**`,
        `> (Demo) Tight rewrite in that vein: "${preview}" — same idea, tuned toward ${p.hint.slice(0, 60)}…`,
        ``,
      );
    }
    if (custom) {
      const customTitle = formatCustomStyleTitle(custom);
      lines.push(
        `**Custom（${customTitle}）**`,
        `> (Demo) Shaped toward your brief ("${custom.slice(0, 80)}${custom.length > 80 ? "…" : ""}"): "${preview}"`,
        ``,
      );
    }
  }

  lines.push(
    `**中文**`,
    ids.length === 0 && !custom
      ? `上面各档语气不同：口语更顺、学术更稳、高阶更「像人在思考」而不是翻译腔。`
      : `以上按你勾选的风格各给了一版；可与原句对照感受语域差异。`,
    ``,
    `**Follow-up**`,
    `What is one concrete situation — work, school, or online — where you'd actually use one of these versions, and what would change your wording?`,
    ``,
    `_（Demo mode：未配置 GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY，也未配置 OPENAI_API_KEY。）_`,
  );

  return lines.join("\n");
}

export async function POST(req: Request) {
  let body: {
    messages?: ChatMessage[];
    stylePresetIds?: unknown;
    styleCustom?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = body.messages?.filter(
    (m): m is ChatMessage =>
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string",
  );
  if (!messages?.length) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  const presetIds = normalizeExpressionStyleIds(body.stylePresetIds);
  const styleCustom =
    typeof body.styleCustom === "string" ? body.styleCustom : "";
  const styleBlock = buildExpressionStyleRequestBlock(presetIds, styleCustom);
  const systemPrompt = `${EXPRESSION_SYSTEM_PROMPT}\n\n---\n${styleBlock}`;

  try {
    const result = await completeChat(
      systemPrompt,
      messages,
      buildMockReply(messages, presetIds, styleCustom),
    );
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

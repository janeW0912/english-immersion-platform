import OpenAI from "openai";
import { EXPRESSION_SYSTEM_PROMPT } from "@/lib/expression-system";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

function buildMockReply(messages: ChatMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const raw = lastUser?.content?.trim() || "your idea";
  const preview =
    raw.length > 120 ? `${raw.slice(0, 117).trimEnd()}…` : raw;

  return [
    `**Casual Native**`,
    `> Here's a more natural way to say it: "${preview}" → something like: "Honestly, ${preview.toLowerCase().replace(/\.$/, "")} — and I think we underestimate how much that shapes everyday life."`,
    ``,
    `**Academic**`,
    `> A clearer formal version: "The proposition that ${preview.toLowerCase().replace(/\.$/, "")} warrants closer examination in light of contemporary evidence."`,
    ``,
    `**Sophisticated**`,
    `> A tighter, more native rhythm: "If we take that claim seriously, it quietly rearranges how we think about agency, habit, and social structure."`,
    ``,
    `**中文**`,
    `上面三档语气不同：口语更顺、学术更稳、高阶更「像人在思考」而不是翻译腔。`,
    ``,
    `**Follow-up**`,
    `What is one concrete situation — work, school, or online — where you'd actually use the casual version, and what would change your wording?`,
    ``,
    `_（Demo mode：未检测到 OPENAI_API_KEY。在 .env.local 或 Vercel Environment Variables 中配置后，将切换为真实 AI 教练。）_`,
  ].join("\n");
}

export async function POST(req: Request) {
  let body: { messages?: ChatMessage[] };
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    return Response.json({
      content: buildMockReply(messages),
      mode: "mock" as const,
    });
  }

  const openai = new OpenAI({ apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
      messages: [
        { role: "system", content: EXPRESSION_SYSTEM_PROMPT },
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      return Response.json(
        { error: "Empty model response" },
        { status: 502 },
      );
    }

    return Response.json({ content, mode: "live" as const });
  } catch (e) {
    const message = e instanceof Error ? e.message : "OpenAI request failed";
    return Response.json({ error: message }, { status: 502 });
  }
}

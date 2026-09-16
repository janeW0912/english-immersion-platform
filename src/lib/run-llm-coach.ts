import { GoogleGenAI } from "@google/genai";
import type { Content } from "@google/genai";
import OpenAI from "openai";
import type { CoachVariant } from "@/lib/coach-prompts";
import { withGeminiProxiedFetch } from "@/lib/gemini-fetch";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type LiveProvider = "gemini" | "openai";

export function geminiApiKey(): string | undefined {
  const k =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  return k || undefined;
}

export function hasAnyApiKey(): boolean {
  return Boolean(geminiApiKey() || process.env.OPENAI_API_KEY?.trim());
}

/** Gemini free tier / project quota / rate limit — safe to try OpenAI fallback. */
export function isGeminiQuotaOrRateLimitError(e: unknown): boolean {
  const raw = e instanceof Error ? e.message : String(e);
  return (
    /"code"\s*:\s*429|"status"\s*:\s*"RESOURCE_EXHAUSTED"/i.test(raw) ||
    /Quota exceeded|quota exceeded|free_tier_requests|rate.?limit|RESOURCE_EXHAUSTED/i.test(
      raw,
    )
  );
}

/** Short user-facing message when Gemini quota / rate limit is hit. */
export function formatGeminiQuotaHint(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const retry = raw.match(/Please retry in ([\d.]+)s/i);
  const sec = retry ? Math.ceil(parseFloat(retry[1]!)) : undefined;
  const parts = [
    "Gemini 返回配额或限频（常见：免费层每模型约 20 次/日，见 ai.google.dev 配额说明）。",
  ];
  if (sec != null && sec > 0 && sec < 3600) {
    parts.push(`建议约 ${sec} 秒后再试。`);
  }
  parts.push(
    "可：开通计费/换项目、在 .env.local 设置 GEMINI_MODEL 为其他模型，或配置 OPENAI_API_KEY 以自动改用 OpenAI。",
  );
  return parts.join("");
}

async function runGemini(
  systemPrompt: string,
  messages: ChatMessage[],
): Promise<string> {
  const apiKey = geminiApiKey();
  if (!apiKey) throw new Error("Gemini API key missing");

  const modelId =
    process.env.GEMINI_MODEL?.trim() || "gemini-3-flash-preview";

  return withGeminiProxiedFetch(async () => {
    const ai = new GoogleGenAI({ apiKey });

    const last = messages[messages.length - 1];
    if (!last || last.role !== "user") {
      throw new Error("Last message must be from user");
    }

    const prior = messages.slice(0, -1);
    const history: Content[] | undefined =
      prior.length > 0
        ? prior.map((m) => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.content }],
          }))
        : undefined;

    const chat = ai.chats.create({
      model: modelId,
      history,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      },
    });

    const response = await chat.sendMessage({ message: last.content });
    const text = response.text?.trim();
    if (!text) throw new Error("Empty Gemini response");
    return text;
  });
}

async function runOpenAI(
  systemPrompt: string,
  messages: ChatMessage[],
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OpenAI API key missing");

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ],
    temperature: 0.7,
  });

  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty OpenAI response");
  return content;
}

export async function completeChat(
  systemPrompt: string,
  messages: ChatMessage[],
  mockContent: string,
): Promise<{
  content: string;
  mode: "mock" | "live";
  provider?: LiveProvider;
}> {
  if (!hasAnyApiKey()) {
    return { content: mockContent, mode: "mock" };
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim();

  if (geminiApiKey()) {
    try {
      const content = await runGemini(systemPrompt, messages);
      return { content, mode: "live", provider: "gemini" };
    } catch (e) {
      if (isGeminiQuotaOrRateLimitError(e)) {
        if (openAiKey) {
          try {
            const content = await runOpenAI(systemPrompt, messages);
            return { content, mode: "live", provider: "openai" };
          } catch (openErr) {
            const hint = formatGeminiQuotaHint(e);
            const openMsg =
              openErr instanceof Error ? openErr.message : String(openErr);
            throw new Error(
              `${hint} 已尝试 OpenAI 备用：${openMsg.slice(0, 400)}`,
            );
          }
        }
        throw new Error(formatGeminiQuotaHint(e));
      }
      throw e;
    }
  }

  const content = await runOpenAI(systemPrompt, messages);
  return { content, mode: "live", provider: "openai" };
}

function snippet(messages: ChatMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  const raw = last?.content?.trim() || "your text";
  return raw.length > 80 ? `${raw.slice(0, 77)}…` : raw;
}

/** Demo output when no API keys (per module tone). */
export function buildMockForVariant(
  variant: CoachVariant,
  messages: ChatMessage[],
): string {
  const s = snippet(messages);
  switch (variant) {
    case "immersion-structure-1":
      return [
        `### 骨架与脉络 (Outline)`,
        `- **电梯陈述**：基于可见片段，文章在争什么 / 讲什么线（Demo）。`,
        `- 背景铺垫 → 核心信息 → 收束`,
        ``,
        `_（Demo：未配置 API Key；材料片段：「${s.slice(0, 48)}…」）_`,
      ].join("\n");
    case "immersion-structure-2":
      return [
        `### 论证结构 (Argument)`,
        `- **Core claim**：从摘录推断的主线（Demo）。`,
        `- **Evidence types**：事实 / 引述 等`,
        `- **Gaps**：材料较短时推断成分更大`,
        ``,
        `_（Demo：未配置 API Key。）_`,
      ].join("\n");
    case "immersion-structure-3":
      return [
        `### 类型与阅读信号 (Genre & epistemics)`,
        `- **Genre**：观点稿 / 报道 之一（示例）`,
        `- **阅读信号**：证据密度、情绪化措辞 — 如何带着问题读`,
        ``,
        `_（Demo：未配置 API Key。）_`,
      ].join("\n");
    case "immersion-structure-4":
      return [
        `### 叙事与节奏 (Narrative / flow)`,
        `- **Opening hook**：开场如何抓住注意力（Demo）。`,
        `- **Turn / pivot**：中段转折或换线位置`,
        `- **Climax or landing**：高潮或收束落点`,
        ``,
        `_（Demo：未配置 API Key；播客稿 / 叙事文尤适用。）_`,
      ].join("\n");
    case "immersion-structure-5":
      return [
        `### 语域与受众 (Register + audience)`,
        `- **Formality**：口语播客 / 书面评论 等（示例）`,
        `- **In-group signals**：缩写、梗、默认你知道的背景`,
        `- **Implied audience**：大致写给谁听`,
        ``,
        `_（Demo：未配置 API Key；通篇语域，非逐句「很口语」。）_`,
      ].join("\n");
    case "immersion-structure-6":
      return [
        `### 术语与主题簇 (Theme glossary)`,
        `- **Cluster A** — 本篇里承担：铺垫议题（示例）`,
        `- **Cluster B** — 本篇里承担：证据 backbone`,
        ``,
        `_（Demo：未配置 API Key；义项是「篇内功能」非词典。）_`,
      ].join("\n");
    case "immersion-structure-7":
      return [
        `### 行动项 / 读后自检 (So what)`,
        `#### 若目的是学语言`,
        `- 再读关注：转折标记、数据句怎么嵌进论证…`,
        `#### 若目的是获取信息`,
        `- 读完自检 3 问：（Demo）① … ② … ③ …`,
        ``,
        `_（Demo：未配置 API Key。）_`,
      ].join("\n");
    case "immersion-reader-chat":
      return [
        `就你贴的材料来看，**主线**可以概括成…（Demo）`,
        ``,
        `若问的是某个词：建议先划选该词用左侧查词。配置 API Key 后我会结合全文细答。`,
        ``,
        `_（Demo；你的问题：「${s.slice(0, 40)}…」）_`,
      ].join("\n");
    case "speaking-conversation":
      return [
        `That's an interesting angle — I'm curious what led you there. If someone pointed to evidence on the other side, how would you weigh it against what you've said so far?`,
        ``,
        `_（Demo：未配置 API Key。）_`,
      ].join("\n");
    case "speaking-debate":
      return [
        `No — "${s.slice(0, 44)}…" smuggles in an unstated premise. Name one mechanism, one number, one study. Where exactly does the chain hold?`,
        ``,
        `_（Demo：未配置 API Key — 站反方直球质询。）_`,
      ].join("\n");
    case "speaking-shadowing":
      return [
        `**Match vs drift**`,
        `- You mostly tracked the opening; one content word likely drifted (ASR or slip) — re-say that noun phrase slowly.`,
        ``,
        `**Chunking**`,
        `- Try: *for the record* / *I don't buy it yet* / *unless you show…*`,
        ``,
        `**Stress**`,
        `- Hit **buy**, **yet**, **evidence** a little harder in that line.`,
        ``,
        `_（Demo：未配置 API Key — 跟读；参考稿在 system context。）_`,
      ].join("\n");
    case "native-brain":
      return [
        `**What's off (spoken)**`,
        `Written-English phrasing that would feel stiff if read aloud; or a calque from another language.`,
        ``,
        `**Say it this way**`,
        `> (Demo) Same idea, tighter chunks and a more natural spoken rhythm — try it out loud.`,
        ``,
        `**Micro-tip**`,
        `Contract where you would in real chat; don't pack every subclause into one breath.`,
        ``,
        `_（Demo：未配置 API Key — 口语转写优化。）_`,
      ].join("\n");
    case "writing-draft-weave":
      return [
        `### Weaved draft`,
        `> (Demo) A tighter version of your ideas would read more clearly if…`,
        ``,
        `### What changed`,
        `- Grouped related points into one thread （把散点收成一条主线）`,
        `- Smoothed connectors between ideas （理顺句间衔接）`,
        `- Swapped stiff wording for a more natural rhythm （换掉生硬措辞、更顺耳）`,
        ``,
        `_（Demo：未配置 API Key — DraftWeave / 织稿。）_`,
      ].join("\n");
    case "writing-prompt-spin":
      return [
        `{"title_zh":"若法律突然无法被书面记录，社会靠什么运转？","title_en":"If laws could no longer be written down, what would society lean on instead — habit, shame, or force?"}`,
        ``,
        `_（Demo：未配置 API Key — 在线换题 JSON 示例。）_`,
      ].join("\n");
    case "writing-think-trail":
      return [
        `### Questions`,
        `1. What would falsify your main claim? （什么证据能推翻它？）`,
        `2. Who loses if you're right — and do you owe them a paragraph? （若你对了谁吃亏——要不要给人家一段话？）`,
        ``,
        `### New angles`,
        `- Compare to a concrete case users already know`,
        ``,
        `### Logic check`,
        `The draft hints at X but doesn't pin down Y yet. （草稿点到为止，关键断言还未钉死。）`,
        ``,
        `### Optional next outline`,
        `- Hook — open with stakes （开头抓注意力与利害关系）`,
        `- Evidence — one concrete case （一处具体例证）`,
        `- Counter — address the obvious objection （回应反方或常见质疑）`,
        ``,
        `_（Demo：未配置 API Key — ThinkTrail / 思径。）_`,
      ].join("\n");
    default:
      return "_（Demo）_";
  }
}

export function augmentNetworkError(message: string): string {
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(message)) {
    return `${message} · 若在国内本机开发：在 .env.local 设置 GEMINI_HTTP_PROXY=http://127.0.0.1:7890，或部署到 Vercel。`;
  }
  return message;
}

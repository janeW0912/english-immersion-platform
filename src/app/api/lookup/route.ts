import { TRANSLATE_SYSTEM_PROMPT } from "@/lib/translate-prompt";
import { PHRASE_LOOKUP_SYSTEM_PROMPT } from "@/lib/phrase-lookup-prompt";
import {
  augmentNetworkError,
  completeChat,
  type ChatMessage,
} from "@/lib/run-llm-coach";
import {
  parseFreeDictionaryResponse,
  type DictionaryEntry,
} from "@/lib/free-dictionary";
import { fetchTextOutbound } from "@/lib/outbound-fetch";

export const runtime = "nodejs";

const MAX_LOOKUP_LEN = 4500;

function isSingleDictionaryWord(s: string): boolean {
  const t = s.trim();
  if (t.length < 2 || t.length > 48) return false;
  if (/\s/.test(t)) return false;
  return /^[a-zA-Z][a-zA-Z'-]*[a-zA-Z']?$/.test(t);
}

async function fetchFreeDictionary(word: string): Promise<DictionaryEntry | null> {
  const w = word.trim().toLowerCase();
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`;
  try {
    const jsonText = await fetchTextOutbound(url, {
      timeoutMs: 22000,
      headers: { Accept: "application/json" },
    });
    let json: unknown;
    try {
      json = JSON.parse(jsonText) as unknown;
    } catch {
      return null;
    }
    return parseFreeDictionaryResponse(json, w);
  } catch {
    return null;
  }
}

function mockPhraseMarkdown(text: string): string {
  return [
    `## 中文释义`,
    `（Demo：请配置 GEMINI_API_KEY 以获取完整短语讲解）`,
    ``,
    `## 整句翻译`,
    `对「${text.slice(0, 200)}${text.length > 200 ? "…" : ""}」的占位说明。`,
  ].join("\n");
}

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
  if (raw.length > MAX_LOOKUP_LEN) {
    return Response.json(
      { error: `text too long (max ${MAX_LOOKUP_LEN})` },
      { status: 400 },
    );
  }

  try {
    if (isSingleDictionaryWord(raw)) {
      const [entry, zhResult] = await Promise.all([
        fetchFreeDictionary(raw),
        completeChat(
          TRANSLATE_SYSTEM_PROMPT,
          [
            {
              role: "user",
              content: `Translate this English headword into one short line of core Chinese gloss for a dictionary popup:\n${raw}`,
            } satisfies ChatMessage,
          ],
          raw.length > 20 ? `${raw.slice(0, 18)}…（Demo 中文义项）` : `${raw}（Demo）`,
        ),
      ]);

      return Response.json({
        kind: "word" as const,
        text: raw,
        entry,
        chineseGloss: zhResult.content.trim(),
        llmMode: zhResult.mode,
        dictionaryFound: Boolean(entry),
      });
    }

    const phraseMessages: ChatMessage[] = [
      {
        role: "user",
        content: `User selected this English phrase or sentence:\n\n---\n${raw}\n---`,
      },
    ];

    const phraseResult = await completeChat(
      PHRASE_LOOKUP_SYSTEM_PROMPT,
      phraseMessages,
      mockPhraseMarkdown(raw),
    );

    return Response.json({
      kind: "phrase" as const,
      text: raw,
      markdown: phraseResult.content.trim(),
      llmMode: phraseResult.mode,
      provider: phraseResult.provider,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "lookup failed";
    return Response.json(
      { error: augmentNetworkError(message) },
      { status: 502 },
    );
  }
}

import type { CoachVariant } from "@/lib/coach-prompts";

export type CoachApiMessage = { role: "user" | "assistant"; content: string };

export type CoachRequestOptions = {
  /** Appended to system prompt (e.g. reading material for immersion chat). Server truncates. */
  systemContext?: string;
};

export async function requestCoach(
  variant: CoachVariant,
  messages: CoachApiMessage[],
  options?: CoachRequestOptions,
): Promise<{
  content: string;
  mode: "mock" | "live";
  provider?: "gemini" | "openai";
}> {
  const res = await fetch("/api/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      variant,
      messages,
      ...(options?.systemContext?.trim()
        ? { systemContext: options.systemContext.trim() }
        : {}),
    }),
  });
  const data = (await res.json()) as {
    content?: string;
    error?: string;
    mode?: "mock" | "live";
    provider?: "gemini" | "openai";
  };
  if (!res.ok) {
    throw new Error(data.error || "Coach request failed");
  }
  if (!data.content) {
    throw new Error("Empty response");
  }
  return {
    content: data.content,
    mode: data.mode ?? "live",
    provider: data.provider,
  };
}

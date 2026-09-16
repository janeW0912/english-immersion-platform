import { ProxyAgent, fetch as undiciFetch } from "undici";

/** 与 README / .env.example 中的 GEMINI_HTTP_PROXY 一致；也认 HTTPS_PROXY、HTTP_PROXY。 */
export function getGeminiProxyUrl(): string | undefined {
  return (
    process.env.GEMINI_HTTP_PROXY?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim() ||
    undefined
  );
}

/**
 * SDK 内部用全局 fetch；国内直连 Google 常失败。
 * 在已配置代理 URL 时，仅在本次调用期间把 globalThis.fetch 换成走 ProxyAgent 的实现。
 */
export async function withGeminiProxiedFetch<T>(
  fn: () => Promise<T>,
): Promise<T> {
  const proxy = getGeminiProxyUrl();
  if (!proxy) {
    return fn();
  }

  const dispatcher = new ProxyAgent(proxy);
  const previous = globalThis.fetch;

  globalThis.fetch = ((
    input: RequestInfo | URL,
    init?: RequestInit,
  ) =>
    undiciFetch(input as never, {
      ...(init ?? {}),
      dispatcher,
    } as never)) as unknown as typeof fetch;

  try {
    return await fn();
  } finally {
    globalThis.fetch = previous;
  }
}

/** MIME for Gemini upload from URL + Content-Type header. */
export function normalizeAudioMimeType(
  url: string,
  headerContentType: string,
): string {
  const h = headerContentType.split(";")[0].trim().toLowerCase();
  if (h.startsWith("audio/")) return h;
  const u = url.toLowerCase();
  if (/\.m4a(\?|#|$)/.test(u)) return "audio/mp4";
  if (/\.aac(\?|#|$)/.test(u)) return "audio/aac";
  if (/\.opus(\?|#|$)/.test(u)) return "audio/opus";
  if (/\.wav(\?|#|$)/.test(u)) return "audio/wav";
  if (/\.ogg(\?|#|$)/.test(u)) return "audio/ogg";
  if (/\.flac(\?|#|$)/.test(u)) return "audio/flac";
  return "audio/mpeg";
}

const YT =
  /(?:youtube\.com\/(?:watch\?(?:[^&]*&)*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export function extractYoutubeVideoId(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(YT);
  return m?.[1] ?? null;
}

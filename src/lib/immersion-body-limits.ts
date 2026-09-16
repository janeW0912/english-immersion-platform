/** Max plain-text length stored per RSS card (large articles). */
export function immersionRssBodyMaxChars(): number {
  const n = Number(process.env.IMMERSION_RSS_BODY_MAX_CHARS);
  if (Number.isFinite(n) && n >= 5000) return Math.min(n, 2_000_000);
  return 500_000;
}

/**
 * Max bytes per **segment** sent to Gemini (one upload). Larger episodes use MP3
 * frame-aligned splitting when possible.
 */
export function immersionPodcastChunkMaxBytes(): number {
  const n = Number(process.env.IMMERSION_PODCAST_AUDIO_MAX_BYTES);
  if (Number.isFinite(n) && n >= 1_000_000) return Math.min(n, 64_000_000);
  return 32_000_000;
}

/** @deprecated alias — same as immersionPodcastChunkMaxBytes */
export function immersionPodcastAudioMaxBytes(): number {
  return immersionPodcastChunkMaxBytes();
}

/** Max bytes downloaded for one episode (full file). MP3 may then be split into chunks. */
export function immersionPodcastAudioMaxTotalBytes(): number {
  const n = Number(process.env.IMMERSION_PODCAST_AUDIO_MAX_TOTAL_BYTES);
  if (Number.isFinite(n) && n >= 5_000_000) return Math.min(n, 256_000_000);
  return 128_000_000;
}

export function immersionPodcastAudioTimeoutMs(): number {
  const n = Number(process.env.IMMERSION_PODCAST_AUDIO_TIMEOUT_MS);
  if (Number.isFinite(n) && n >= 15000) return Math.min(n, 300000);
  return 120000;
}

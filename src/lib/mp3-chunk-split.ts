/** Split MPEG-1/2 Layer III stream on frame boundaries for per-chunk transcription. */

const BITRATE_MPEG1_L3 = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
] as const;
const BITRATE_MPEG2_L3 = [
  0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0,
] as const;

/** Skip ID3v2 tag; returns byte offset of first byte after tag (or 0). */
export function skipId3v2Prefix(buf: Buffer): number {
  if (buf.length < 10) return 0;
  if (buf.toString("ascii", 0, 3) !== "ID3") return 0;
  const size =
    ((buf[6]! & 0x7f) << 21) |
    ((buf[7]! & 0x7f) << 14) |
    ((buf[8]! & 0x7f) << 7) |
    (buf[9]! & 0x7f);
  return Math.min(10 + size, buf.length);
}

function sampleRateHz(versionBits: number, srIndex: number): number {
  if (srIndex >= 3) return 0;
  if (versionBits === 3) return [44100, 48000, 32000][srIndex]!;
  if (versionBits === 2) return [22050, 24000, 16000][srIndex]!;
  if (versionBits === 0) return [11025, 12000, 8000][srIndex]!;
  return 0;
}

/** Returns MPEG Layer III frame length in bytes, or 0 if header invalid at `off`. */
export function mp3FrameLengthAt(buf: Buffer, off: number): number {
  if (off + 4 > buf.length) return 0;
  const b0 = buf[off]!;
  const b1 = buf[off + 1]!;
  const b2 = buf[off + 2]!;
  if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) return 0;

  const versionBits = (b1 >> 3) & 0x03;
  const layerBits = (b1 >> 1) & 0x03;
  const bitrateIndex = (b2 >> 4) & 0x0f;
  const srIndex = (b2 >> 2) & 0x03;
  const padding = (b2 >> 1) & 0x01;

  if (layerBits !== 1) return 0;
  if (bitrateIndex === 0 || bitrateIndex === 15) return 0;

  let bitrateKbps = 0;
  if (versionBits === 3) bitrateKbps = BITRATE_MPEG1_L3[bitrateIndex]!;
  else if (versionBits === 2 || versionBits === 0)
    bitrateKbps = BITRATE_MPEG2_L3[bitrateIndex]!;
  else return 0;

  if (!bitrateKbps) return 0;

  const sampleRate = sampleRateHz(versionBits, srIndex);
  if (!sampleRate) return 0;

  const bitrate = bitrateKbps * 1000;
  const len =
    versionBits === 3
      ? Math.floor((144 * bitrate) / sampleRate) + padding
      : Math.floor((72 * bitrate) / sampleRate) + padding;

  if (len < 4 || off + len > buf.length) return 0;
  return len;
}

function findNextFrame(buf: Buffer, start: number, maxScan: number): number {
  const end = Math.min(buf.length - 4, start + maxScan);
  for (let i = start; i <= end; i++) {
    if (buf[i] === 0xff && (buf[i + 1]! & 0xe0) === 0xe0) {
      const fl = mp3FrameLengthAt(buf, i);
      if (fl >= 4) return i;
    }
  }
  return -1;
}

/**
 * Split buffer into frame-aligned chunks each ≤ maxChunkBytes (last may be smaller).
 * Returns [] if no sync could be established (not treated as MP3).
 */
export function splitMp3IntoFrameAlignedChunks(
  buf: Buffer,
  maxChunkBytes: number,
): Buffer[] {
  if (maxChunkBytes < 64 * 1024) return [];

  let off = skipId3v2Prefix(buf);
  const first = findNextFrame(buf, off, 256 * 1024);
  if (first < 0) return [];
  off = first;

  const chunks: Buffer[] = [];
  let chunkStart = off;
  let chunkLen = 0;

  while (off < buf.length) {
    const flen = mp3FrameLengthAt(buf, off);
    if (flen <= 0) {
      const next = findNextFrame(buf, off + 1, 4096);
      if (next < 0) break;
      off = next;
      continue;
    }

    if (chunkLen + flen > maxChunkBytes && chunkLen >= 64 * 1024) {
      chunks.push(buf.subarray(chunkStart, chunkStart + chunkLen));
      chunkStart = off;
      chunkLen = 0;
    }

    chunkLen += flen;
    off += flen;
  }

  if (chunkLen > 0) {
    chunks.push(buf.subarray(chunkStart, chunkStart + chunkLen));
  }

  return chunks;
}

export function isLikelySplittableMp3(url: string, mime: string): boolean {
  const m = mime.toLowerCase();
  if (m === "audio/mpeg" || m === "audio/mp3") return true;
  return /\.mp3(\?|#|$)/i.test(url);
}

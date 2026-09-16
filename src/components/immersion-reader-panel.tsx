"use client";

import type { ImmersionCard } from "@/lib/immersion-items";
import { SelectableTranslatedText } from "@/components/selectable-translated-text";

type TranscriptPayload = {
  text: string;
  focusLine: string;
  preview: string;
};

export function ImmersionReaderPanel({
  item,
  enriched,
  expandedBody,
  feedLive,
  txLoading,
  txError,
  articleLoading,
  articleError,
  onLoadTranscript,
  onLoadPodcastTranscribe,
}: {
  item: ImmersionCard | undefined;
  enriched: TranscriptPayload | undefined;
  /** 从原网页抓取的更长正文 */
  expandedBody?: string;
  feedLive: boolean;
  txLoading: boolean;
  txError: string | null;
  articleLoading: boolean;
  articleError: string | null;
  onLoadTranscript: () => void;
  onLoadPodcastTranscribe: () => void;
}) {
  if (!item) {
    return (
      <div className="flex min-h-[200px] flex-1 items-center justify-center border-zinc-800 p-6 text-sm text-zinc-500 lg:border-x">
        请选择…
      </div>
    );
  }

  const readerText =
    enriched?.text ??
    expandedBody ??
    (item.audioUrl && !item.videoId
      ? ""
      : item.url && !item.videoId
        ? ""
        : item.body ?? item.excerpt ?? "");
  const awaitingArticleBody =
    Boolean(item.url && !item.videoId && !item.audioUrl) &&
    !expandedBody?.trim() &&
    !enriched?.text;
  const awaitingPodcastTranscript =
    Boolean(item.audioUrl && !item.videoId) &&
    !enriched?.text &&
    txLoading;
  const podcastNeedsRetry =
    Boolean(item.audioUrl && !item.videoId && !enriched?.text && txError);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col border-zinc-800 lg:border-x">
      <div className="shrink-0 border-b border-zinc-800 px-4 py-3 md:px-5">
        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
          <span>{item.tag}</span>
          <span>·</span>
          <span>{item.source}</span>
          {feedLive && <span className="text-zinc-600">· live</span>}
        </div>
        <h2 className="mt-2 text-base font-semibold leading-snug text-zinc-100 md:text-lg">
          {item.title}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {item.userUpload && (
            <span className="rounded-lg bg-violet-950/50 px-2 py-1 text-xs text-violet-200 ring-1 ring-violet-800/50">
              本地上传
              {item.uploadTag && item.uploadTag !== "未分类"
                ? ` · ${item.uploadTag}`
                : ""}
            </span>
          )}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-500/90 hover:underline"
            >
              原站打开 ↗
            </a>
          )}
          {item.audioUrl && (
            <a
              href={item.audioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-400 hover:text-zinc-300 hover:underline"
            >
              音频直链 ↗
            </a>
          )}
          {awaitingArticleBody && articleLoading && (
            <span className="rounded-lg bg-emerald-950/40 px-2 py-1 text-xs text-emerald-300/95 ring-1 ring-emerald-900/40">
              正在拉取正文…
            </span>
          )}
          {awaitingPodcastTranscript && (
            <span className="rounded-lg bg-violet-950/50 px-2 py-1 text-xs text-violet-200/95 ring-1 ring-violet-900/40">
              正在转写播客音频（Gemini）…
            </span>
          )}
          {podcastNeedsRetry && (
            <button
              type="button"
              onClick={onLoadPodcastTranscribe}
              disabled={txLoading}
              className="rounded-lg bg-violet-900/50 px-2 py-1 text-xs text-violet-100 ring-1 ring-violet-800/60 hover:bg-violet-800/50 disabled:opacity-50"
            >
              重试转写
            </button>
          )}
          {item.videoId && (
            <button
              type="button"
              onClick={onLoadTranscript}
              disabled={txLoading || Boolean(enriched)}
              className="rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
            >
              {enriched
                ? "已加载字幕"
                : txLoading
                  ? "字幕加载中…"
                  : "加载 YouTube 字幕"}
            </button>
          )}
        </div>
        {txError && (
          <p className="mt-2 text-xs text-red-400">{txError}</p>
        )}
        {articleError && (
          <p className="mt-2 text-xs text-red-400">{articleError}</p>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
          <span className="text-zinc-500">单击单词</span>
          ：Free Dictionary 义项 + 英文例句 + 发音 + 中文义项；{" "}
          <span className="text-zinc-500">划选短语/句</span>
          ：结构化详解（释义、用法、例句、翻译）。本地上传的 Word（docx）/ PDF 解析后与订阅正文相同交互。文章选中后自动拉网页正文；带音频 enclosure 的播客条目自动转写为英文稿（与教练共用{" "}
          <code className="rounded bg-zinc-900 px-0.5 text-[10px]">GEMINI_API_KEY</code>
          ，无 Key 时返回 Demo 占位稿）。下载上限默认约 128MB（
          <code className="rounded bg-zinc-900 px-0.5 text-[10px]">
            IMMERSION_PODCAST_AUDIO_MAX_TOTAL_BYTES
          </code>
          ）；超过单段上限的标准 MP3 会按帧切块多次转写拼接；其它格式需调高{" "}
          <code className="rounded bg-zinc-900 px-0.5 text-[10px]">
            IMMERSION_PODCAST_AUDIO_MAX_BYTES
          </code>{" "}
          （单段上限，默认约 32MB）。
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">
        <SelectableTranslatedText
          text={readerText}
          emptyHint={
            awaitingPodcastTranscript
              ? "正在下载并转写播客音频为英文稿，首次可能需一两分钟…"
              : awaitingArticleBody && articleLoading
                ? "正在从原网页拉取正文，请稍候…"
                : undefined
          }
        />
      </div>
    </div>
  );
}

"use client";

import { useRef, type ChangeEvent } from "react";
import type { ImmersionCard } from "@/lib/immersion-items";
import { cn } from "@/lib/utils";

export function ImmersionSourceSidebar({
  loading,
  groups,
  selectedId,
  onSelect,
  specificDay,
  onSpecificDayChange,
  topicFilter,
  onTopicFilterChange,
  topicOptions,
  fetchedAt,
  onRefresh,
  rssRefreshing,
  uploadBusy,
  uploadError,
  uploadTagInput,
  onUploadTagInputChange,
  onUploadFileChange,
}: {
  loading: boolean;
  groups: { source: string; items: ImmersionCard[] }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** `YYYY-MM-DD` 或 null 表示不按发布日筛选 */
  specificDay: string | null;
  onSpecificDayChange: (v: string | null) => void;
  topicFilter: string;
  onTopicFilterChange: (v: string) => void;
  topicOptions: string[];
  fetchedAt: string | null;
  onRefresh: () => void;
  rssRefreshing: boolean;
  uploadBusy: boolean;
  uploadError: string | null;
  uploadTagInput: string;
  onUploadTagInputChange: (v: string) => void;
  onUploadFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchedLabel = fetchedAt
    ? new Date(fetchedAt).toLocaleString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="flex min-h-0 w-full max-w-full shrink-0 flex-col space-y-3 overflow-y-auto border-zinc-800 p-4 lg:max-w-[min(100%,360px)] lg:border-r lg:p-4">
      <input
        ref={fileRef}
        type="file"
        accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={onUploadFileChange}
      />
      <div className="shrink-0 space-y-2 rounded-2xl border border-violet-900/40 bg-violet-950/15 p-3 ring-1 ring-violet-900/30">
        <p className="text-[10px] font-medium uppercase tracking-wider text-violet-300/90">
          本地上传
        </p>
        <p className="text-[10px] leading-snug text-zinc-500">
          Word（<strong className="text-zinc-400">.docx</strong>）或{" "}
          <strong className="text-zinc-400">PDF</strong>
          ，服务端解析为纯文本；可填标签，成功后出现在下方「我的上传 ·
          标签名」分组，并进入类别筛选。阅读方式与订阅文章相同（点词 / 划选）。
        </p>
        <label className="block text-[10px] text-zinc-500">
          分类标签
          <input
            type="text"
            value={uploadTagInput}
            onChange={(e) => onUploadTagInputChange(e.target.value)}
            maxLength={40}
            disabled={uploadBusy || loading}
            placeholder="选填，如：工作、外刊、教材… 留空为未分类"
            className="mt-1 w-full rounded-lg border border-violet-900/50 bg-zinc-950/50 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 disabled:opacity-50"
          />
        </label>
        <button
          type="button"
          disabled={uploadBusy || loading}
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-lg bg-violet-700/80 py-2 text-xs font-medium text-white hover:bg-violet-600 disabled:opacity-50"
        >
          {uploadBusy ? "解析中…" : "选择文件上传"}
        </button>
        {uploadError && (
          <p className="text-[10px] leading-snug text-red-400">{uploadError}</p>
        )}
      </div>

      <div className="shrink-0 space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            筛选
          </p>
          <button
            type="button"
            onClick={onRefresh}
            disabled={rssRefreshing || loading}
            className="rounded-lg border border-zinc-600 px-2 py-1 text-[10px] text-zinc-300 hover:border-emerald-600/50 hover:bg-zinc-800 disabled:opacity-50"
          >
            {rssRefreshing ? "更新中…" : "刷新订阅"}
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-zinc-500">
              发布日期（选具体一天）
              <input
                type="date"
                value={specificDay ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  onSpecificDayChange(v === "" ? null : v);
                }}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950/60 px-2 py-1.5 text-xs text-zinc-200 [color-scheme:dark]"
              />
            </label>
            {specificDay && (
              <button
                type="button"
                onClick={() => onSpecificDayChange(null)}
                className="mt-1.5 text-[10px] text-emerald-500/90 hover:underline"
              >
                清除日期 · 显示全部日期
              </button>
            )}
            <p className="mt-1 text-[9px] leading-snug text-zinc-600">
              留空=不按日筛选。选某日则匹配 RSS 发布日或上传当日（本地时间）；无日期的条目会被隐藏。
            </p>
          </div>
          <label className="block text-[10px] text-zinc-500">
            类别
            <select
              value={topicFilter}
              onChange={(e) => onTopicFilterChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950/60 px-2 py-1.5 text-xs text-zinc-200"
            >
              <option value="全部">全部类别</option>
              {topicOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        {fetchedLabel && (
          <p className="text-[10px] text-zinc-600">
            列表更新时间 · {fetchedLabel}
            <span className="text-zinc-500">
              （打开页面会拉取最新；后台约每 24 小时自动再拉一次）
            </span>
          </p>
        )}
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((k) => (
            <div
              key={k}
              className="h-28 rounded-2xl border border-zinc-800 bg-zinc-900/40"
            />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-800 px-3 py-6 text-center text-xs text-zinc-500">
          当前筛选下没有条目，请调整日期或类别。
        </p>
      ) : (
        <div className="min-h-0 flex-1 space-y-2">
          {groups.map(({ source, items: rows }) => (
            <details
              key={source}
              className="group rounded-2xl border border-zinc-800 bg-zinc-900/30 open:bg-zinc-900/45"
              open
            >
              <summary className="cursor-pointer list-none px-3 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold leading-snug text-zinc-200">
                    {source}
                  </span>
                  <span className="shrink-0 rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                    {rows.length}
                  </span>
                </div>
              </summary>
              <div className="border-t border-zinc-800/80 px-2 pb-2 pt-1">
                <ul className="max-h-[min(40vh,18rem)] space-y-1 overflow-y-auto pr-0.5">
                  {rows.map((row) => {
                    const day =
                      row.publishedAt != null
                        ? new Date(row.publishedAt).toLocaleDateString("zh-CN", {
                            month: "numeric",
                            day: "numeric",
                          })
                        : null;
                    return (
                      <li key={row.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(row.id)}
                          className={cn(
                            "w-full rounded-xl border px-2.5 py-2 text-left transition-colors",
                            selectedId === row.id
                              ? "border-emerald-800/60 bg-emerald-950/25 ring-1 ring-emerald-900/40"
                              : "border-transparent hover:border-zinc-700 hover:bg-zinc-800/40",
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-1.5 text-[9px] uppercase tracking-wider text-zinc-500">
                            <span>{row.tag}</span>
                            {day && (
                              <>
                                <span className="text-zinc-600">·</span>
                                <span className="normal-case text-zinc-500">
                                  {day}
                                </span>
                              </>
                            )}
                          </div>
                          <p className="mt-0.5 line-clamp-3 text-left text-[11px] font-medium leading-snug text-zinc-100">
                            {row.title}
                          </p>
                          {row.topics && row.topics.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {row.topics.slice(0, 3).map((t) => (
                                <span
                                  key={t}
                                  className="rounded bg-zinc-800/90 px-1 py-0.5 text-[9px] text-zinc-400"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </details>
          ))}
        </div>
      )}
      <p className="text-[10px] leading-snug text-zinc-600">
        环境变量{" "}
        <code className="rounded bg-zinc-900 px-1 text-[9px]">IMMERSION_RSS_URLS</code>{" "}
        可换订阅源。类别由 RSS 标签与标题/摘要关键词自动推断。
      </p>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { CoachMarkdown } from "@/components/coach-markdown";
import type { DictionaryEntry } from "@/lib/free-dictionary";

type WordLookupResult = {
  kind: "word";
  text: string;
  entry: DictionaryEntry | null;
  chineseGloss: string;
  dictionaryFound: boolean;
};

type PhraseLookupResult = {
  kind: "phrase";
  text: string;
  markdown: string;
};

type LookupPopover = {
  x: number;
  y: number;
  text: string;
  loading: boolean;
  error: string | null;
  data: WordLookupResult | PhraseLookupResult | null;
};

function segmentEnglish(text: string): { segment: string; isWord: boolean }[] {
  const out: { segment: string; isWord: boolean }[] = [];
  const re = /[\w']+|[^\w']+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const s = m[0];
    out.push({
      segment: s,
      isWord: /^[\w']+$/.test(s) && /[a-zA-Z]/.test(s),
    });
  }
  return out;
}

async function postLookup(text: string): Promise<WordLookupResult | PhraseLookupResult> {
  const res = await fetch("/api/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = (await res.json()) as
    | (WordLookupResult & { error?: string })
    | (PhraseLookupResult & { error?: string })
    | { error: string };
  if (!res.ok || "error" in data) {
    throw new Error(
      "error" in data && typeof data.error === "string"
        ? data.error
        : "Lookup failed",
    );
  }
  if (data.kind === "word") {
    return data as WordLookupResult;
  }
  return data as PhraseLookupResult;
}

function DictionaryBody({ entry }: { entry: DictionaryEntry }) {
  return (
    <div className="space-y-3 text-sm text-zinc-300">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-lg font-semibold capitalize text-zinc-100">
          {entry.word}
        </span>
        {entry.phonetic && (
          <span className="font-mono text-xs text-zinc-500">{entry.phonetic}</span>
        )}
      </div>
      {entry.audioUrl && (
        <audio controls className="h-8 w-full max-w-xs" src={entry.audioUrl} />
      )}
      {entry.meanings.map((m, mi) => (
        <div key={mi} className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/90">
            {m.partOfSpeech}
          </p>
          <ul className="mt-2 list-decimal space-y-2 pl-4 text-xs leading-relaxed marker:text-zinc-600">
            {m.definitions.slice(0, 6).map((d, di) => (
              <li key={di} className="pl-1">
                <span className="text-zinc-200">{d.definition}</span>
                {d.example && (
                  <p className="mt-1 border-l-2 border-zinc-700 pl-2 text-[11px] italic text-zinc-500">
                    e.g. {d.example}
                  </p>
                )}
                {(d.synonyms?.length || d.antonyms?.length) ? (
                  <p className="mt-1 text-[10px] text-zinc-600">
                    {d.synonyms?.length ? (
                      <span>syn: {d.synonyms.join(", ")}</span>
                    ) : null}
                    {d.synonyms?.length && d.antonyms?.length ? " · " : null}
                    {d.antonyms?.length ? (
                      <span>ant: {d.antonyms.join(", ")}</span>
                    ) : null}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="text-[10px] text-zinc-600">
        词典数据来自{" "}
        <a
          href="https://dictionaryapi.dev/"
          className="text-emerald-600 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Free Dictionary API
        </a>
      </p>
    </div>
  );
}

export function SelectableTranslatedText({
  text,
  className,
  /** 无正文时的替代说明（例如正在自动拉取全文） */
  emptyHint,
}: {
  text: string;
  className?: string;
  emptyHint?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<LookupPopover | null>(null);
  const lastPointerDown = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!popover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopover(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popover]);

  const runLookup = useCallback(
    async (sourceText: string, x: number, y: number) => {
      const t = sourceText.trim();
      if (!t) return;
      setPopover({
        x,
        y,
        text: t,
        loading: true,
        error: null,
        data: null,
      });
      try {
        const data = await postLookup(t);
        setPopover((prev) =>
          prev && prev.text === t
            ? { ...prev, loading: false, error: null, data }
            : prev,
        );
      } catch (e) {
        setPopover((prev) =>
          prev && prev.text === t
            ? {
                ...prev,
                loading: false,
                error: e instanceof Error ? e.message : "Error",
                data: null,
              }
            : prev,
        );
      }
    },
    [],
  );

  const handleWordPointerDown = useCallback((e: React.PointerEvent) => {
    lastPointerDown.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleWordClick = useCallback(
    (e: React.MouseEvent, word: string) => {
      const sel = window.getSelection()?.toString() ?? "";
      if (sel.length > 1) return;
      const down = lastPointerDown.current;
      if (
        down &&
        (Math.abs(e.clientX - down.x) > 5 || Math.abs(e.clientY - down.y) > 5)
      ) {
        return;
      }
      e.preventDefault();
      void runLookup(word, e.clientX, e.clientY);
    },
    [runLookup],
  );

  const onContainerMouseUp = useCallback(() => {
    requestAnimationFrame(() => {
      const sel = window.getSelection();
      const str = sel?.toString().trim() ?? "";
      if (str.length < 2) return;
      const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
      if (!range || !containerRef.current) return;
      if (!containerRef.current.contains(range.commonAncestorContainer)) return;
      const rect = range.getBoundingClientRect();
      void runLookup(
        str,
        rect.left + rect.width / 2,
        Math.max(8, rect.top - 4),
      );
    });
  }, [runLookup]);

  const paragraphs = useMemo(() => {
    const t = text.trim();
    if (!t) return [];
    return t.split(/\n+/).filter(Boolean);
  }, [text]);

  const popoverStyle = useMemo(() => {
    if (typeof window === "undefined" || !popover) return {};
    const w = Math.min(520, window.innerWidth - 16);
    const left = Math.min(
      Math.max(8, popover.x - w / 2),
      window.innerWidth - w - 8,
    );
    const top = Math.max(8, popover.y);
    return { left, top, width: w, maxHeight: "min(85vh, 680px)" };
  }, [popover]);

  if (!text.trim()) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 px-4 py-8 text-center text-sm text-zinc-500">
        {emptyHint?.trim() ||
          "暂无正文。有原链的文章在选中后会自动拉取；YouTube 请先加载字幕。"}
      </p>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className={cn(
          "select-text text-[15px] leading-[1.75] text-zinc-300",
          className,
        )}
        onMouseUp={onContainerMouseUp}
        role="article"
      >
        {paragraphs.map((para, pi) => (
          <p key={pi} className="mb-4 last:mb-0">
            {segmentEnglish(para).map((seg, si) =>
              seg.isWord ? (
                <button
                  key={`${pi}-${si}`}
                  type="button"
                  tabIndex={0}
                  className="cursor-pointer rounded px-0.5 text-left font-normal text-zinc-200 underline decoration-zinc-700 decoration-dotted underline-offset-2 hover:bg-emerald-950/50 hover:decoration-emerald-500/60"
                  title="单击：词典 + 中文义项"
                  onPointerDown={handleWordPointerDown}
                  onClick={(e) => handleWordClick(e, seg.segment)}
                >
                  {seg.segment}
                </button>
              ) : (
                <span key={`${pi}-${si}`}>{seg.segment}</span>
              ),
            )}
          </p>
        ))}
      </div>

      {typeof document !== "undefined" &&
        popover &&
        createPortal(
          <div
            className="fixed z-[100] flex flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/50"
            style={popoverStyle}
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="词典与翻译"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                  {popover.loading
                    ? "查询中…"
                    : popover.data?.kind === "phrase"
                      ? "短语 / 句子详解"
                      : "词典 · Dictionary"}
                </p>
                <p className="mt-0.5 break-words font-mono text-[11px] text-zinc-500">
                  {popover.text}
                </p>
                <p className="mt-1 text-[10px] text-zinc-600">按 Esc 亦可关闭</p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg border border-zinc-500 bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-100 shadow-sm hover:border-emerald-600/60 hover:bg-zinc-700"
                onClick={() => setPopover(null)}
                aria-label="退出词典窗口"
              >
                退出
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {popover.loading && (
                <p className="text-sm text-zinc-400">加载释义与例句…</p>
              )}
              {popover.error && (
                <p className="text-xs text-red-400">{popover.error}</p>
              )}
              {!popover.loading &&
                popover.data?.kind === "word" &&
                !popover.data.dictionaryFound && (
                  <p className="mb-2 text-xs text-amber-200/90">
                    未在 Free Dictionary 找到该词条，下方为模型中文义项。
                  </p>
                )}
              {!popover.loading && popover.data?.kind === "word" && (
                <>
                  {popover.data.entry && (
                    <DictionaryBody entry={popover.data.entry} />
                  )}
                  <div className="mt-3 border-t border-zinc-800 pt-3">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                      中文义项
                    </p>
                    <p className="mt-1 text-base leading-relaxed text-emerald-100/95">
                      {popover.data.chineseGloss}
                    </p>
                  </div>
                </>
              )}
              {!popover.loading && popover.data?.kind === "phrase" && (
                <div className="text-sm">
                  <CoachMarkdown content={popover.data.markdown} />
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { PageIntro } from "@/components/page-intro";
import { CoachMarkdown } from "@/components/coach-markdown";
import { ImmersionReaderPanel } from "@/components/immersion-reader-panel";
import { ImmersionSourceSidebar } from "@/components/immersion-source-sidebar";
import {
  FALLBACK_IMMERSION_ITEMS,
  type ImmersionCard,
} from "@/lib/immersion-items";
import { requestCoach, type CoachApiMessage } from "@/hooks/use-coach-api";
import type { CoachVariant } from "@/lib/coach-prompts";
import {
  collectTopicOptions,
  groupImmersionItemsBySource,
  itemMatchesDayFilter,
  itemMatchesTopicFilter,
} from "@/lib/immersion-metadata";
import {
  IMMERSION_USER_UPLOAD_SOURCE,
  loadImmersionUserUploads,
  normalizeImmersionUploadTag,
  saveImmersionUserUploads,
} from "@/lib/immersion-user-uploads-storage";
import { newId } from "@/lib/expression-storage";
import { cn } from "@/lib/utils";

/** Max chars sent to structure coach / chat context (full article may be longer). */
const STRUCTURE_COACH_CHAR_LIMIT = 14_000;

const STRUCTURE_SECTION_IDS = [1, 2, 3, 4, 5, 6, 7] as const;
type StructureSectionId = (typeof STRUCTURE_SECTION_IDS)[number];

const STRUCTURE_META: Record<
  StructureSectionId,
  { label: string; title: string; hint: string }
> = {
  1: {
    label: "骨架与脉络",
    title: "骨架与脉络",
    hint: "用一句话说清全文在做什么，再用若干条概括各段在叙事上的作用（如铺垫、论点、反驳、收束）；不写逐句赏析。",
  },
  2: {
    label: "论证结构",
    title: "论证结构",
    hint: "提炼核心主张或叙事主线，归纳论据类型（事实、权威、类比、轶事、数据等），并指出未展开处或隐含假设；材料过短时请诚实说明推断成分。",
  },
  3: {
    label: "类型与阅读信号",
    title: "类型与阅读信号",
    hint: "判断文体与语域（报道、评论、科普、营销等），并说明阅读时可留意的信号：证据密度、措辞情绪、单一信源风险等；侧重「怎么读」，不作简单真假裁判。",
  },
  4: {
    label: "叙事与节奏",
    title: "叙事与节奏 (Narrative / flow)",
    hint: "开头钩子怎么设、转折在哪、高潮或结论落点；对播客逐字稿、叙事性文章特别有用。",
  },
  5: {
    label: "语域与受众",
    title: "语域与受众 (Register + audience)",
    hint: "正式度、是否带圈内梗/缩写、默认读者是谁。与微观「这句很口语」不同，这里是通篇语域判断。",
  },
  6: {
    label: "术语与主题簇",
    title: "术语与主题簇 (Theme glossary)",
    hint: "文中反复出现的概念簇（3–8 个），每个用极短中文说明在本篇里的角色；不是词典义项，而是这篇里它承担什么功能。",
  },
  7: {
    label: "读后自检",
    title: "行动项 / 读后自检 (So what)",
    hint: "若目的是学语言：建议再读一遍时关注什么（结构词、转折、数据句）。若目的是获取信息：读完应能回答的 3 个问题自检清单。",
  },
};

function buildImmersionMaterialMessage(
  selected: ImmersionCard,
  readerText: string,
  limit: number,
): string {
  const body = readerText.trim();
  const slice = body.slice(0, limit);
  const truncated = body.length > limit;
  return [
    `Title:\n${selected.title ?? "(no title)"}`,
    selected.url ? `Source URL:\n${selected.url}` : "",
    truncated
      ? `\nNote: material truncated to ${limit} characters (${body.length} total).`
      : "",
    ``,
    `Full material:\n---\n${slice}\n---`,
  ]
    .filter(Boolean)
    .join("\n");
}

type FeedResponse = {
  source: "rss" | "fallback";
  fetchedAt?: string;
  items: ImmersionCard[];
  warnings?: string[];
};

type TranscriptPayload = {
  text: string;
  focusLine: string;
  preview: string;
};

export function ImmersionClient() {
  const [items, setItems] = useState<ImmersionCard[]>([]);
  const [feedMeta, setFeedMeta] = useState<{
    source: "rss" | "fallback" | "loading";
    warnings: string[] | null;
  }>({ source: "loading", warnings: null });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transcriptById, setTranscriptById] = useState<
    Record<string, TranscriptPayload>
  >({});

  const [chatMessages, setChatMessages] = useState<CoachApiMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [structure1, setStructure1] = useState<string | null>(null);
  const [structure2, setStructure2] = useState<string | null>(null);
  const [structure3, setStructure3] = useState<string | null>(null);
  const [structure4, setStructure4] = useState<string | null>(null);
  const [structure5, setStructure5] = useState<string | null>(null);
  const [structure6, setStructure6] = useState<string | null>(null);
  const [structure7, setStructure7] = useState<string | null>(null);
  const [loadingSection, setLoadingSection] =
    useState<StructureSectionId | null>(null);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [expandedBodyById, setExpandedBodyById] = useState<Record<string, string>>(
    {},
  );
  const [articleLoading, setArticleLoading] = useState(false);
  const [articleError, setArticleError] = useState<string | null>(null);
  /** `YYYY-MM-DD` 或 null = 不按发布日筛选 */
  const [specificDay, setSpecificDay] = useState<string | null>(null);
  const [topicFilter, setTopicFilter] = useState("全部");
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [rssRefreshing, setRssRefreshing] = useState(false);
  const [uploadedItems, setUploadedItems] = useState<ImmersionCard[]>([]);
  const [uploadsReady, setUploadsReady] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  /** 下次上传使用的分类标签（侧栏分组 + 类别筛选） */
  const [uploadTagInput, setUploadTagInput] = useState("");
  const uploadsRef = useRef<ImmersionCard[]>([]);
  uploadsRef.current = uploadedItems;
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    setUploadedItems(loadImmersionUserUploads());
    setUploadsReady(true);
  }, []);

  useEffect(() => {
    if (!uploadsReady) return;
    saveImmersionUserUploads(uploadedItems);
  }, [uploadsReady, uploadedItems]);

  const loadRss = useCallback(async (mode: "initial" | "refresh" | "auto") => {
    if (mode === "initial") {
      setFeedMeta({ source: "loading", warnings: null });
    }
    if (mode === "refresh" || mode === "auto") {
      setRssRefreshing(true);
    }
    try {
      const res = await fetch("/api/immersion/rss");
      const data = (await res.json()) as FeedResponse;
      setItems(data.items);
      setFeedMeta({
        source: data.source,
        warnings: data.warnings ?? null,
      });
      setFetchedAt(data.fetchedAt ?? new Date().toISOString());
      setSelectedId((prev) => {
        const rssIds = new Set(data.items.map((i) => i.id));
        const ups = uploadsRef.current;
        const upIds = new Set(ups.map((u) => u.id));
        if (prev && (rssIds.has(prev) || upIds.has(prev))) return prev;
        return null;
      });
    } catch {
      setItems(FALLBACK_IMMERSION_ITEMS);
      setFeedMeta({
        source: "fallback",
        warnings: ["无法连接 RSS，已切换离线示例。"],
      });
      setFetchedAt(new Date().toISOString());
      setSelectedId((prev) => {
        const fbIds = new Set(FALLBACK_IMMERSION_ITEMS.map((i) => i.id));
        const ups = uploadsRef.current;
        const upIds = new Set(ups.map((u) => u.id));
        if (prev && (fbIds.has(prev) || upIds.has(prev))) return prev;
        return null;
      });
    } finally {
      setRssRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadRss("initial");
  }, [loadRss]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadRss("auto");
    }, 24 * 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [loadRss]);

  const mergedItems = useMemo(
    () => [...uploadedItems, ...items],
    [uploadedItems, items],
  );

  const filteredItems = useMemo(
    () =>
      mergedItems.filter(
        (i) =>
          itemMatchesDayFilter(i, specificDay) &&
          itemMatchesTopicFilter(i, topicFilter),
      ),
    [mergedItems, specificDay, topicFilter],
  );

  const groupedBySource = useMemo(() => {
    const g = groupImmersionItemsBySource(filteredItems);
    const uploadPrefix = `${IMMERSION_USER_UPLOAD_SOURCE} ·`;
    const uploadGroups = g.filter(
      (x) =>
        x.source === IMMERSION_USER_UPLOAD_SOURCE ||
        x.source.startsWith(uploadPrefix),
    );
    const rest = g.filter(
      (x) =>
        x.source !== IMMERSION_USER_UPLOAD_SOURCE &&
        !x.source.startsWith(uploadPrefix),
    );
    uploadGroups.sort((a, b) =>
      a.source.localeCompare(b.source, "zh-CN", { sensitivity: "base" }),
    );
    return [...uploadGroups, ...rest];
  }, [filteredItems]);

  const topicOptions = useMemo(
    () => collectTopicOptions(mergedItems),
    [mergedItems],
  );

  const onUploadFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setUploadError(null);
      setUploadBusy(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/immersion/upload-document", {
          method: "POST",
          body: fd,
        });
        const data = (await res.json()) as {
          title?: string;
          text?: string;
          excerpt?: string;
          focusLine?: string;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || "上传失败");
        }
        if (!data.text?.trim()) {
          throw new Error("解析结果为空");
        }
        const uploadTag = normalizeImmersionUploadTag(uploadTagInput);
        const card: ImmersionCard = {
          id: newId(),
          source: IMMERSION_USER_UPLOAD_SOURCE,
          tag: uploadTag,
          title: data.title ?? file.name,
          excerpt: data.excerpt ?? "",
          body: data.text,
          focusLine: data.focusLine ?? "",
          publishedAt: new Date().toISOString(),
          topics: [uploadTag, "用户上传"],
          userUpload: true,
          uploadTag,
        };
        setUploadedItems((prev) => [card, ...prev]);
        setSelectedId(card.id);
        setArticleError(null);
        setArticleLoading(false);
        setTxError(null);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "解析失败");
      } finally {
        setUploadBusy(false);
      }
    },
    [uploadTagInput],
  );

  useEffect(() => {
    if (filteredItems.length === 0) {
      setSelectedId(null);
      return;
    }
    if (
      selectedId != null &&
      !filteredItems.some((x) => x.id === selectedId)
    ) {
      setSelectedId(null);
    }
  }, [filteredItems, selectedId]);

  const selected = selectedId
    ? mergedItems.find((x) => x.id === selectedId)
    : undefined;
  const enriched = selected ? transcriptById[selected.id] : undefined;
  const expandedPlain = selected ? expandedBodyById[selected.id] : undefined;

  /** 文章：自动拉网页全文；播客：自动转写 enclosure 音频；均不用 RSS 摘要冒充正文。 */
  const readerTextForRead = (() => {
    if (!selected) return "";
    if (enriched?.text) return enriched.text;
    if (expandedPlain) return expandedPlain;
    if (selected.audioUrl && !selected.videoId && !enriched?.text) return "";
    if (selected.url && !selected.videoId && !selected.audioUrl) return "";
    return selected.body ?? selected.excerpt ?? "";
  })();

  const podcastTranscriptPreview = selectedId
    ? transcriptById[selectedId]?.text?.trim() ?? ""
    : "";

  const podcastTxInFlightRef = useRef<string | null>(null);

  const loadTranscript = useCallback(async () => {
    if (!selected?.videoId) return;
    setTxLoading(true);
    setTxError(null);
    try {
      const res = await fetch(
        `/api/immersion/transcript?videoId=${encodeURIComponent(selected.videoId)}`,
      );
      const data = (await res.json()) as TranscriptPayload & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "字幕不可用");
      }
      setTranscriptById((prev) => ({
        ...prev,
        [selected.id]: {
          text: data.text,
          focusLine: data.focusLine,
          preview: data.preview,
        },
      }));
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "字幕加载失败");
    } finally {
      setTxLoading(false);
    }
  }, [selected]);

  const loadPodcastTranscribe = useCallback(async () => {
    if (!selected?.audioUrl || selected.videoId) return;
    const itemId = selected.id;
    if (podcastTxInFlightRef.current === itemId) return;
    podcastTxInFlightRef.current = itemId;
    const audioUrl = selected.audioUrl;
    const title = selected.title ?? "";
    setTxLoading(true);
    setTxError(null);
    try {
      const res = await fetch("/api/immersion/podcast-transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl, title }),
      });
      const data = (await res.json()) as TranscriptPayload & {
        error?: string;
      };
      if (selectedIdRef.current !== itemId) return;
      if (!res.ok) {
        throw new Error(data.error || "转写失败");
      }
      if (!data.text?.trim()) {
        throw new Error("转写结果为空");
      }
      setTranscriptById((prev) => ({
        ...prev,
        [itemId]: {
          text: data.text,
          focusLine: data.focusLine,
          preview: data.preview,
        },
      }));
    } catch (e) {
      if (selectedIdRef.current === itemId) {
        setTxError(e instanceof Error ? e.message : "播客转写失败");
      }
    } finally {
      if (podcastTxInFlightRef.current === itemId) {
        podcastTxInFlightRef.current = null;
      }
      if (selectedIdRef.current === itemId) {
        setTxLoading(false);
      }
    }
  }, [selected]);

  /** 选中播客（有 enclosure 音频）时自动转写为英文稿（Gemini，走与 RSS 相同代理）。 */
  useEffect(() => {
    if (!selectedId) return;
    const item = mergedItems.find((x) => x.id === selectedId);
    if (!item?.audioUrl || item.videoId) return;
    if (transcriptById[item.id]?.text?.trim()) return;
    void loadPodcastTranscribe();
  }, [selectedId, mergedItems, podcastTranscriptPreview, loadPodcastTranscribe]);

  /** 选中带链接且非视频、非音频 enclosure 的条目时自动拉取网页正文。 */
  useEffect(() => {
    if (!selectedId) return;
    const item = mergedItems.find((x) => x.id === selectedId);
    if (!item?.url || item.videoId || item.audioUrl) return;
    if (expandedBodyById[item.id]?.trim()) return;

    let cancelled = false;
    const targetId = item.id;
    const url = item.url;

    void (async () => {
      setArticleLoading(true);
      setArticleError(null);
      try {
        const res = await fetch(
          `/api/immersion/article-body?url=${encodeURIComponent(url)}`,
        );
        const data = (await res.json()) as { text?: string; error?: string };
        if (cancelled) return;
        if (selectedIdRef.current !== targetId) return;
        if (!res.ok) {
          throw new Error(data.error || "拉取失败");
        }
        if (data.text?.trim()) {
          setExpandedBodyById((prev) => ({
            ...prev,
            [targetId]: data.text!,
          }));
        }
      } catch (e) {
        if (!cancelled && selectedIdRef.current === targetId) {
          setArticleError(e instanceof Error ? e.message : "全文拉取失败");
        }
      } finally {
        if (!cancelled && selectedIdRef.current === targetId) {
          setArticleLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId, mergedItems, expandedBodyById]);

  useEffect(() => {
    setStructure1(null);
    setStructure2(null);
    setStructure3(null);
    setStructure4(null);
    setStructure5(null);
    setStructure6(null);
    setStructure7(null);
    setChatMessages([]);
    setChatInput("");
    setCoachError(null);
    setChatError(null);
    setLoadingSection(null);
    setChatLoading(false);
  }, [selected?.id]);

  const coachBusy = loadingSection !== null || chatLoading;

  const structureBySection: Record<StructureSectionId, string | null> = {
    1: structure1,
    2: structure2,
    3: structure3,
    4: structure4,
    5: structure5,
    6: structure6,
    7: structure7,
  };

  const runStructureSection = useCallback(
    async (section: StructureSectionId) => {
      if (!selected) return;
      const material = readerTextForRead.trim();
      if (!material) return;
      const itemId = selected.id;
      const variant =
        `immersion-structure-${section}` as CoachVariant;
      const userContent = buildImmersionMaterialMessage(
        selected,
        readerTextForRead,
        STRUCTURE_COACH_CHAR_LIMIT,
      );
      setLoadingSection(section);
      setCoachError(null);
      try {
        const data = await requestCoach(variant, [
          { role: "user", content: userContent },
        ]);
        if (selectedIdRef.current !== itemId) return;
        switch (section) {
          case 1:
            setStructure1(data.content);
            break;
          case 2:
            setStructure2(data.content);
            break;
          case 3:
            setStructure3(data.content);
            break;
          case 4:
            setStructure4(data.content);
            break;
          case 5:
            setStructure5(data.content);
            break;
          case 6:
            setStructure6(data.content);
            break;
          case 7:
            setStructure7(data.content);
            break;
        }
      } catch (e) {
        if (selectedIdRef.current === itemId) {
          setCoachError(e instanceof Error ? e.message : "结构分析失败");
        }
      } finally {
        setLoadingSection(null);
      }
    },
    [readerTextForRead, selected],
  );

  const sendImmersionChat = useCallback(async () => {
    if (!selected) return;
    const material = readerTextForRead.trim();
    const q = chatInput.trim();
    if (!material || !q) return;
    const itemId = selected.id;
    const ctx = buildImmersionMaterialMessage(
      selected,
      readerTextForRead,
      STRUCTURE_COACH_CHAR_LIMIT,
    );
    const nextMessages: CoachApiMessage[] = [
      ...chatMessages,
      { role: "user", content: q },
    ];
    setChatInput("");
    setChatLoading(true);
    setChatError(null);
    try {
      const data = await requestCoach("immersion-reader-chat", nextMessages, {
        systemContext: ctx,
      });
      if (selectedIdRef.current !== itemId) return;
      setChatMessages([
        ...nextMessages,
        { role: "assistant", content: data.content },
      ]);
    } catch (e) {
      if (selectedIdRef.current === itemId) {
        setChatError(e instanceof Error ? e.message : "发送失败");
      }
    } finally {
      if (selectedIdRef.current === itemId) {
        setChatLoading(false);
      }
    }
  }, [chatInput, chatMessages, readerTextForRead, selected]);

  const loadingFeed =
    feedMeta.source === "loading" &&
    items.length === 0 &&
    uploadedItems.length === 0;
  const feedLive = feedMeta.source === "rss";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageIntro titleEn="Living Current" titleZh="实时输入">
        左侧按<strong className="text-zinc-400">订阅来源</strong>
        分组，可按<strong className="text-zinc-400">具体发布日</strong>与
        <strong className="text-zinc-400">类别</strong>
        （政治、经济、国际等自动推断）筛选；可上传 <strong className="text-zinc-400">Word（.docx）/ PDF</strong>{" "}
        并填写<strong className="text-zinc-400">自定义标签</strong>
        ，正文按「我的上传 · 标签」分组且纳入类别筛选。列表约每日自动刷新，亦可手动刷新。文章自动拉正文，播客自动转写音频（Gemini）。单击单词走{" "}
        <span className="text-zinc-400">Free Dictionary + 中文义项</span>
        ，划选短语/句走结构化详解。右侧可 AI 问答与分块结构分析。
      </PageIntro>

      {feedMeta.warnings && feedMeta.warnings.length > 0 && (
        <div className="border-b border-amber-900/40 bg-amber-950/20 px-4 py-2 text-[11px] text-amber-200/90 md:px-8">
          {feedMeta.warnings.slice(0, 3).map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <ImmersionSourceSidebar
          loading={loadingFeed}
          groups={groupedBySource}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setArticleError(null);
            setArticleLoading(false);
            setTxError(null);
          }}
          specificDay={specificDay}
          onSpecificDayChange={(v) => {
            setSpecificDay(v);
          }}
          topicFilter={topicFilter}
          onTopicFilterChange={(v) => {
            setTopicFilter(v);
          }}
          topicOptions={topicOptions}
          fetchedAt={fetchedAt}
          onRefresh={() => void loadRss("refresh")}
          rssRefreshing={rssRefreshing}
          uploadBusy={uploadBusy}
          uploadError={uploadError}
          uploadTagInput={uploadTagInput}
          onUploadTagInputChange={setUploadTagInput}
          onUploadFileChange={onUploadFileChange}
        />

        <ImmersionReaderPanel
          item={selected}
          enriched={enriched}
          expandedBody={expandedPlain}
          feedLive={feedLive}
          txLoading={txLoading}
          txError={txError}
          articleLoading={articleLoading}
          articleError={articleError}
          onLoadTranscript={() => void loadTranscript()}
          onLoadPodcastTranscribe={() => void loadPodcastTranscribe()}
        />

        <aside className="min-h-0 w-full shrink-0 overflow-y-auto border-t border-zinc-800 p-4 lg:w-[min(100%,420px)] lg:border-l lg:border-t-0 lg:p-5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            AI reading desk · 阅读桌
          </p>
          {!selected ? (
            <p className="mt-2 text-sm text-zinc-500">请选择…</p>
          ) : (
            <>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                有原链文章选中后会自动拉正文；视频请先加载字幕。下文教练最多参考约{" "}
                {STRUCTURE_COACH_CHAR_LIMIT.toLocaleString()} 字。
              </p>

              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/35 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Ask AI · 问一问
                </p>
                <div className="mt-2 max-h-[min(28vh,220px)] space-y-2.5 overflow-y-auto">
                  {chatMessages.length === 0 && (
                    <p className="text-[11px] leading-relaxed text-zinc-600">
                      用中或英围绕<strong className="text-zinc-500">当前正文</strong>
                      提问（论点、背景、词汇等）。划选查词仍在中间栏。
                    </p>
                  )}
                  {chatMessages.map((m, i) => (
                    <div
                      key={`${i}-${m.role}`}
                      className={cn(
                        "rounded-lg px-2.5 py-2 text-[13px] leading-relaxed",
                        m.role === "user"
                          ? "ml-4 border border-zinc-700/80 bg-zinc-800/60 text-zinc-200"
                          : "mr-2 border border-emerald-900/40 bg-emerald-950/15 text-zinc-200",
                      )}
                    >
                      <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                        {m.role === "user" ? "你" : "AI"}
                      </p>
                      {m.role === "assistant" ? (
                        <CoachMarkdown content={m.content} />
                      ) : (
                        <p className="whitespace-pre-wrap text-zinc-200">{m.content}</p>
                      )}
                    </div>
                  ))}
                  {chatLoading && (
                    <p className="text-xs text-zinc-500">正在回复…</p>
                  )}
                </div>
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (
                        readerTextForRead.trim() &&
                        chatInput.trim() &&
                        !coachBusy
                      ) {
                        void sendImmersionChat();
                      }
                    }
                  }}
                  rows={2}
                  placeholder="输入问题…（Enter 发送，Shift+Enter 换行）"
                  disabled={coachBusy}
                  className="mt-2 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950/50 px-2.5 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => void sendImmersionChat()}
                  disabled={
                    coachBusy ||
                    !readerTextForRead.trim() ||
                    !chatInput.trim()
                  }
                  className="mt-2 w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  发送
                </button>
                {chatError && (
                  <p className="mt-2 text-xs text-red-400">{chatError}</p>
                )}
              </div>

              <p className="mt-4 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Structure · 整篇结构（分块）
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {STRUCTURE_SECTION_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => void runStructureSection(id)}
                    disabled={coachBusy || !readerTextForRead.trim()}
                    className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-2 py-2.5 text-center text-[11px] font-medium leading-snug text-zinc-200 hover:border-emerald-700/50 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {loadingSection === id ? "…" : STRUCTURE_META[id].label}
                  </button>
                ))}
              </div>
              {coachError && (
                <p className="mt-2 text-xs text-red-400">{coachError}</p>
              )}

              <div className="mt-4 space-y-4">
                {STRUCTURE_SECTION_IDS.map((id) => {
                  const meta = STRUCTURE_META[id];
                  const content = structureBySection[id];
                  return (
                    <section
                      key={id}
                      className="rounded-xl border border-zinc-800 bg-zinc-900/25 p-3"
                    >
                      <h4 className="text-[11px] font-semibold text-zinc-400">
                        {meta.title}
                      </h4>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
                        {meta.hint}
                      </p>
                      <div className="mt-2 max-h-[min(32vh,14rem)] overflow-y-auto border-t border-zinc-800/80 pt-2 text-sm">
                        {loadingSection === id ? (
                          <p className="text-xs text-zinc-500">生成中…</p>
                        ) : content ? (
                          <CoachMarkdown content={content} />
                        ) : (
                          <p className="text-xs text-zinc-600">
                            点击上方「{meta.label}」生成。
                          </p>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

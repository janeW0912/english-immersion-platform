/** Offline fallback when RSS / network fails — shape matches API `ImmersionCard`. */

export type ImmersionCard = {
  id: string;
  source: string;
  tag: string;
  title: string;
  excerpt: string;
  /** 站内阅读器正文（RSS full text / 字幕全文） */
  body?: string;
  focusLine: string;
  /** ISO 时间（来自 RSS pubDate / isoDate），用于按日筛选 */
  publishedAt?: string;
  /** 推断的中文主题，用于类别筛选 */
  topics?: string[];
  url?: string;
  /** RSS audio enclosure — transcript is generated server-side (Gemini). */
  audioUrl?: string;
  videoId?: string | null;
  /** Local upload (.docx / .pdf); text in `body` */
  userUpload?: boolean;
  /** 本地上传时用户自定义分类标签（用于侧栏分组与类别筛选） */
  uploadTag?: string;
};

export const FALLBACK_IMMERSION_ITEMS: ImmersionCard[] = [
  {
    id: "fallback-1",
    source: "Lexicon Valley",
    tag: "Podcast",
    publishedAt: new Date().toISOString(),
    topics: ["文化", "社会", "综合"],
    title: "Why metaphors leak into everyday speech",
    excerpt:
      "…so when people say the situation spiraled, they’re not always thinking of a helix. It’s more like emotional weather. That’s wild if you think about it — we borrow physics for feelings.",
    focusLine: "That’s wild if you think about it",
    body:
      "…so when people say the situation spiraled, they’re not always thinking of a helix. It’s more like emotional weather. That’s wild if you think about it — we borrow physics for feelings.",
  },
  {
    id: "fallback-2",
    source: "FT Tech",
    tag: "News",
    publishedAt: new Date(Date.now() - 86400000).toISOString(),
    topics: ["科技", "商业", "经济"],
    title: "Regulators catch up with foundation models",
    excerpt:
      "The market has moved from hype to a sober inventory of risk. “We are no longer in the permissionless experiment phase,” the chair said, warning that complacency is the real tail risk now.",
    focusLine: "We are no longer in the permissionless experiment phase",
    body:
      "The market has moved from hype to a sober inventory of risk. “We are no longer in the permissionless experiment phase,” the chair said, warning that complacency is the real tail risk now.",
  },
  {
    id: "fallback-3",
    source: "Off Menu",
    tag: "Interview",
    publishedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    topics: ["文化", "社会", "综合"],
    title: "Comfort food as identity",
    excerpt:
      "…it’s never just carbs, is it? It’s the room you were in, the person who made it. I could eat this every day and still feel like I’m time-traveling.",
    focusLine: "It’s never just carbs, is it?",
    body:
      "…it’s never just carbs, is it? It’s the room you were in, the person who made it. I could eat this every day and still feel like I’m time-traveling.",
  },
  {
    id: "fallback-4",
    source: "TED",
    tag: "Talk",
    publishedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    topics: ["科技", "社会", "文化"],
    title: "Attention is the scarcest currency",
    excerpt:
      "Screens aren’t evil — they’re mirrors. If your attention keeps snapping back to outrage, that isn’t the algorithm’s fault alone; it’s training data from your nervous system.",
    focusLine: "Attention is the scarcest currency",
    body:
      "Screens aren’t evil — they’re mirrors. If your attention keeps snapping back to outrage, that isn’t the algorithm’s fault alone; it’s training data from your nervous system.",
  },
];

/** @deprecated use FALLBACK_IMMERSION_ITEMS */
export const IMMERSION_ITEMS = FALLBACK_IMMERSION_ITEMS;

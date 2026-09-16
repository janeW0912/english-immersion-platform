import type { ImmersionCard } from "@/lib/immersion-items";
import { IMMERSION_USER_UPLOAD_SOURCE } from "@/lib/immersion-user-uploads-storage";

/** 用于筛选与展示的主题（中文） */
export const IMMERSION_TOPIC_ORDER = [
  "用户上传",
  "政治",
  "经济",
  "国际",
  "科技",
  "文化",
  "社会",
  "商业",
  "健康",
  "环境",
  "体育",
  "综合",
  "其他",
] as const;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Local calendar day YYYY-MM-DD */
export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseDayKey(isoOrYmd: string): string | null {
  const s = isoOrYmd.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return localDayKey(new Date(t));
}

export function itemPublishedDayKey(item: ImmersionCard): string | null {
  if (!item.publishedAt) return null;
  return parseDayKey(item.publishedAt);
}

/**
 * @param dayKey `YYYY-MM-DD` 日历日，与条目 `publishedAt` 的 UTC 日历日对齐；`null` / 空串表示不按日筛选。
 * 指定日期时，无发布日期的条目不显示。
 */
export function itemMatchesDayFilter(
  item: ImmersionCard,
  dayKey: string | null | undefined,
): boolean {
  const key = dayKey?.trim() ?? "";
  if (!key) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return true;
  const itemDay = itemPublishedDayKey(item);
  if (!itemDay) return false;
  return itemDay === key;
}

export function itemMatchesTopicFilter(
  item: ImmersionCard,
  topicFilter: string,
): boolean {
  if (!topicFilter || topicFilter === "全部") return true;
  const topics = item.topics?.length ? item.topics : ["综合"];
  return topics.includes(topicFilter);
}

export function collectTopicOptions(items: ImmersionCard[]): string[] {
  const set = new Set<string>();
  for (const it of items) {
    const ts = it.topics?.length ? it.topics : ["综合"];
    for (const t of ts) set.add(t);
  }
  const rest = [...set].filter((t) => t !== "全部");
  rest.sort((a, b) => {
    const ia = IMMERSION_TOPIC_ORDER.indexOf(a as (typeof IMMERSION_TOPIC_ORDER)[number]);
    const ib = IMMERSION_TOPIC_ORDER.indexOf(b as (typeof IMMERSION_TOPIC_ORDER)[number]);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  return rest;
}

/** 从 RSS item.categories 等推断中文主题（可多标签） */
export function inferImmersionTopics(input: {
  feedUrl: string;
  feedTitle: string;
  title: string;
  excerpt: string;
  rssCategories: string[];
}): string[] {
  const bag = `${input.feedUrl} ${input.feedTitle} ${input.title} ${input.excerpt} ${input.rssCategories.join(" ")}`.toLowerCase();
  const found = new Set<string>();

  const rules: [string, RegExp][] = [
    [
      "政治",
      /\b(politics|election|parliament|congress|senate|democrat|republican|white house|vote|campaign|minister|cabinet|geopolitics|nato)\b|政治|选举|国会|内阁|议员/i,
    ],
    [
      "经济",
      /\b(economy|economic|fed\b|inflation|gdp|jobs report|market|trade war|finance|bank|recession|interest rate|tariff)\b|经济|通胀|就业|股市|贸易|金融|央行/i,
    ],
    [
      "国际",
      /\b(world|global|foreign|international|ukraine|gaza|middle east|eu\b|nato|un\b|china|taiwan|korea|iran|israel)\b|国际|外交|海外|中东|欧盟|联合国/i,
    ],
    [
      "科技",
      /\b(tech|ai\b|software|chip|semiconductor|startup|cyber|internet|apple|google|microsoft|openai|model)\b|科技|人工智能|芯片|互联网|算法/i,
    ],
    [
      "文化",
      /\b(culture|film|music|art|book|literature|museum|festival|tv series|hollywood)\b|文化|艺术|电影|音乐|文学|博物馆/i,
    ],
    [
      "社会",
      /\b(society|social|community|housing|crime|justice|education|inequality|demographics|gender|race)\b|社会|社区|住房|犯罪|教育|平等/i,
    ],
    [
      "商业",
      /\b(business|ceo|company|startup|merger|retail|brand|consumer|logistics)\b|商业|公司|零售|品牌|并购|创业/i,
    ],
    [
      "健康",
      /\b(health|medical|hospital|disease|vaccine|mental health|nutrition|covid|cancer|who\b)\b|健康|医疗|疾病|疫苗|心理|营养/i,
    ],
    [
      "环境",
      /\b(climate|environment|carbon|emission|renewable|wildfire|flood|biodiversity|cop\d)\b|环境|气候|碳排放|能源|灾害/i,
    ],
    [
      "体育",
      /\b(sport|olympic|football|soccer|nba|tennis|cricket|rugby|marathon)\b|体育|足球|奥运|网球|比赛/i,
    ],
  ];

  for (const [topic, re] of rules) {
    if (re.test(bag)) found.add(topic);
  }

  for (const raw of input.rssCategories) {
    const c = raw.trim().toLowerCase();
    if (!c) continue;
    if (/politic|election|government|white house/.test(c)) found.add("政治");
    else if (/business|econom|finance|market|money|trade/.test(c)) found.add("经济");
    else if (/world|international|foreign|europe|asia|africa|middle east|us news/.test(c))
      found.add("国际");
    else if (/tech|science|media|digital|data/.test(c)) found.add("科技");
    else if (/culture|art|film|music|book/.test(c)) found.add("文化");
    else if (/society|social|education|health|life/.test(c)) found.add("社会");
    else if (/health|wellbeing|science/.test(c)) found.add("健康");
    else if (/environment|climate|science/.test(c)) found.add("环境");
    else if (/sport/.test(c)) found.add("体育");
  }

  if (/podcast|simplecast|megaphone|npr\.org\/\d+\/podcast/i.test(input.feedUrl)) {
    found.add("综合");
  }

  if (found.size === 0) found.add("综合");

  return [...found].sort(
    (a, b) =>
      IMMERSION_TOPIC_ORDER.indexOf(a as (typeof IMMERSION_TOPIC_ORDER)[number]) -
      IMMERSION_TOPIC_ORDER.indexOf(b as (typeof IMMERSION_TOPIC_ORDER)[number]),
  );
}

function uploadGroupSource(it: ImmersionCard): string {
  const tag = (it.uploadTag?.trim() || "未分类").slice(0, 64);
  return `${IMMERSION_USER_UPLOAD_SOURCE} · ${tag || "未分类"}`;
}

export function groupImmersionItemsBySource(
  items: ImmersionCard[],
): { source: string; items: ImmersionCard[] }[] {
  const map = new Map<string, ImmersionCard[]>();
  const order: string[] = [];
  for (const it of items) {
    const isUpload =
      it.userUpload === true || it.source === IMMERSION_USER_UPLOAD_SOURCE;
    const s = isUpload
      ? uploadGroupSource(it)
      : it.source?.trim() || "其它来源";
    if (!map.has(s)) {
      order.push(s);
      map.set(s, []);
    }
    map.get(s)!.push(it);
  }
  return order.map((source) => ({ source, items: map.get(source)! }));
}

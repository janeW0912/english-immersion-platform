import type { ImmersionCard } from "@/lib/immersion-items";

/** Sidebar / grouping label for user-uploaded documents */
export const IMMERSION_USER_UPLOAD_SOURCE = "我的上传";

const STORAGE_KEY = "eip.immersion.uploads.v1";
const VERSION = 1 as const;
const MAX_ITEMS = 24;
/** Per-document body cap when persisting (avoid blowing localStorage quota). */
const MAX_BODY_CHARS = 350_000;

/** 上传标签：去空白、限长；空则「未分类」 */
export function normalizeImmersionUploadTag(raw: string): string {
  const t = raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 32);
  return t || "未分类";
}

type PersistShape = {
  version: typeof VERSION;
  items: ImmersionCard[];
};

export function loadImmersionUserUploads(): ImmersionCard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as PersistShape;
    if (p?.version !== VERSION || !Array.isArray(p.items)) return [];
    return p.items.filter(
      (x): x is ImmersionCard =>
        typeof x?.id === "string" &&
        typeof x?.title === "string" &&
        (x.userUpload === true || x.source === IMMERSION_USER_UPLOAD_SOURCE),
    );
  } catch {
    return [];
  }
}

export function saveImmersionUserUploads(items: ImmersionCard[]): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = items.slice(0, MAX_ITEMS).map((it) => {
      const body = it.body ?? "";
      if (body.length <= MAX_BODY_CHARS) return it;
      return {
        ...it,
        body: `${body.slice(0, MAX_BODY_CHARS - 1)}…`,
      };
    });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: VERSION, items: trimmed }),
    );
  } catch {
    /* quota */
  }
}

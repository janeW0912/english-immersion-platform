export type ExpressionRole = "user" | "assistant";

export type ExpressionMsg = {
  id: string;
  role: ExpressionRole;
  content: string;
};

export type ExpressionCategory = {
  id: string;
  name: string;
  createdAt: number;
};

export type ExpressionSession = {
  id: string;
  categoryId: string;
  title: string;
  messages: ExpressionMsg[];
  createdAt: number;
  updatedAt: number;
};

export type ExpressionLabPersist = {
  version: 1;
  categories: ExpressionCategory[];
  sessions: ExpressionSession[];
  activeCategoryId: string | null;
  activeSessionId: string | null;
};

const STORAGE_KEY = "eip.expression.lab.v1";

export function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function createDefaultPersist(): ExpressionLabPersist {
  const catId = newId();
  const sessId = newId();
  const now = Date.now();
  return {
    version: 1,
    categories: [{ id: catId, name: "日常练习", createdAt: now }],
    sessions: [
      {
        id: sessId,
        categoryId: catId,
        title: "新对话",
        messages: [],
        createdAt: now,
        updatedAt: now,
      },
    ],
    activeCategoryId: catId,
    activeSessionId: sessId,
  };
}

export function loadExpressionLab(): ExpressionLabPersist {
  if (typeof window === "undefined") return createDefaultPersist();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultPersist();
    const parsed = JSON.parse(raw) as ExpressionLabPersist;
    if (parsed?.version !== 1 || !Array.isArray(parsed.categories)) {
      return createDefaultPersist();
    }
    if (parsed.categories.length === 0 || parsed.sessions.length === 0) {
      return createDefaultPersist();
    }
    let activeCategoryId = parsed.activeCategoryId;
    let activeSessionId = parsed.activeSessionId;
    if (!parsed.categories.some((c) => c.id === activeCategoryId)) {
      activeCategoryId = parsed.categories[0]?.id ?? null;
    }
    if (!parsed.sessions.some((s) => s.id === activeSessionId)) {
      const inCat = parsed.sessions.filter(
        (s) => s.categoryId === activeCategoryId,
      );
      activeSessionId =
        inCat.sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ??
        parsed.sessions[0]?.id ??
        null;
    }
    return {
      ...parsed,
      activeCategoryId,
      activeSessionId,
    };
  } catch {
    return createDefaultPersist();
  }
}

export function saveExpressionLab(data: ExpressionLabPersist): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // quota exceeded etc.
  }
}

export function sessionTitleFromMessages(messages: ExpressionMsg[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  const raw = firstUser?.content?.trim() ?? "";
  if (!raw) return "新对话";
  const line = raw.split("\n")[0] ?? raw;
  return line.length > 48 ? `${line.slice(0, 47)}…` : line;
}

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ExpressionCategory, ExpressionSession } from "@/lib/expression-storage";

type Props = {
  categories: ExpressionCategory[];
  sessions: ExpressionSession[];
  activeCategoryId: string | null;
  activeSessionId: string | null;
  onSelectCategory: (id: string) => void;
  onSelectSession: (id: string) => void;
  onAddCategory: (name: string) => void;
  onRenameCategory: (id: string, name: string) => void;
  onDeleteCategory: (id: string) => void;
  onAddSession: () => void;
  onRenameSession: (id: string, title: string) => void;
  onDeleteSession: (id: string) => void;
};

export function ExpressionSidebar({
  categories,
  sessions,
  activeCategoryId,
  activeSessionId,
  onSelectCategory,
  onSelectSession,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  onAddSession,
  onRenameSession,
  onDeleteSession,
}: Props) {
  const [newCat, setNewCat] = useState("");
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editingSess, setEditingSess] = useState<string | null>(null);
  const [editSessTitle, setEditSessTitle] = useState("");

  const sessionsInCat = sessions
    .filter((s) => s.categoryId === activeCategoryId)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <aside className="flex w-full flex-col border-b border-zinc-800 bg-zinc-950/80 md:h-auto md:max-h-none md:w-72 md:shrink-0 md:border-b-0 md:border-r">
      <div className="border-b border-zinc-800/80 p-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          Categories · 分类
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {categories.map((c) => (
            <div key={c.id} className="group relative flex items-center">
              {editingCat === c.id ? (
                <input
                  autoFocus
                  value={editCatName}
                  onChange={(e) => setEditCatName(e.target.value)}
                  onBlur={() => {
                    onRenameCategory(c.id, editCatName);
                    setEditingCat(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onRenameCategory(c.id, editCatName);
                      setEditingCat(null);
                    }
                    if (e.key === "Escape") setEditingCat(null);
                  }}
                  className="w-28 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onSelectCategory(c.id)}
                  onDoubleClick={() => {
                    setEditingCat(c.id);
                    setEditCatName(c.name);
                  }}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs transition-colors",
                    activeCategoryId === c.id
                      ? "bg-emerald-950/80 text-emerald-300 ring-1 ring-emerald-800/60"
                      : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
                  )}
                >
                  {c.name}
                </button>
              )}
              {categories.length > 1 && editingCat !== c.id && (
                <button
                  type="button"
                  title="删除分类（会话会并入其余分类）"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteCategory(c.id);
                  }}
                  className="ml-0.5 rounded px-0.5 text-[10px] text-zinc-600 opacity-0 hover:text-red-400 group-hover:opacity-100"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newCat.trim()) return;
            onAddCategory(newCat.trim());
            setNewCat("");
          }}
        >
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="新分类名称"
            className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
          >
            添加
          </button>
        </form>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-3 md:flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Sessions · 会话
          </p>
          <button
            type="button"
            onClick={onAddSession}
            className="rounded-lg bg-emerald-900/40 px-2 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-900/60"
          >
            + 新对话
          </button>
        </div>
        <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto md:max-h-[min(60vh,28rem)]">
          {sessionsInCat.map((sess) => (
            <li key={sess.id}>
              {editingSess === sess.id ? (
                <input
                  autoFocus
                  value={editSessTitle}
                  onChange={(e) => setEditSessTitle(e.target.value)}
                  onBlur={() => {
                    onRenameSession(sess.id, editSessTitle);
                    setEditingSess(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onRenameSession(sess.id, editSessTitle);
                      setEditingSess(null);
                    }
                    if (e.key === "Escape") setEditingSess(null);
                  }}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
                />
              ) : (
                <div className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSelectSession(sess.id)}
                    onDoubleClick={() => {
                      setEditingSess(sess.id);
                      setEditSessTitle(sess.title);
                    }}
                    className={cn(
                      "min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                      activeSessionId === sess.id
                        ? "bg-zinc-800 text-zinc-100 ring-1 ring-zinc-700"
                        : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300",
                    )}
                  >
                    {sess.title}
                  </button>
                  <button
                    type="button"
                    title="删除会话"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(sess.id);
                    }}
                    className="shrink-0 rounded px-1 text-xs text-zinc-600 opacity-0 hover:text-red-400 group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <p className="border-t border-zinc-800/80 px-3 py-2 text-[10px] leading-snug text-zinc-600">
        数据仅存于本机浏览器（localStorage），清除站点数据会丢失；后续可接账号同步。
      </p>
    </aside>
  );
}

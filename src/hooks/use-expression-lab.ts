"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ExpressionLabPersist,
  ExpressionMsg,
  ExpressionSession,
} from "@/lib/expression-storage";
import {
  loadExpressionLab,
  newId,
  saveExpressionLab,
  sessionTitleFromMessages,
  createDefaultPersist,
} from "@/lib/expression-storage";

export function useExpressionLab() {
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<ExpressionLabPersist>(createDefaultPersist);

  useEffect(() => {
    setState(loadExpressionLab());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const t = window.setTimeout(() => saveExpressionLab(state), 320);
    return () => window.clearTimeout(t);
  }, [state, hydrated]);

  const activeSession = state.sessions.find(
    (s) => s.id === state.activeSessionId,
  );

  const setMessages = useCallback((messages: ExpressionMsg[]) => {
    setState((s) => {
      const sid = s.activeSessionId;
      if (!sid) return s;
      const now = Date.now();
      return {
        ...s,
        sessions: s.sessions.map((sess) =>
          sess.id === sid
            ? {
                ...sess,
                messages,
                title:
                  messages.length === 0
                    ? "新对话"
                    : sess.title === "新对话"
                      ? sessionTitleFromMessages(messages)
                      : sess.title,
                updatedAt: now,
              }
            : sess,
        ),
      };
    });
  }, []);

  const selectCategory = useCallback((categoryId: string) => {
    setState((s) => {
      const inCat = s.sessions
        .filter((x) => x.categoryId === categoryId)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      const nextSession = inCat[0];
      if (nextSession) {
        return {
          ...s,
          activeCategoryId: categoryId,
          activeSessionId: nextSession.id,
        };
      }
      const sid = newId();
      const now = Date.now();
      return {
        ...s,
        activeCategoryId: categoryId,
        activeSessionId: sid,
        sessions: [
          ...s.sessions,
          {
            id: sid,
            categoryId,
            title: "新对话",
            messages: [],
            createdAt: now,
            updatedAt: now,
          },
        ],
      };
    });
  }, []);

  const selectSession = useCallback((sessionId: string) => {
    setState((s) => {
      const sess = s.sessions.find((x) => x.id === sessionId);
      return {
        ...s,
        activeSessionId: sessionId,
        activeCategoryId: sess?.categoryId ?? s.activeCategoryId,
      };
    });
  }, []);

  const addCategory = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const catId = newId();
    const sessId = newId();
    const now = Date.now();
    setState((s) => ({
      ...s,
      categories: [...s.categories, { id: catId, name: trimmed, createdAt: now }],
      sessions: [
        ...s.sessions,
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
    }));
  }, []);

  const renameCategory = useCallback((categoryId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setState((s) => ({
      ...s,
      categories: s.categories.map((c) =>
        c.id === categoryId ? { ...c, name: trimmed } : c,
      ),
    }));
  }, []);

  const deleteCategory = useCallback((categoryId: string) => {
    setState((s) => {
      if (s.categories.length <= 1) return s;
      const remaining = s.categories.filter((c) => c.id !== categoryId);
      const targetId = remaining[0]?.id;
      if (!targetId) return s;
      return {
        ...s,
        categories: remaining,
        sessions: s.sessions.map((sess) =>
          sess.categoryId === categoryId
            ? { ...sess, categoryId: targetId }
            : sess,
        ),
        activeCategoryId:
          s.activeCategoryId === categoryId ? targetId : s.activeCategoryId,
      };
    });
  }, []);

  const addSession = useCallback(() => {
    setState((s) => {
      const catId = s.activeCategoryId ?? s.categories[0]?.id;
      if (!catId) return s;
      const sessId = newId();
      const now = Date.now();
      return {
        ...s,
        sessions: [
          ...s.sessions,
          {
            id: sessId,
            categoryId: catId,
            title: "新对话",
            messages: [],
            createdAt: now,
            updatedAt: now,
          },
        ],
        activeSessionId: sessId,
        activeCategoryId: catId,
      };
    });
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    setState((s) => {
      const rest = s.sessions.filter((x) => x.id !== sessionId);
      if (rest.length === 0) {
        const catId = s.activeCategoryId ?? s.categories[0]?.id;
        if (!catId) return s;
        const sid = newId();
        const now = Date.now();
        const fresh: ExpressionSession = {
          id: sid,
          categoryId: catId,
          title: "新对话",
          messages: [],
          createdAt: now,
          updatedAt: now,
        };
        return { ...s, sessions: [fresh], activeSessionId: sid };
      }
      let activeSessionId = s.activeSessionId;
      if (activeSessionId === sessionId) {
        const sameCat = rest
          .filter((x) => x.categoryId === s.activeCategoryId)
          .sort((a, b) => b.updatedAt - a.updatedAt);
        activeSessionId =
          sameCat[0]?.id ??
          rest.sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ??
          null;
      }
      return { ...s, sessions: rest, activeSessionId };
    });
  }, []);

  const renameSession = useCallback((sessionId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setState((s) => ({
      ...s,
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, title: trimmed } : sess,
      ),
    }));
  }, []);

  return {
    hydrated,
    state,
    activeSession,
    messages: activeSession?.messages ?? [],
    setMessages,
    selectCategory,
    selectSession,
    addCategory,
    renameCategory,
    deleteCategory,
    addSession,
    deleteSession,
    renameSession,
  };
}

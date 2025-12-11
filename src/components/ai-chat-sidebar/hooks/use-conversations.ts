"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ConversationRecord,
  ConversationSummary,
  deleteConversation as deleteConversationRecord,
  getConversation,
  listConversations,
  saveConversation,
  SceneSnapshot,
} from "@/lib/storage/conversations";

const defaultName = () => {
  const now = new Date();
  const date = now.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `Conversation ${date} ${time}`;
};

const emptyConversation = (): ConversationRecord => ({
  id: crypto.randomUUID(),
  name: defaultName(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
  messages: [],
  draft: "",
  snapshots: {},
});

export function useConversations() {
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [current, setCurrent] = useState<ConversationRecord | null>(null);

  // Load initial data from IndexedDB
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listConversations();
        if (cancelled) return;

        if (list.length === 0) {
          const fresh = emptyConversation();
          await saveConversation(fresh);
          if (cancelled) return;
          setConversations([{ id: fresh.id, name: fresh.name, createdAt: fresh.createdAt, updatedAt: fresh.updatedAt }]);
          setCurrent(fresh);
        } else {
          const first = list[0];
          const data = await getConversation(first.id);
          if (cancelled) return;
          setConversations(list);
          setCurrent(data || null);
        }
      } catch (err) {
        console.error("[useConversations] failed to load", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshList = useCallback(async (selectedId?: string) => {
    const list = await listConversations();
    setConversations(list);
    if (selectedId) {
      const data = await getConversation(selectedId);
      setCurrent(data || null);
    }
  }, []);

  const selectConversation = useCallback(async (id: string) => {
    try {
      const data = await getConversation(id);
      if (data) {
        setCurrent(data);
        await refreshList(id);
      }
    } catch (err) {
      console.error("[useConversations] select failed", err);
    }
  }, [refreshList]);

  const createConversation = useCallback(async () => {
    const conv = emptyConversation();
    await saveConversation(conv);
    setCurrent(conv);
    await refreshList(conv.id);
  }, [refreshList]);

  const renameConversation = useCallback(async (id: string, name: string) => {
    const data = await getConversation(id);
    if (!data) return;
    const updated: ConversationRecord = { ...data, name, updatedAt: Date.now() };
    await saveConversation(updated);
    setCurrent((prev) => (prev?.id === id ? updated : prev));
    await refreshList(id);
  }, [refreshList]);

  const deleteConversation = useCallback(async (id: string) => {
    await deleteConversationRecord(id);
    const list = await listConversations();
    setConversations(list);
    if (current?.id === id) {
      const next = list[0];
      if (next) {
        const data = await getConversation(next.id);
        setCurrent(data || null);
      } else {
        const fresh = emptyConversation();
        await saveConversation(fresh);
        setConversations([{ id: fresh.id, name: fresh.name, createdAt: fresh.createdAt, updatedAt: fresh.updatedAt }]);
        setCurrent(fresh);
      }
    }
  }, [current?.id]);

  const cloneConversation = useCallback(async (id: string) => {
    const data = await getConversation(id);
    if (!data) return;
    const cloned: ConversationRecord = {
      ...data,
      id: crypto.randomUUID(),
      name: `${data.name} (copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveConversation(cloned);
    setCurrent(cloned);
    await refreshList(cloned.id);
  }, [refreshList]);

  const persistConversation = useCallback(async (payload: {
    id: string;
    messages: any[];
    draft: string;
    snapshots: Record<string, SceneSnapshot>;
  }) => {
    const { id, messages, draft, snapshots } = payload;
    const base = await getConversation(id);
    const record: ConversationRecord = base || {
      id,
      name: defaultName(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      draft: "",
      snapshots: {},
    };
    const updated: ConversationRecord = {
      ...record,
      messages,
      draft,
      snapshots,
      updatedAt: Date.now(),
    };
    await saveConversation(updated);
    setCurrent((prev) => (prev?.id === id ? updated : prev));
    setConversations((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, name: updated.name, updatedAt: updated.updatedAt } : c))
        .sort((a, b) => b.updatedAt - a.updatedAt)
    );
  }, []);

  const currentSummary = useMemo(() => {
    if (!current) return null;
    const { id, name, createdAt, updatedAt } = current;
    return { id, name, createdAt, updatedAt };
  }, [current]);

  return {
    loading,
    conversations,
    current,
    currentSummary,
    createConversation,
    selectConversation,
    renameConversation,
    deleteConversation,
    cloneConversation,
    persistConversation,
  };
}

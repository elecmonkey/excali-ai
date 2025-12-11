"use client";

/**
 * IndexedDB-backed conversation storage.
 * Stores chat messages, drafts, and per-message scene snapshots.
 */

export type SceneSnapshot = { elements: any[]; files: any };

export type ConversationRecord = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  messages: any[];
  draft: string;
  snapshots: Record<string, SceneSnapshot>;
};

export type ConversationSummary = Pick<ConversationRecord, "id" | "name" | "createdAt" | "updatedAt">;

const DB_NAME = "excali-ai-conversations";
const DB_VERSION = 1;
const STORE_NAME = "conversations";

function ensureIndexedDB(): IDBFactory {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment.");
  }
  return indexedDB;
}

async function openDB(): Promise<IDBDatabase> {
  const idb = ensureIndexedDB();

  return await new Promise((resolve, reject) => {
    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const db = await openDB();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const items = (req.result || []) as ConversationRecord[];
      const summaries = items.map(({ id, name, createdAt, updatedAt }) => ({
        id,
        name,
        createdAt,
        updatedAt,
      }));
      summaries.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(summaries);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getConversation(id: string): Promise<ConversationRecord | null> {
  const db = await openDB();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);

    req.onsuccess = () => resolve((req.result as ConversationRecord) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveConversation(record: ConversationRecord): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ConversationSummary } from "@/lib/storage/conversations";

type Props = {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  conversations: ConversationSummary[];
  currentId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onClone: (id: string) => void;
};

export function ConversationsPanel({
  open,
  anchorRef,
  conversations,
  currentId,
  onClose,
  onSelect,
  onRename,
  onDelete,
  onClone,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [focusables, setFocusables] = useState<HTMLElement[]>([]);
  const PANEL_WIDTH = 400;

  // Collect focusable elements when panel opens or content changes
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const elements = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>('[data-focusable="true"]')
    ).filter((el) => !el.hasAttribute("disabled"));
    setFocusables(elements);
  }, [open, conversations, editingId]);

  // Handle outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current instanceof HTMLElement && anchorRef.current.contains(target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open, anchorRef, onClose]);

  // Track position relative to anchor
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      // Bias toward right edge so the panel opens near the button cluster on the right
      const left = Math.max(8, viewportWidth - PANEL_WIDTH - 8);
      const top = rect.bottom + 8;
      setPosition({ top, left });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef]);

  // Handle keyboard (Esc, Tab trap)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab" && focusables.length > 0) {
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (!active || active === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (!active || active === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, focusables, onClose]);

  // Autofocus first control when open
  useEffect(() => {
    if (!open) return;
    const first = focusables[0];
    if (first) first.focus();
  }, [open, focusables]);

  if (!open) return null;

  const handleRenameCommit = (id: string) => {
    const trimmed = draftName.trim();
    if (trimmed) {
      onRename(id, trimmed);
    }
    setEditingId(null);
    setDraftName("");
  };

  const panel = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed w-[400px] max-w-[95vw] bg-surface border border-muted shadow-xl rounded-lg p-3 z-[2000]"
      ref={panelRef}
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm font-semibold text-primary">Conversations</div>
        <button
          type="button"
          className="text-secondary hover:text-primary text-sm"
          onClick={onClose}
          aria-label="Close conversation manager"
          data-focusable="true"
        >
          ✕
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
        {conversations.map((conv) => {
          const isActive = conv.id === currentId;
          return (
            <div
              key={conv.id}
              className={`p-2 rounded border ${isActive ? "border-blue-400 bg-blue-50" : "border-muted bg-muted"} text-sm flex items-center gap-2`}
            >
              {editingId === conv.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    className="flex-1 text-sm px-2 py-1 rounded border border-muted bg-surface text-primary"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleRenameCommit(conv.id);
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setEditingId(null);
                        setDraftName("");
                      }
                    }}
                    data-focusable="true"
                    aria-label="Edit conversation name"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded bg-blue-500 text-white"
                    onClick={() => handleRenameCommit(conv.id)}
                    data-focusable="true"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 w-full">
                  <button
                    type="button"
                    className={`text-left flex-1 ${isActive ? "text-primary" : "text-secondary"} hover:text-primary`}
                    onClick={() => onSelect(conv.id)}
                    aria-pressed={isActive}
                    data-focusable="true"
                  >
                    <div className="font-medium truncate">{conv.name}</div>
                    <div className="text-[11px]">
                      {new Date(conv.updatedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </button>
                  <div className="flex flex-row gap-1 items-center">
                    <button
                      type="button"
                      className="h-7 w-7 inline-flex items-center justify-center rounded bg-white/60 text-primary border border-muted hover:bg-divider"
                      onClick={() => {
                        setEditingId(conv.id);
                        setDraftName(conv.name);
                      }}
                      data-focusable="true"
                      aria-label={`Rename ${conv.name}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="m10 21l4-4h8v4H10Zm-6-2h1.4l8.625-8.625l-1.4-1.4L4 17.6V19ZM18.3 8.925l-4.25-4.2l1.4-1.4q.575-.575 1.413-.575t1.412.575l1.4 1.4q.575.575.6 1.388t-.55 1.387L18.3 8.925ZM16.85 10.4L6.25 21H2v-4.25l10.6-10.6l4.25 4.25Zm-3.525-.725l-.7-.7l1.4 1.4l-.7-.7Z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="h-7 w-7 inline-flex items-center justify-center rounded bg-white/60 text-primary border border-muted hover:bg-divider"
                      onClick={() => onClone(conv.id)}
                      data-focusable="true"
                      aria-label={`Clone ${conv.name}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M9 18q-.825 0-1.412-.587T7 16V4q0-.825.588-1.412T9 2h9q.825 0 1.413.588T20 4v12q0 .825-.587 1.413T18 18zm0-2h9V4H9zm-4 6q-.825 0-1.412-.587T3 20V6h2v14h11v2zm4-6V4z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="h-7 w-7 inline-flex items-center justify-center rounded bg-white/60 text-red-600 border border-muted hover:bg-divider"
                      onClick={() => onDelete(conv.id)}
                      data-focusable="true"
                      aria-label={`Delete ${conv.name}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M7 6v13zm4.25 15H5V6H4V4h5V3h6v1h5v2h-1v4.3q-.425-.125-.987-.213T17 10V6H7v13h3.3q.15.525.4 1.038t.55.962M9 17h1q0-1.575.5-2.588L11 13.4V8H9zm4-5.75q.425-.275.963-.55T15 10.3V8h-2zM17 22q-2.075 0-3.537-1.463T12 17t1.463-3.537T17 12t3.538 1.463T22 17t-1.463 3.538T17 22m1.65-2.65l.7-.7l-1.85-1.85V14h-1v3.2z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {conversations.length === 0 && (
          <div className="text-xs text-secondary">No conversations yet.</div>
        )}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}

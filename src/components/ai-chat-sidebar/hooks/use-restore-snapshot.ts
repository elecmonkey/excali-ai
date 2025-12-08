"use client";

import { useCallback } from "react";

export function useRestoreSnapshot(onRestore: (id: string) => void) {
  const handleRestoreSnapshot = useCallback(
    (msgId: string) => {
      onRestore(msgId);
    },
    [onRestore]
  );

  return { handleRestoreSnapshot };
}

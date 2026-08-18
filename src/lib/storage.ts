"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Subscribe to `storage` events (other tabs) for a single key. */
function subscribeKey(key: string, onChange: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === null || e.key === key) onChange();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

/** Read a boolean flag stored as `"1"` in localStorage (SSR → serverSnapshot). */
export function useLocalFlag(key: string, serverSnapshot = true): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(
    (onChange) => subscribeKey(key, onChange),
    () => {
      try {
        return localStorage.getItem(key) === "1";
      } catch {
        return serverSnapshot;
      }
    },
    () => serverSnapshot
  );

  const setValue = useCallback(
    (next: boolean) => {
      try {
        if (next) localStorage.setItem(key, "1");
        else localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      // Notify same-tab listeners
      window.dispatchEvent(new StorageEvent("storage", { key }));
    },
    [key]
  );

  return [value, setValue];
}

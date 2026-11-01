"use client";

import { useCallback, useSyncExternalStore } from "react";

const NAME_KEY = "kp:name";
const VIEWER_KEY = "kp:viewer";
const listeners = new Set<() => void>();

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode: keep the value for this page only */
  }
}

let memoryName: string | null = null;

function getName(): string {
  return memoryName ?? safeGet(NAME_KEY) ?? "";
}

export function getViewerId(): string {
  let id = safeGet(VIEWER_KEY);
  if (!id) {
    id = crypto.randomUUID();
    safeSet(VIEWER_KEY, id);
  }
  return id;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** The client's first name, remembered on this device after they type it once. */
export function useViewerName() {
  const name = useSyncExternalStore(subscribe, getName, () => "");
  const setName = useCallback((value: string) => {
    const clean = value.trim().slice(0, 60);
    memoryName = clean;
    safeSet(NAME_KEY, clean);
    listeners.forEach((l) => l());
  }, []);
  return [name, setName] as const;
}

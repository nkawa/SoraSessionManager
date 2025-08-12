import { useCallback, useEffect, useState } from "react";

// localStorage 汎用ユーティリティ
export function setLocalStorage(key:string, value:any, ttlMs: number  = 1000 * 60 * 60 * 24):void {
  const item = { value, expiresAt: Date.now() + ttlMs };
  localStorage.setItem(key, JSON.stringify(item));
}

export function getLocalStorage(key:string): any | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const item = JSON.parse(raw);
    if (Date.now() > item.expiresAt) {
      localStorage.removeItem(key);
      return null; // 期限切れ
    }
    return item.value;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function useTTLStorage<T>(key: string, initial: T, ttlMs: number = 1000 * 60 * 60 * 24): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = getLocalStorage(key);
    if (v !== null) setValue(v);
  }, [key]);

  const save = useCallback((v: T) => {
    setValue(v);
    if (typeof window !== "undefined") setLocalStorage(key, v, ttlMs);
  }, [key, ttlMs]);

  return [value, save] as const;
}

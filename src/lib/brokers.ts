import { useCallback, useEffect, useState } from "react";
import { BROKERS } from "./types";

const STORAGE_KEY = "vita-trading:custom-brokers";

function readStored(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  } catch {
    return [];
  }
}

export function useBrokers() {
  const [custom, setCustom] = useState<string[]>([]);

  useEffect(() => {
    setCustom(readStored());
  }, []);

  const persist = useCallback((next: string[]) => {
    setCustom(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const addBroker = useCallback(
    (raw: string) => {
      const name = raw.trim();
      if (!name) return null;
      const exists = [...BROKERS, ...custom].some(
        (b) => b.toLowerCase() === name.toLowerCase(),
      );
      if (exists) return name;
      persist([...custom, name].sort((a, b) => a.localeCompare(b)));
      return name;
    },
    [custom, persist],
  );

  const removeBroker = useCallback(
    (name: string) => persist(custom.filter((b) => b !== name)),
    [custom, persist],
  );

  const brokers = [...BROKERS, ...custom];

  return { brokers, customBrokers: custom, addBroker, removeBroker };
}

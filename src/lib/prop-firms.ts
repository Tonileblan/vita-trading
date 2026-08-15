import { useCallback, useEffect, useState } from "react";
import { PROP_FIRMS } from "./types";

const STORAGE_KEY = "vita-trading:custom-prop-firms";

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

export function usePropFirms() {
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

  const addFirm = useCallback(
    (raw: string) => {
      const name = raw.trim();
      if (!name) return null;
      const exists = [...PROP_FIRMS, ...custom].some(
        (f) => f.toLowerCase() === name.toLowerCase(),
      );
      if (exists) return name;
      persist([...custom, name].sort((a, b) => a.localeCompare(b)));
      return name;
    },
    [custom, persist],
  );

  const removeFirm = useCallback(
    (name: string) => persist(custom.filter((f) => f !== name)),
    [custom, persist],
  );

  const firms = [...PROP_FIRMS, ...custom];

  return { firms, customFirms: custom, addFirm, removeFirm };
}

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

/** Directorio de sitios web oficiales de Prop Firms y Brokers */
export const PROP_FIRM_WEBSITES: Record<string, string> = {
  "alpha futures": "https://alphafutures.io",
  "apex trader funding": "https://apextraderfunding.com",
  "apex": "https://apextraderfunding.com",
  "blue guardian": "https://blueguardian.com",
  "blusky trading": "https://blusky.pro",
  "blusky": "https://blusky.pro",
  "bulenox": "https://bulenox.com",
  "e8 markets": "https://e8markets.com",
  "e8 funding": "https://e8markets.com",
  "earn2trade": "https://earn2trade.com",
  "elite trader funding": "https://elitetraderfunding.com",
  "fast track trading": "https://fasttracktrading.net",
  "ftmo": "https://ftmo.com",
  "funded next": "https://fundednext.com",
  "fundednext": "https://fundednext.com",
  "fundednext futures": "https://fundednext.com",
  "funding pips": "https://fundingpips.com",
  "goat funded trader": "https://goatfundedtrader.com",
  "ic markets": "https://icmarkets.com",
  "legends trading": "https://legendstrading.com",
  "lucid trading": "https://lucidtrading.com",
  "lucid": "https://lucidtrading.com",
  "myfundedfutures": "https://myfundedfutures.com",
  "my funded futures": "https://myfundedfutures.com",
  "myfunded fx": "https://myfundedfx.com",
  "myfundedfx": "https://myfundedfx.com",
  "nova funding": "https://nova-funding.com",
  "ofp funding": "https://ofpfunding.com",
  "phidias propfirm": "https://phidiaspropfirm.com",
  "phidias": "https://phidiaspropfirm.com",
  "prop number one": "https://propnumberone.com",
  "purdia capital": "https://purdiacapital.com",
  "purdia": "https://purdiacapital.com",
  "take profit trader": "https://takeprofittrader.com",
  "the5ers": "https://the5ers.com",
  "the 5ers": "https://the5ers.com",
  "topstep": "https://topstep.com",
  "tradeday": "https://tradeday.com",
  "tradeify": "https://tradeify.co",
  "traders with edge": "https://traderswithedge.com",
  "uprofit": "https://uprofit.com",
  "uprofit trader": "https://uprofit.com",
  "wall street funded": "https://wallstreetfunded.com",
  // Brokers
  "amp futures": "https://ampfutures.com",
  "interactive brokers": "https://interactivebrokers.com",
  "ninjatrader": "https://ninjatrader.com",
  "ninjatrader brokerage": "https://ninjatrader.com",
  "tradovate": "https://tradovate.com",
  "phillip capital": "https://phillipcapital.com",
};

/** Obtiene el enlace web oficial a partir del nombre de la firma o broker */
export function getFirmWebsite(rawName?: string | null): string | null {
  if (!rawName) return null;
  const trimmed = rawName.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();

  // Coincidencia exacta
  if (PROP_FIRM_WEBSITES[lower]) {
    return PROP_FIRM_WEBSITES[lower];
  }

  // Coincidencia por subcadena
  for (const [key, url] of Object.entries(PROP_FIRM_WEBSITES)) {
    if (lower.includes(key) || key.includes(lower)) {
      return url;
    }
  }

  // Si tiene formato de dominio (ej. mi-firma.com o myprop.io)
  if (/\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  const cleanDomain = lower.replace(/[^a-z0-9]/g, "");
  if (cleanDomain.length > 2) {
    return `https://www.${cleanDomain}.com`;
  }

  return null;
}

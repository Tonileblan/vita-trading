import { createServerFn } from "@tanstack/react-start";

type Quote = {
  price: number | null;
  previousClose: number | null;
  volume: number | null;
  time: number | null;
};

async function yahooQuote(symbol: string): Promise<Quote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Yahoo ${symbol}: ${res.status}`);
  const json = (await res.json()) as {
    chart?: { result?: Array<{ meta?: Record<string, number> }> };
  };
  const meta = json.chart?.result?.[0]?.meta ?? {};
  return {
    price: meta["regularMarketPrice"] ?? null,
    previousClose: meta["chartPreviousClose"] ?? null,
    volume: meta["regularMarketVolume"] ?? null,
    time: meta["regularMarketTime"] ?? null,
  };
}

/** VXN (volatilidad Nasdaq 100) y volumen del día del futuro NQ. */
export const getMarketPulse = createServerFn({ method: "GET" }).handler(async () => {
  const [vxn, nq] = await Promise.all([yahooQuote("^VXN"), yahooQuote("NQ=F")]);
  return {
    vxn: {
      value: vxn.price,
      change:
        vxn.price != null && vxn.previousClose ? vxn.price - vxn.previousClose : null,
      changePct:
        vxn.price != null && vxn.previousClose
          ? ((vxn.price - vxn.previousClose) / vxn.previousClose) * 100
          : null,
    },
    volume: {
      symbol: "NQ",
      value: nq.volume,
      price: nq.price,
    },
    updatedAt: Date.now(),
  };
});

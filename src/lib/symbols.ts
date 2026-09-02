/**
 * Diccionario y utilidades para normalización y especificaciones de instrumentos financieros
 */

export interface InstrumentSpec {
  symbol: string;
  name: string;
  category: "futures" | "forex" | "crypto" | "stocks" | "indices";
  pointValue: number; // Valor de 1 punto entero en USD
  tickSize: number; // Tamaño mínimo de tick
  tickValue: number; // Valor en USD de 1 tick mínimo
  defaultRisk?: number;
}

export const INSTRUMENT_SPECS: Record<string, InstrumentSpec> = {
  MNQ: {
    symbol: "MNQ",
    name: "Micro E-mini Nasdaq 100",
    category: "futures",
    pointValue: 2,
    tickSize: 0.25,
    tickValue: 0.5,
  },
  NQ: {
    symbol: "NQ",
    name: "E-mini Nasdaq 100",
    category: "futures",
    pointValue: 20,
    tickSize: 0.25,
    tickValue: 5,
  },
  MES: {
    symbol: "MES",
    name: "Micro E-mini S&P 500",
    category: "futures",
    pointValue: 5,
    tickSize: 0.25,
    tickValue: 1.25,
  },
  ES: {
    symbol: "ES",
    name: "E-mini S&P 500",
    category: "futures",
    pointValue: 50,
    tickSize: 0.25,
    tickValue: 12.5,
  },
  MGC: {
    symbol: "MGC",
    name: "Micro Gold (Oro)",
    category: "futures",
    pointValue: 10,
    tickSize: 0.1,
    tickValue: 1,
  },
  GC: {
    symbol: "GC",
    name: "Gold (Oro)",
    category: "futures",
    pointValue: 100,
    tickSize: 0.1,
    tickValue: 10,
  },
  MCL: {
    symbol: "MCL",
    name: "Micro WTI Crude Oil (Petróleo)",
    category: "futures",
    pointValue: 100,
    tickSize: 0.01,
    tickValue: 1,
  },
  CL: {
    symbol: "CL",
    name: "Crude Oil (Petróleo)",
    category: "futures",
    pointValue: 1000,
    tickSize: 0.01,
    tickValue: 10,
  },
  MYM: {
    symbol: "MYM",
    name: "Micro Dow Jones",
    category: "futures",
    pointValue: 0.5,
    tickSize: 1,
    tickValue: 0.5,
  },
  YM: {
    symbol: "YM",
    name: "Dow Jones",
    category: "futures",
    pointValue: 5,
    tickSize: 1,
    tickValue: 5,
  },
  M2K: {
    symbol: "M2K",
    name: "Micro Russell 2000",
    category: "futures",
    pointValue: 5,
    tickSize: 0.1,
    tickValue: 0.5,
  },
  RTY: {
    symbol: "RTY",
    name: "Russell 2000",
    category: "futures",
    pointValue: 50,
    tickSize: 0.1,
    tickValue: 5,
  },
  FDAX: {
    symbol: "FDAX",
    name: "DAX 40 Futuros",
    category: "futures",
    pointValue: 25,
    tickSize: 1,
    tickValue: 25,
  },
  FDXM: {
    symbol: "FDXM",
    name: "Mini DAX Futuros",
    category: "futures",
    pointValue: 5,
    tickSize: 1,
    tickValue: 5,
  },
  BTC: {
    symbol: "BTC",
    name: "Bitcoin / USD",
    category: "crypto",
    pointValue: 1,
    tickSize: 0.01,
    tickValue: 0.01,
  },
  ETH: {
    symbol: "ETH",
    name: "Ethereum / USD",
    category: "crypto",
    pointValue: 1,
    tickSize: 0.01,
    tickValue: 0.01,
  },
  EURUSD: {
    symbol: "EURUSD",
    name: "Euro / Dólar USA",
    category: "forex",
    pointValue: 100000,
    tickSize: 0.00001,
    tickValue: 1,
  },
  GBPUSD: {
    symbol: "GBPUSD",
    name: "Libra / Dólar USA",
    category: "forex",
    pointValue: 100000,
    tickSize: 0.00001,
    tickValue: 1,
  },
};

/**
 * Normaliza cualquier variante de símbolo de ticker a su formato estándar de Vita-Trading
 */
export function normalizeSymbol(sym?: string | null): string {
  if (!sym) return "MNQ";
  const s = sym.toUpperCase().trim();

  // Oro
  if (
    s.startsWith("GCM") ||
    s === "GC" ||
    s.startsWith("MGC") ||
    s.includes("GOLD") ||
    s.includes("XAU") ||
    s.includes("ORO")
  ) {
    return s.startsWith("GC") && !s.startsWith("GCM") && !s.includes("MICRO") ? "GC" : "MGC";
  }

  // Nasdaq
  if (s.startsWith("MNQ") || s.includes("MICRO NASDAQ") || s.includes("MICRO NQ")) {
    return "MNQ";
  }
  if (s.startsWith("NQ") || s.includes("E-MINI NASDAQ") || s.includes("EMINI NQ")) {
    return "NQ";
  }

  // S&P 500
  if (s.startsWith("MES") || s.includes("MICRO S&P") || s.includes("MICRO SP")) {
    return "MES";
  }
  if (s.startsWith("ES") || s.includes("E-MINI S&P") || s.includes("EMINI SP")) {
    return "ES";
  }

  // Petróleo
  if (s.startsWith("MCL") || s.includes("MICRO CRUDE") || s.includes("MICRO OIL")) {
    return "MCL";
  }
  if (s.startsWith("CL") || s.includes("CRUDE OIL") || s.includes("WTI")) {
    return "CL";
  }

  // Dow Jones
  if (s.startsWith("MYM") || s.includes("MICRO DOW") || s.includes("MICRO YM")) {
    return "MYM";
  }
  if (s.startsWith("YM") || s.includes("DOW JONES") || s.includes("MINI DOW")) {
    return "YM";
  }

  // Russell 2000
  if (s.startsWith("M2K") || s.includes("MICRO RUSSELL")) {
    return "M2K";
  }
  if (s.startsWith("RTY") || s.includes("RUSSELL 2000")) {
    return "RTY";
  }

  // DAX
  if (s.startsWith("FDXM") || s.includes("MINI DAX")) {
    return "FDXM";
  }
  if (s.startsWith("FDAX") || s.startsWith("DAX")) {
    return "FDAX";
  }

  // Crypto
  if (s.startsWith("BTC") || s.includes("BITCOIN")) return "BTC";
  if (s.startsWith("ETH") || s.includes("ETHEREUM")) return "ETH";
  if (s.startsWith("SOL") || s.includes("SOLANA")) return "SOL";

  // Forex
  if (s.includes("EUR") && s.includes("USD")) return "EURUSD";
  if (s.includes("GBP") && s.includes("USD")) return "GBPUSD";
  if (s.includes("USD") && s.includes("JPY")) return "USDJPY";

  // Limpiar cualquier carácter no alfanumérico si no coincide
  const clean = s.replace(/[^A-Z0-9]/g, "");
  return clean || "MNQ";
}

/**
 * Obtiene la especificación de un instrumento o genera un fallback si es desconocido
 */
export function getInstrumentSpec(symbol: string): InstrumentSpec {
  const norm = normalizeSymbol(symbol);
  if (INSTRUMENT_SPECS[norm]) {
    return INSTRUMENT_SPECS[norm];
  }
  return {
    symbol: norm,
    name: norm,
    category: "futures",
    pointValue: 1,
    tickSize: 0.01,
    tickValue: 0.01,
  };
}

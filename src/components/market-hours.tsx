import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, Clock, RefreshCw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMarketPulse } from "@/lib/market-data.functions";
import { cn } from "@/lib/utils";


const ZONES = [
  "Europe/Madrid",
  "Europe/London",
  "Europe/Lisbon",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Bogota",
  "America/Mexico_City",
  "America/Argentina/Buenos_Aires",
  "Asia/Tokyo",
  "Asia/Dubai",
  "Australia/Sydney",
  "UTC",
];

const SESSIONS = [
  { name: "Asia (Tokio)", zone: "Asia/Tokyo", start: [9, 0], end: [15, 0], accent: "text-brand" },
  {
    name: "Europa (Londres)",
    zone: "Europe/London",
    start: [8, 0],
    end: [16, 30],
    accent: "text-profit",
  },
  {
    name: "Nueva York",
    zone: "America/New_York",
    start: [9, 30],
    end: [16, 0],
    accent: "text-loss",
  },
] as const;

/** Desplazamiento (minutos) de una zona respecto a UTC en un instante dado. */
function zoneOffset(date: Date, zone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(
    Number(p["year"]),
    Number(p["month"]) - 1,
    Number(p["day"]),
    Number(p["hour"]) === 24 ? 0 : Number(p["hour"]),
    Number(p["minute"]),
    Number(p["second"]),
  );
  return (asUtc - date.getTime()) / 60000;
}

/** Instante UTC de una hora local (hh:mm) del día "hoy" en la zona indicada. */
function sessionInstant(ref: Date, zone: string, hh: number, mm: number) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(ref)
      .map((x) => [x.type, x.value]),
  );
  const naive = Date.UTC(Number(p["year"]), Number(p["month"]) - 1, Number(p["day"]), hh, mm);
  let guess = new Date(naive - zoneOffset(ref, zone) * 60000);
  guess = new Date(naive - zoneOffset(guess, zone) * 60000);
  return guess;
}

function fmt(date: Date, zone: string) {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function offsetLabel(date: Date, zone: string) {
  const min = zoneOffset(date, zone);
  const sign = min < 0 ? "-" : "+";
  const abs = Math.abs(min);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

export function MarketHours() {
  const [zone, setZone] = useState("UTC");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) setZone(detected);
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const fetchPulse = useServerFn(getMarketPulse);
  const [pulse, setPulse] = useState<Awaited<ReturnType<typeof getMarketPulse>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setPulse(await fetchPulse({}));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [fetchPulse]);

  useEffect(() => {
    void refresh();
  }, [refresh]);


  const zoneOptions = useMemo(
    () => Array.from(new Set([zone, ...ZONES])).filter(Boolean),
    [zone],
  );

  const rows = useMemo(
    () =>
      SESSIONS.map((s) => {
        const start = sessionInstant(now, s.zone, s.start[0], s.start[1]);
        const end = sessionInstant(now, s.zone, s.end[0], s.end[1]);
        const open = now >= start && now <= end;
        return { ...s, start, end, open };
      }),
    [now],
  );

  return (
    <section className="panel space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          <h2 className="font-display text-xl tracking-wide">Horario de sesiones</h2>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
          <Label className="text-xs text-muted-foreground">Tu zona horaria</Label>
          <Select value={zone} onValueChange={setZone}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {zoneOptions.map((z) => (
                <SelectItem key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Hora local {fmt(now, zone)} · {offsetLabel(now, zone)}
      </p>

      <div className="grid gap-2 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.name} className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span className={cn("text-xs font-semibold uppercase tracking-wide", r.accent)}>
                {r.name}
              </span>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] uppercase",
                  r.open ? "border-profit text-profit" : "text-muted-foreground",
                )}
              >
                {r.open ? "abierta" : "cerrada"}
              </span>
            </div>
            <p className="mt-1 font-display text-2xl tracking-wide">
              {fmt(r.start, zone)} – {fmt(r.end, zone)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Local del mercado: {fmt(r.start, r.zone)} – {fmt(r.end, r.zone)} ({r.zone})
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Volatilidad
          </span>
          <span className="font-display text-xl tracking-wide tabular-nums">
            {pulse?.vxn.value != null ? pulse.vxn.value.toFixed(2) : error ? "—" : "…"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Volumen
          </span>
          <span className="font-display text-xl tracking-wide tabular-nums">
            {pulse?.volume.value != null
              ? new Intl.NumberFormat("es-ES").format(pulse.volume.value)
              : error
                ? "—"
                : "…"}
          </span>
        </div>

        <Button variant="outline" size="icon" onClick={() => void refresh()} disabled={loading} aria-label="Actualizar">
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
        </Button>
      </div>

    </section>
  );
}

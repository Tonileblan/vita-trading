import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function EquityChart({
  data,
}: {
  data: { index: number; date: string; equity: number; drawdownFloor?: number | undefined }[];
}) {
  const hasDrawdown = data.some((d) => d.drawdownFloor !== undefined);

  // Escala dinámica del eje Y para que la curva muestre relieve real y no quede plana
  const { minVal, maxVal } = useMemo(() => {
    if (!data || data.length === 0) return { minVal: 0, maxVal: 100 };
    let min = Infinity;
    let max = -Infinity;
    for (const d of data) {
      if (typeof d.equity === "number" && !isNaN(d.equity)) {
        if (d.equity < min) min = d.equity;
        if (d.equity > max) max = d.equity;
      }
      if (typeof d.drawdownFloor === "number" && !isNaN(d.drawdownFloor)) {
        if (d.drawdownFloor < min) min = d.drawdownFloor;
        if (d.drawdownFloor > max) max = d.drawdownFloor;
      }
    }
    if (!isFinite(min) || !isFinite(max)) return { minVal: 0, maxVal: 100 };
    if (min === max) {
      const pad = Math.max(Math.abs(min) * 0.05, 100);
      return { minVal: Math.floor(min - pad), maxVal: Math.ceil(max + pad) };
    }
    const padding = Math.max((max - min) * 0.12, 50);
    return {
      minVal: Math.floor(min - padding),
      maxVal: Math.ceil(max + padding),
    };
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-[320px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/10 p-6 text-center text-muted-foreground">
        <p className="text-sm font-medium">Sin operaciones para generar la curva</p>
        <p className="text-xs text-muted-foreground/80 mt-1">
          Registra operaciones o cambia el filtro para ver la evolución del capital.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
          />
          <YAxis
            domain={[minVal, maxVal]}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => {
              if (Math.abs(v) >= 1000) {
                const k = v / 1000;
                return `$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
              }
              return `$${Math.round(v)}`;
            }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-popover)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
            labelStyle={{
              color: "var(--color-muted-foreground)",
              fontWeight: 600,
              marginBottom: 4,
            }}
            formatter={(v: number, name: string) => {
              const formatted = `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              if (name === "drawdownFloor" || name === "Límite Drawdown") {
                return [formatted, "Límite Drawdown (Suelo)"];
              }
              return [formatted, "Capital (Equity)"];
            }}
          />
          {/* Area de curva de capital */}
          <Area
            type="monotone"
            name="equity"
            dataKey="equity"
            stroke="var(--color-brand)"
            strokeWidth={2.5}
            fill="url(#equityFill)"
          />
          {hasDrawdown && (
            <Line
              type="monotone"
              name="drawdownFloor"
              dataKey="drawdownFloor"
              stroke="#ef4444"
              strokeDasharray="5 5"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

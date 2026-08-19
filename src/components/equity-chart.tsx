import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
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

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={75}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-popover)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
            labelStyle={{ color: "var(--color-muted-foreground)", fontWeight: 600, marginBottom: 4 }}
            formatter={(v: number, name: string) => {
              const formatted = `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              if (name === "drawdownFloor" || name === "Límite Drawdown") {
                return [formatted, "Límite Drawdown (Suelo)"];
              }
              return [formatted, "Capital (Equity)"];
            }}
          />
          {hasDrawdown && (
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: 8, fontSize: 11 }}
              formatter={(value) => (
                <span className="text-xs font-semibold text-muted-foreground">
                  {value === "equity" ? "Curva de Capital" : "Límite Drawdown (Fondeo)"}
                </span>
              )}
            />
          )}
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
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

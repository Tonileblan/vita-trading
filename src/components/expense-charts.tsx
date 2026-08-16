import { byCategory, monthlySeries, type Occurrence } from "@/lib/expense-metrics";
import { categoryColor, categoryLabel } from "@/lib/expenses";
import { formatCurrency } from "@/lib/metrics";

const CX = 110;
const CY = 92;
const RX = 96;
const RY = 42;
const DEPTH = 20;

/** Punto sobre la elipse (proyección 3D del círculo). */
const pt = (a: number) => ({ x: CX + RX * Math.cos(a), y: CY + RY * Math.sin(a) });

/** Oscurece un color hex para el lateral extruido de la tarta. */
function shade(hex: string, factor: number) {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `rgb(${r},${g},${b})`;
}

interface Slice {
  category: string;
  amount: number;
  pct: number;
  start: number;
  end: number;
  color: string;
}

function topPath(s: Slice) {
  const a = pt(s.start);
  const b = pt(s.end);
  const large = s.end - s.start > Math.PI ? 1 : 0;
  return `M ${CX} ${CY} L ${a.x} ${a.y} A ${RX} ${RY} 0 ${large} 1 ${b.x} ${b.y} Z`;
}

/** Lateral visible: solo la parte del arco que cae en la mitad frontal (0..π). */
function sidePath(s: Slice) {
  const start = Math.max(s.start, 0);
  const end = Math.min(s.end, Math.PI);
  if (end <= start) return null;
  const a = pt(start);
  const b = pt(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${a.x} ${a.y} A ${RX} ${RY} 0 ${large} 1 ${b.x} ${b.y} L ${b.x} ${b.y + DEPTH} A ${RX} ${RY} 0 ${large} 0 ${a.x} ${a.y + DEPTH} Z`;
}

/** Tarta en 3D por categoría y barras por mes. */
export function ExpenseCharts({ occurrences }: { occurrences: Occurrence[] }) {
  const cats = byCategory(occurrences);
  const total = cats.reduce((s, c) => s + c.amount, 0);
  const series = monthlySeries(occurrences, 12);
  const max = Math.max(...series.map((s) => s.amount), 1);

  let cursor = -Math.PI / 2;
  const slices: Slice[] = cats.map((c) => {
    const share = total ? c.amount / total : 0;
    const start = cursor;
    const end = cursor + share * Math.PI * 2;
    cursor = end;
    return {
      category: c.category,
      amount: c.amount,
      pct: share * 100,
      start,
      end,
      color: categoryColor(c.category),
    };
  });

  // Normalizamos los ángulos al rango [-π/2, 3π/2) para pintar los laterales.
  const sideSlices = slices.flatMap((s) => {
    const norm = (v: number) => ((v + Math.PI * 2) % (Math.PI * 2));
    const a = norm(s.start);
    const b = norm(s.end);
    if (b < a) {
      return [
        { ...s, start: a, end: Math.PI * 2 },
        { ...s, start: 0, end: b },
      ];
    }
    return [{ ...s, start: a, end: b }];
  });

  return (
    <section className="panel p-4">
      <h2 className="text-xl leading-none">Gráficos de gastos</h2>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Por categoría</p>
          {total === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Sin gastos en este periodo.</p>
          ) : (
            <div className="mt-2 flex flex-col items-center gap-4 sm:flex-row">
              <svg viewBox="0 0 220 165" className="w-full max-w-[240px] shrink-0">
                <ellipse cx={CX} cy={CY + DEPTH + 6} rx={RX} ry={RY * 0.5} fill="rgba(0,0,0,0.18)" />
                {sideSlices.map((s, i) => {
                  const d = sidePath(s);
                  return d ? <path key={`s${i}`} d={d} fill={shade(s.color, 0.6)} /> : null;
                })}
                {slices.map((s) => (
                  <path
                    key={s.category}
                    d={topPath(s)}
                    fill={s.color}
                    stroke="rgba(0,0,0,0.25)"
                    strokeWidth={0.75}
                  >
                    <title>{`${categoryLabel(s.category)}: ${formatCurrency(s.amount)}`}</title>
                  </path>
                ))}
              </svg>

              <ul className="w-full space-y-1.5">
                {slices.map((s) => (
                  <li key={s.category} className="flex items-center gap-2 text-sm">
                    <span
                      className="size-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="truncate">{categoryLabel(s.category)}</span>
                    <span className="num ml-auto text-muted-foreground">
                      {formatCurrency(s.amount)} · {s.pct.toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Por mes</p>
          {(() => {
            const W = 440;
            const H = 250;
            const L = 52;
            const R = 14;
            const T = 16;
            const B = 34;
            const D = 9; // profundidad 3D
            const plotW = W - L - R - D;
            const plotH = H - T - B - D;
            const step = plotW / series.length;
            const bw = step * 0.58;
            const ticks = 5;
            const niceMax = max + 200;
            const tickStep = niceMax / ticks;
            const y = (v: number) => T + D + plotH - (v / niceMax) * plotH;

            return (
              <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full overflow-visible">
                <defs>
                  <linearGradient id="barFront" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity="0.6" />
                  </linearGradient>
                  <linearGradient id="barSide" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity="0.25" />
                  </linearGradient>
                  <linearGradient id="barTop" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity="1" />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity="0.8" />
                  </linearGradient>
                  <linearGradient id="plotBg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--muted)" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="var(--muted)" stopOpacity="0.05" />
                  </linearGradient>
                </defs>

                {/* superficie del plot */}
                <rect
                  x={L + D}
                  y={T}
                  width={plotW}
                  height={plotH}
                  fill="url(#plotBg)"
                  rx={3}
                />
                {/* suelo en perspectiva */}
                <polygon
                  points={`${L},${T + plotH + D + D} ${L + D},${T + plotH + D} ${L + D + plotW},${T + plotH + D} ${L + plotW},${T + plotH + D + D}`}
                  fill="var(--muted)"
                  opacity={0.35}
                />
                {/* pared izquierda */}
                <polygon
                  points={`${L},${T + D} ${L + D},${T} ${L + D},${T + plotH + D} ${L},${T + plotH + D + D}`}
                  fill="var(--muted)"
                  opacity={0.18}
                />

                {/* líneas guía + etiquetas */}
                {Array.from({ length: ticks + 1 }, (_, i) => {
                  const v = tickStep * i;
                  const yy = y(v);
                  const baseline = i === 0;
                  return (
                    <g key={i}>
                      <line
                        x1={L + D}
                        x2={L + D + plotW}
                        y1={yy}
                        y2={yy}
                        stroke="var(--border)"
                        strokeWidth={baseline ? 1 : 0.75}
                        strokeDasharray={baseline ? undefined : "3 4"}
                        opacity={baseline ? 1 : 0.8}
                      />
                      <line
                        x1={L}
                        x2={L + D}
                        y1={yy + D}
                        y2={yy}
                        stroke="var(--border)"
                        strokeWidth={0.6}
                        opacity={0.7}
                      />
                      <text
                        x={L - 8}
                        y={yy + D + 3.5}
                        textAnchor="end"
                        fontSize={9.5}
                        letterSpacing="0.04em"
                        fill="var(--muted-foreground)"
                      >
                        {Math.round(v).toLocaleString("es-ES")}
                      </text>
                    </g>
                  );
                })}

                {/* barras 3D */}
                {series.map((m, i) => {
                  const x = L + D + i * step + (step - bw) / 2;
                  const yTop = y(m.amount);
                  const base = T + D + plotH;
                  const h = base - yTop;
                  if (m.amount <= 0) {
                    return (
                      <text
                        key={m.key}
                        x={x + bw / 2}
                        y={H - 10}
                        textAnchor="middle"
                        fontSize={9.5}
                        letterSpacing="0.06em"
                        fill="var(--muted-foreground)"
                      >
                        {m.label.toUpperCase()}
                      </text>
                    );
                  }
                  return (
                    <g key={m.key} className="transition-opacity hover:opacity-90">
                      <title>{`${m.label}: ${formatCurrency(m.amount)}`}</title>
                      {/* sombra proyectada */}
                      <ellipse
                        cx={x + bw / 2 + D / 2}
                        cy={base + D * 0.7}
                        rx={bw * 0.62}
                        ry={D * 0.42}
                        fill="var(--foreground)"
                        opacity={0.08}
                      />
                      {/* cara superior */}
                      <polygon
                        points={`${x},${yTop} ${x + D},${yTop - D} ${x + bw + D},${yTop - D} ${x + bw},${yTop}`}
                        fill="url(#barTop)"
                      />
                      {/* lateral derecho */}
                      <polygon
                        points={`${x + bw},${yTop} ${x + bw + D},${yTop - D} ${x + bw + D},${base - D} ${x + bw},${base}`}
                        fill="url(#barSide)"
                      />
                      {/* cara frontal */}
                      <rect x={x} y={yTop} width={bw} height={h} fill="url(#barFront)" />
                      {/* brillo lateral */}
                      <rect
                        x={x}
                        y={yTop}
                        width={Math.min(2, bw / 6)}
                        height={h}
                        fill="var(--background)"
                        opacity={0.18}
                      />
                      <text
                        x={x + bw / 2 + D / 2}
                        y={yTop - D - 5}
                        textAnchor="middle"
                        fontSize={9}
                        fill="var(--foreground)"
                        opacity={0.75}
                      >
                        {Math.round(m.amount).toLocaleString("es-ES")}
                      </text>
                      <text
                        x={x + bw / 2}
                        y={H - 10}
                        textAnchor="middle"
                        fontSize={9.5}
                        letterSpacing="0.06em"
                        fill="var(--muted-foreground)"
                      >
                        {m.label.toUpperCase()}
                      </text>
                    </g>
                  );
                })}
              </svg>
            );
          })()}
        </div>

      </div>
    </section>
  );
}

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
            const niceMax = (() => {
              const raw = max / ticks;
              const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
              const norm = raw / mag;
              const unit = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
              return unit * ticks;
            })();
            const y = (v: number) => T + D + plotH - (v / niceMax) * plotH;

            return (
              <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full">
                {/* fondo del plot */}
                <polygon
                  points={`${L},${T} ${L + D},${T - 0} ${L + D},${T} ${L + D},${T}`}
                  fill="none"
                />
                <rect
                  x={L + D}
                  y={T}
                  width={plotW}
                  height={plotH + D}
                  fill="var(--card)"
                  stroke="var(--border)"
                />
                {/* pared lateral / suelo en perspectiva */}
                <polygon
                  points={`${L},${T + D} ${L + D},${T} ${L + D},${T + plotH + D} ${L},${T + plotH + D + D}`}
                  fill="var(--muted)"
                  opacity={0.5}
                  stroke="var(--border)"
                />
                <polygon
                  points={`${L},${T + plotH + D + D} ${L + D},${T + plotH + D} ${L + D + plotW},${T + plotH + D} ${L + plotW},${T + plotH + D + D}`}
                  fill="var(--muted)"
                  opacity={0.35}
                  stroke="var(--border)"
                />

                {/* líneas guía + etiquetas */}
                {Array.from({ length: ticks + 1 }, (_, i) => {
                  const v = (niceMax / ticks) * i;
                  const yy = y(v);
                  return (
                    <g key={i}>
                      <line
                        x1={L + D}
                        x2={L + D + plotW}
                        y1={yy}
                        y2={yy}
                        stroke="var(--border)"
                        strokeWidth={0.75}
                      />
                      <line
                        x1={L}
                        x2={L + D}
                        y1={yy + D}
                        y2={yy}
                        stroke="var(--border)"
                        strokeWidth={0.75}
                      />
                      <text
                        x={L - 6}
                        y={yy + D + 3.5}
                        textAnchor="end"
                        fontSize={10}
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
                        y={H - 12}
                        textAnchor="middle"
                        fontSize={10}
                        fill="var(--muted-foreground)"
                      >
                        {m.label}
                      </text>
                    );
                  }
                  return (
                    <g key={m.key}>
                      <title>{`${m.label}: ${formatCurrency(m.amount)}`}</title>
                      {/* cara superior */}
                      <polygon
                        points={`${x},${yTop} ${x + D},${yTop - D} ${x + bw + D},${yTop - D} ${x + bw},${yTop}`}
                        fill="var(--chart-2)"
                        opacity={0.9}
                        stroke="var(--border)"
                        strokeWidth={0.5}
                      />
                      {/* lateral derecho */}
                      <polygon
                        points={`${x + bw},${yTop} ${x + bw + D},${yTop - D} ${x + bw + D},${base - D} ${x + bw},${base}`}
                        fill="var(--chart-2)"
                        opacity={0.55}
                        stroke="var(--border)"
                        strokeWidth={0.5}
                      />
                      {/* cara frontal */}
                      <rect
                        x={x}
                        y={yTop}
                        width={bw}
                        height={h}
                        fill="var(--chart-2)"
                        stroke="var(--border)"
                        strokeWidth={0.5}
                      />
                      <text
                        x={x + bw / 2}
                        y={H - 12}
                        textAnchor="middle"
                        fontSize={10}
                        fill="var(--muted-foreground)"
                      >
                        {m.label}
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

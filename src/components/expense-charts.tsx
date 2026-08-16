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
          <div className="mt-4 flex h-44 items-end gap-1.5">
            {series.map((m) => (
              <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
                <span className="num text-[9px] text-muted-foreground">
                  {m.amount ? Math.round(m.amount) : ""}
                </span>
                <div
                  className="relative w-full"
                  style={{ height: `${Math.max((m.amount / max) * 100, m.amount ? 4 : 0)}%` }}
                  title={`${m.label}: ${formatCurrency(m.amount)}`}
                >
                  {m.amount > 0 && (
                    <>
                      {/* cara superior */}
                      <div className="absolute -top-[5px] left-[5px] h-[5px] w-full origin-bottom-left skew-x-[-45deg] bg-loss/90" />
                      {/* lateral derecho */}
                      <div className="absolute -right-[5px] top-[-5px] h-full w-[5px] origin-bottom-left skew-y-[-45deg] bg-loss/40" />
                      {/* cara frontal */}
                      <div className="absolute inset-0 bg-gradient-to-b from-loss/85 to-loss/45" />
                    </>
                  )}
                </div>
                <span className="text-[10px] uppercase text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

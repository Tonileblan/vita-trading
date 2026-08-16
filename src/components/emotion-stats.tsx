import { useMemo } from "react";
import {
  byCheckinLevel,
  groupBy,
  mistakeCost,
  type Bucket,
} from "@/lib/emotion-metrics";
import {
  emotionAfterLabel,
  emotionBeforeLabel,
  followedPlanLabel,
  mistakeLabel,
} from "@/lib/emotions";
import { formatCurrency } from "@/lib/metrics";
import type { MoodCheckin } from "@/lib/mood";
import type { Trade } from "@/lib/types";
import { cn } from "@/lib/utils";

function BucketList({ title, hint, rows }: { title: string; hint: string; rows: Bucket[] }) {
  return (
    <section className="panel space-y-3 p-4">
      <div>
        <h3 className="text-lg leading-none">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{r.label}</span>
              <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                <span>{r.trades} ops</span>
                <span>{r.winRate.toFixed(0)}% WR</span>
                <span
                  className={cn(
                    "num font-semibold",
                    r.pnl > 0 ? "text-profit" : r.pnl < 0 ? "text-loss" : "",
                  )}
                >
                  {formatCurrency(r.pnl, true)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function EmotionStats({
  trades,
  checkins,
}: {
  trades: Trade[];
  checkins: MoodCheckin[];
}) {
  const before = useMemo(
    () => groupBy(trades, (t) => t.emotionBefore, emotionBeforeLabel),
    [trades],
  );
  const after = useMemo(
    () => groupBy(trades, (t) => t.emotionAfter, emotionAfterLabel),
    [trades],
  );
  const plan = useMemo(
    () => groupBy(trades, (t) => t.followedPlan, (k) => `Seguí el plan: ${followedPlanLabel(k)}`),
    [trades],
  );
  const mistakes = useMemo(() => mistakeCost(trades, mistakeLabel), [trades]);
  const moodLevels = useMemo(() => byCheckinLevel(trades, checkins, "mood"), [trades, checkins]);
  const energyLevels = useMemo(
    () => byCheckinLevel(trades, checkins, "energy"),
    [trades, checkins],
  );

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <BucketList
        title="Emoción antes de entrar"
        hint="Qué estado te hace ganar y cuál te cuesta dinero"
        rows={before}
      />
      <BucketList title="Emoción después" hint="Cómo te deja cada resultado" rows={after} />
      <BucketList title="Disciplina" hint="Rendimiento según si seguiste el plan" rows={plan} />
      <BucketList
        title="Coste de los errores"
        hint="Cuánto te ha costado cada error marcado"
        rows={mistakes}
      />
      <BucketList title="Según tu ánimo" hint="Rendimiento por nivel del check-in" rows={moodLevels} />
      <BucketList
        title="Según tu energía"
        hint="Rendimiento por nivel del check-in"
        rows={energyLevels}
      />
    </div>
  );
}

/** Resumen compacto para el panel principal. */
export function EmotionHighlights({ trades }: { trades: Trade[] }) {
  const before = useMemo(
    () => groupBy(trades, (t) => t.emotionBefore, emotionBeforeLabel).filter((b) => b.trades >= 2),
    [trades],
  );
  const mistakes = useMemo(() => mistakeCost(trades, mistakeLabel), [trades]);
  if (before.length === 0 && mistakes.length === 0) return null;

  const best = before[0];
  const worst = before.length > 1 ? before[before.length - 1] : undefined;
  const costliest = mistakes[0];

  return (
    <section className="panel grid gap-3 p-4 sm:grid-cols-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Mejor estado
        </p>
        <p className="mt-1 text-sm font-semibold">{best ? best.label : "—"}</p>
        {best && (
          <p className="num text-xs text-profit">{formatCurrency(best.pnl, true)}</p>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Peor estado
        </p>
        <p className="mt-1 text-sm font-semibold">{worst ? worst.label : "—"}</p>
        {worst && <p className="num text-xs text-loss">{formatCurrency(worst.pnl, true)}</p>}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Error más caro
        </p>
        <p className="mt-1 text-sm font-semibold">{costliest ? costliest.label : "—"}</p>
        {costliest && (
          <p className="num text-xs text-loss">{formatCurrency(costliest.pnl, true)}</p>
        )}
      </div>
    </section>
  );
}

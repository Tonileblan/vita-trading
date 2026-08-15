import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ChatThread } from "@/components/chat-thread";
import { EquityChart } from "@/components/equity-chart";
import { KpiCards } from "@/components/kpi-cards";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toTrade } from "@/lib/journal-store";
import { buildEquityCurve, computeMetrics, formatCurrency } from "@/lib/metrics";
import type { Trade } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/supervision")({
  beforeLoad: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const list = (roles ?? []).map((r) => r.role as string);
    if (!list.includes("admin") && !list.includes("supervisor")) {
      throw redirect({ to: "/panel" });
    }
  },
  head: () => ({
    meta: [
      { title: "Supervisión — Vita-Trading" },
      {
        name: "description",
        content:
          "Resumen de resultados de cada usuario y chat interno privado entre supervisor y trader.",
      },
      { property: "og:title", content: "Supervisión — Vita-Trading" },
      {
        property: "og:description",
        content: "Métricas por usuario y comentarios privados en un solo lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupervisionPage,
});

interface ProfileRow {
  id: string;
  display_name: string | null;
  created_at: string;
}

function SupervisionPage() {
  const { isSupervisor } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ["sv-profiles"],
    enabled: isSupervisor,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const { data: trades = [], isLoading: loadingTrades } = useQuery({
    queryKey: ["sv-trades"],
    enabled: isSupervisor,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("*")
        .order("closed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        userId: String((r as Record<string, unknown>)["user_id"]),
        trade: toTrade(r as Record<string, unknown>),
      }));
    },
  });

  const byUser = useMemo(() => {
    const map = new Map<string, Trade[]>();
    for (const t of trades) {
      const list = map.get(t.userId) ?? [];
      list.push(t.trade);
      map.set(t.userId, list);
    }
    return map;
  }, [trades]);

  if (!isSupervisor) {
    return (
      <AppShell title="Supervisión" subtitle="Acceso restringido">
        <p className="text-sm text-muted-foreground">
          Necesitas el rol de supervisor o administrador para ver esta sección.
        </p>
      </AppShell>
    );
  }

  const selectedTrades = selected ? (byUser.get(selected) ?? []) : [];
  const selectedProfile = profiles.find((p) => p.id === selected);
  const metrics = computeMetrics(selectedTrades);
  const curve = buildEquityCurve([...selectedTrades].reverse(), 0);

  return (
    <AppShell
      title="Supervisión"
      subtitle="Resumen de resultados de cada usuario y chat privado"
    >
      <section className="panel p-4">
        <h2 className="mb-3 text-xl leading-none">Usuarios</h2>
        {(loadingProfiles || loadingTrades) && (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Usuario</th>
                <th className="py-2 text-right">Operaciones</th>
                <th className="py-2 text-right">PnL</th>
                <th className="py-2 text-right">Win rate</th>
                <th className="py-2 text-right">Profit factor</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const list = byUser.get(p.id) ?? [];
                const m = computeMetrics(list);
                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    className={cn(
                      "cursor-pointer border-t border-border hover:bg-accent",
                      selected === p.id && "bg-accent",
                    )}
                  >
                    <td className="py-2">{p.display_name ?? p.id.slice(0, 8)}</td>
                    <td className="num py-2 text-right">{m.total}</td>
                    <td
                      className={cn(
                        "num py-2 text-right",
                        m.totalPnl >= 0 ? "text-profit" : "text-loss",
                      )}
                    >
                      {formatCurrency(m.totalPnl, true)}
                    </td>
                    <td className="num py-2 text-right">{m.winRate.toFixed(1)}%</td>
                    <td className="num py-2 text-right">
                      {Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : "∞"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <>
          <section className="space-y-3">
            <h2 className="text-xl leading-none">
              {selectedProfile?.display_name ?? "Usuario"} · resumen
            </h2>
            <KpiCards metrics={metrics} />
            <div className="panel p-4">
              <EquityChart data={curve} />
            </div>
          </section>

          <ChatThread
            subjectUserId={selected}
            title={`Chat con ${selectedProfile?.display_name ?? "el usuario"}`}
            hint="Solo lo ven este usuario y los supervisores."
          />
        </>
      )}
    </AppShell>
  );
}

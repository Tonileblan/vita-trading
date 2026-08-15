import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Wallet,
  ListOrdered,
  Webhook,
  Layers,
  Banknote,
  TrendingUp,
  CandlestickChart,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AccountSidePanel } from "./account-side-panel";

const nav = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/cuentas", label: "Cuentas", icon: Wallet },
  { to: "/estrategias", label: "Estrategias", icon: Layers },
  { to: "/operaciones", label: "Operaciones", icon: ListOrdered },
  { to: "/retiros", label: "Retiros", icon: Banknote },
  { to: "/escalado", label: "Escalado", icon: TrendingUp },
  { to: "/integraciones", label: "Integraciones", icon: Webhook },
];

export function AppShell({
  title,
  subtitle,
  actions,
  children,
  showAccountPanel = true,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  showAccountPanel?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <CandlestickChart className="size-6 text-brand" />
          <span className="font-display text-lg font-bold tracking-tight">
            TONI<span className="text-brand">TRADING</span>
          </span>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {nav.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {showAccountPanel && <AccountSidePanel />}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/85 px-5 py-4 backdrop-blur">
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 lg:hidden">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground [&.active]:bg-accent [&.active]:text-foreground"
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="flex-1 p-5">{children}</main>
      </div>
    </div>
  );
}

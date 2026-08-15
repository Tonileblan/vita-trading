import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Wallet,
  ListOrdered,
  Webhook,
  Layers,
  Banknote,
  TrendingUp,
  CandlestickChart,
  NotebookPen,
  Users,
  LogOut,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";
import { useJournal } from "@/lib/journal-store";
import { useJournals } from "@/lib/journals";
import { cn } from "@/lib/utils";
import { AccountSidePanel } from "./account-side-panel";

const nav = [
  { to: "/panel", label: "Overview", icon: LayoutDashboard },
  { to: "/diarios", label: "Diarios", icon: NotebookPen },
  { to: "/cuentas", label: "Cuentas", icon: Wallet },
  { to: "/estrategias", label: "Estrategias", icon: Layers },
  { to: "/operaciones", label: "Operaciones", icon: ListOrdered },
  { to: "/retiros", label: "Retiros", icon: Banknote },
  { to: "/escalado", label: "Escalado", icon: TrendingUp },
  { to: "/integraciones", label: "Integraciones", icon: Webhook },
  { to: "/usuarios", label: "Usuarios", icon: Users },
] as const;

function JournalSwitcher() {
  const { data: journals = [] } = useJournals();
  const { activeJournalId, setActiveJournalId } = useJournal();
  const active = journals.find((j) => j.id === activeJournalId);

  useEffect(() => {
    if (!active && journals.length > 0) setActiveJournalId(journals[0]!.id);
  }, [active, journals, setActiveJournalId]);

  if (journals.length === 0) return null;

  return (
    <select
      value={active?.id ?? ""}
      onChange={(e) => setActiveJournalId(e.target.value)}
      className="h-9 rounded-md border border-border bg-card px-2 text-sm"
      aria-label="Diario activo"
    >
      {journals.map((j) => (
        <option key={j.id} value={j.id}>
          {j.name}
        </option>
      ))}
    </select>
  );
}

function UserMenu() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const label = profile?.display_name ?? user?.email ?? "Cuenta";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-[10rem] truncate">
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {user?.email}
          {isAdmin && " · admin"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate({ to: "/usuarios" })}>
          <Users className="size-4" /> Mi perfil
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            await signOut();
            navigate({ to: "/auth", replace: true });
          }}
        >
          <LogOut className="size-4" /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/panel" className="flex items-center gap-2">
            <CandlestickChart className="size-5" />
            <span className="font-display text-2xl leading-none tracking-wide">Bitácora</span>
          </Link>
          <div className="flex items-center gap-2">
            <JournalSwitcher />
            <UserMenu />
          </div>
        </div>
        <div className="border-t border-border">
          <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4 py-2">
            {nav.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "whitespace-nowrap rounded-sm px-3 py-1.5 font-display text-lg leading-none tracking-wide transition-colors",
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
          <div>
            <h1 className="text-3xl leading-none">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
        <div className="space-y-6">{children}</div>
      </main>
    </div>
  );
}

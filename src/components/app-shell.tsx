import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Wallet,
  ListOrdered,
  Layers,
  CandlestickChart,
  NotebookPen,
  Users,
  MessageSquare,
  Brain,
  Receipt,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { type ReactNode } from "react";
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
import { cn } from "@/lib/utils";

function UserMenu() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const label = profile?.display_name ?? user?.email ?? "Cuenta";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-[6.5rem] truncate sm:max-w-[10rem]">
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
        <DropdownMenuItem onSelect={() => navigate({ to: "/funciones" })}>
          <LayoutDashboard className="size-4" /> Funciones de la app
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            await signOut();
            navigate({ to: "/auth", replace: true, search: { next: undefined } });
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
  bareHeader,
}: {
  title: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  showAccountPanel?: boolean;
  bareHeader?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, profile } = useAuth();

  // Obtener únicamente la primera palabra del nombre del usuario (ej: "Toni" de "Toni Garcia")
  const rawName = profile?.display_name || user?.email?.split("@")[0] || "Usuario";
  const userFirstWord = rawName.trim().split(/\s+/)[0] || "Usuario";

  const items = [
    { to: "/panel", label: "Resumen", icon: LayoutDashboard },
    { to: "/diarios", label: "Diarios", icon: NotebookPen },
    { to: "/cuentas", label: "Cuentas", icon: Wallet },
    { to: "/operaciones", label: "Operaciones", icon: ListOrdered },
    { to: "/estrategias", label: "Estrategias", icon: Layers },
    { to: "/conta", label: "Conta", icon: Receipt },
    { to: "/mente", label: "Mente", icon: Brain },
    { to: "/usuarios", label: userFirstWord, icon: Users },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto grid max-w-4xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-2.5 sm:gap-3 sm:py-3">
          <Link to="/panel" className="flex min-w-0 items-center gap-2">
            <CandlestickChart className="size-5 shrink-0" />
            <div className="flex min-w-0 flex-col leading-none">
              <span className="truncate font-display text-xl tracking-wide sm:text-2xl">
                Vita-Trading
              </span>
              <span className="font-hand text-sm leading-none text-muted-foreground sm:text-base">
                by Toni
              </span>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <UserMenu />
          </div>
        </div>
        <div className="border-t border-border">
          <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((item) => {
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

      <main className="mx-auto max-w-4xl px-4 py-5 sm:py-6">
        <div
          className={cn(
            "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between",
            bareHeader ? "mb-0" : "mb-5 border-b border-border pb-4 sm:mb-6",
          )}
        >
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl leading-none sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
              {actions}
            </div>
          )}
        </div>
        <div className="space-y-6">{children}</div>
      </main>
    </div>
  );
}

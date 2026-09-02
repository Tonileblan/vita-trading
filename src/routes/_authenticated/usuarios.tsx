import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Sliders,
  MessageSquare,
  Users,
  Webhook,
  Sun,
  Moon,
  Shield,
  ShieldCheck,
  User,
  Mail,
  UserCheck,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { IntegrationsPanel } from "@/components/integrations-panel";
import { ChatThread } from "@/components/chat-thread";
import { UserProfileCard, type AvailableSupervisor } from "@/components/users/user-profile-card";
import { AiModelSettingsCard } from "@/components/users/ai-model-settings-card";
import { SupervisorManagementCard, type PendingSupervisorRequest } from "@/components/users/supervisor-management-card";
import { AdminUsersTable, type AdminUserItem } from "@/components/users/admin-users-table";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuarios & Configuración — Vita-Trading" },
      {
        name: "description",
        content: "Gestiona tu perfil, preferencias de supervisión, solicitudes y administración de usuarios.",
      },
      { property: "og:title", content: "Usuarios & Configuración — Vita-Trading" },
      {
        property: "og:description",
        content: "Perfiles, asignación de supervisores, credenciales y permisos.",
      },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const { user, profile, isAdmin, isSupervisor } = useAuth();
  const { theme, setTheme } = useTheme();

  // Query: Supervisores disponibles
  const { data: availableSupervisors = [] } = useQuery<AvailableSupervisor[]>({
    queryKey: ["available-supervisors"],
    queryFn: async () => {
      const { data: rpcData, error: rpcError } = await (supabase.rpc as any)("get_available_supervisors");
      if (!rpcError && Array.isArray(rpcData)) {
        return rpcData as AvailableSupervisor[];
      }
      // Fallback
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["supervisor", "admin"]);
      const supIds = (roles ?? []).map((r) => r.user_id);
      if (supIds.length === 0) return [];
      const { data: profs, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", supIds);
      if (error) throw error;
      return (profs ?? []).map((p) => ({
        id: p.id,
        display_name: p.display_name ?? "Supervisor",
        avatar_url: p.avatar_url,
      }));
    },
  });

  // Query: Todos los perfiles (Solo para Administradores / Supervisores)
  const { data: allUsers = [] } = useQuery<AdminUserItem[]>({
    queryKey: ["all-profiles"],
    enabled: Boolean(isAdmin || isSupervisor),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, created_at, is_private")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AdminUserItem[];
    },
  });

  // Query: Todos los roles de usuarios (Para Administradores)
  const { data: allRoles = {} } = useQuery<Record<string, string[]>>({
    queryKey: ["all-roles"],
    enabled: Boolean(isAdmin),
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      const map: Record<string, string[]> = {};
      for (const r of data ?? []) {
        if (!map[r.user_id]) {
          map[r.user_id] = [];
        }
        map[r.user_id]?.push(r.role);
      }
      return map;
    },
  });

  const pendingRequests = (allUsers.filter((u) => u.supervisor_status === "pending") ??
    []) as PendingSupervisorRequest[];

  const assignedSupervisorObj = availableSupervisors.find(
    (s) => s.id === profile?.assigned_supervisor_id,
  );

  return (
    <AppShell
      title={profile?.display_name ? `${profile.display_name.trim().split(/\s+/)[0]} · Mi Cuenta` : "Mi Perfil & Ajustes"}
      subtitle="Gestiona tu perfil, chat con supervisores, tema y directorio de usuarios"
      showAccountPanel={false}
    >
      <div className="space-y-6">
        {/* HERO CARD DEL USUARIO */}
        <section className="panel relative overflow-hidden p-6 md:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="size-16 border-2 border-brand/40 shadow-md md:size-20">
                <AvatarImage src={profile?.avatar_url ?? ""} alt={profile?.display_name ?? ""} />
                <AvatarFallback className="bg-brand/10 text-xl font-bold text-brand md:text-2xl">
                  {profile?.display_name
                    ? profile.display_name.slice(0, 2).toUpperCase()
                    : user?.email?.slice(0, 2).toUpperCase() ?? "TR"}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
                    {profile?.display_name || "Trader Sin Nombre"}
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {isAdmin && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-bold text-brand">
                        <Shield className="size-3" /> Admin
                      </span>
                    )}
                    {isSupervisor && !isAdmin && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-500">
                        <ShieldCheck className="size-3" /> Supervisor
                      </span>
                    )}
                    {!isAdmin && !isSupervisor && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                        <User className="size-3" /> Trader
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Mail className="size-3.5" />
                    {user?.email}
                  </span>
                  <span>·</span>
                  <span className="font-mono text-[11px] opacity-70">ID: {user?.id.slice(0, 8)}</span>
                </div>

                <div className="pt-1">
                  {assignedSupervisorObj ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
                      <UserCheck className="size-3.5" /> Supervisado por: {assignedSupervisorObj.display_name}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin supervisor asignado</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4" />}
                <span className="capitalize">{theme}</span>
              </Button>
            </div>
          </div>
        </section>

        {/* ESTRUCTURA POR PESTAÑAS */}
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 p-1 bg-muted/60 max-w-lg">
            <TabsTrigger value="profile" className="gap-2 font-semibold text-xs md:text-sm">
              <Sliders className="size-4" />
              <span>Mi Perfil</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-2 font-semibold text-xs md:text-sm">
              <MessageSquare className="size-4" />
              <span>Chat</span>
            </TabsTrigger>
            {(isAdmin || isSupervisor) && (
              <TabsTrigger value="admin" className="gap-2 font-semibold text-xs md:text-sm">
                <Users className="size-4" />
                <span>Usuarios</span>
                {pendingRequests.length > 0 && (
                  <span className="ml-1 rounded-full bg-purple-500 px-1.5 py-0.2 text-[10px] text-white">
                    {pendingRequests.length}
                  </span>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          {/* Pestaña: Mi Perfil, IA y Supervisión */}
          <TabsContent value="profile" className="space-y-6">
            <UserProfileCard availableSupervisors={availableSupervisors} />
            <AiModelSettingsCard />
            <SupervisorManagementCard pendingRequests={pendingRequests} />
            <IntegrationsPanel />
          </TabsContent>

          {/* Pestaña: Chat */}
          <TabsContent value="chat" className="space-y-6">
            <section className="panel p-6">
              <div className="mb-4">
                <h3 className="font-display text-lg tracking-wide flex items-center gap-2">
                  <MessageSquare className="size-4 text-brand" /> Chat Directo con Supervisores
                </h3>
                <p className="text-xs text-muted-foreground">
                  Comunícate en privado con tus supervisores asignados para dudas operativas y feedback.
                </p>
              </div>
              <ChatThread subjectUserId={profile?.assigned_supervisor_id ?? null} />
            </section>
          </TabsContent>

          {/* Pestaña: Directorio & Administración */}
          {(isAdmin || isSupervisor) && (
            <TabsContent value="admin" className="space-y-6">
              <AdminUsersTable users={allUsers} roles={allRoles} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppShell>
  );
}

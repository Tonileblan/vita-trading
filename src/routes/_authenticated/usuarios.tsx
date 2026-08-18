import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Coffee,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Moon,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  Unlock,
  User,
  UserCheck,
  Users,
  Webhook,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { IntegrationsPanel } from "@/components/integrations-panel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuarios & Configuración — Vita-Trading" },
      {
        name: "description",
        content: "Gestiona tu perfil, preferencias de privacidad, integraciones y administración de usuarios.",
      },
      { property: "og:title", content: "Usuarios & Configuración — Vita-Trading" },
      {
        property: "og:description",
        content: "Perfiles, nombres visibles, credenciales y permisos de administrador.",
      },
    ],
  }),
  component: UsersPage,
});

interface UserRow {
  id: string;
  email?: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  is_private?: boolean;
}

function UsersPage() {
  const { user, profile, isAdmin, isSupervisor } = useAuth();
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const isPrivate = profile?.is_private ?? false;

  // Filtros y búsqueda para la tabla de administración
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "supervisor" | "user">("all");

  // Estados para diálogos de administración
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);

  useEffect(() => {
    setName(profile?.display_name ?? "");
    setAvatar(profile?.avatar_url ?? "");
  }, [profile]);

  const togglePrivate = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_private: next })
        .eq("id", user!.id);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      toast.success(next ? "Perfil privado activado" : "Perfil visible para supervisores");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: name.trim() || null, avatar_url: avatar.trim() || null })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil actualizado con éxito");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["all-profiles"],
    enabled: isAdmin,
    queryFn: async () => {
      // Intentar primero la función RPC de administración que devuelve emails reales
      const { data: rpcData, error: rpcError } = await (supabase.rpc as any)("admin_get_users");
      if (!rpcError && Array.isArray(rpcData)) {
        return rpcData as UserRow[];
      }
      // Fallback a profiles directo
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, created_at, is_private")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as UserRow[];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["all-roles"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return (data ?? []) as { user_id: string; role: string }[];
    },
  });

  const toggleRole = useMutation({
    mutationFn: async ({
      userId,
      role,
      grant,
    }: {
      userId: string;
      role: "admin" | "supervisor";
      grant: boolean;
    }) => {
      if (grant) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", role);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Roles actualizados correctamente");
      qc.invalidateQueries({ queryKey: ["all-roles"] });
      qc.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateCredentials = useMutation({
    mutationFn: async ({
      userId,
      newEmail,
      newPassword,
    }: {
      userId: string;
      newEmail?: string | undefined;
      newPassword?: string | undefined;
    }) => {
      const { error } = await (supabase.rpc as any)("admin_update_user_credentials", {
        target_user_id: userId,
        new_email: newEmail?.trim() || null,
        new_password: newPassword?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Credenciales actualizadas correctamente");
      setEditingUser(null);
      setEditEmail("");
      setEditPassword("");
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await (supabase.rpc as any)("admin_delete_user", {
        target_user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuario eliminado definitivamente");
      setDeletingUser(null);
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
      qc.invalidateQueries({ queryKey: ["all-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Métricas para administradores
  const adminCount = useMemo(() => {
    const adminIds = new Set(roles.filter((r) => r.role === "admin").map((r) => r.user_id));
    return adminIds.size;
  }, [roles]);

  const supervisorCount = useMemo(() => {
    const supIds = new Set(roles.filter((r) => r.role === "supervisor").map((r) => r.user_id));
    return supIds.size;
  }, [roles]);

  const privateCount = useMemo(() => {
    return users.filter((u) => u.is_private).length;
  }, [users]);

  // Lista de usuarios filtrada
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const userRoles = roles.filter((r) => r.user_id === u.id).map((r) => r.role);
      const isUAdmin = userRoles.includes("admin");
      const isUSupervisor = userRoles.includes("supervisor");
      const isStandard = !isUAdmin && !isUSupervisor;

      if (roleFilter === "admin" && !isUAdmin) return false;
      if (roleFilter === "supervisor" && !isUSupervisor) return false;
      if (roleFilter === "user" && !isStandard) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const nameMatch = (u.display_name ?? "").toLowerCase().includes(q);
      const emailMatch = (u.email ?? "").toLowerCase().includes(q);
      const idMatch = u.id.toLowerCase().includes(q);
      return nameMatch || emailMatch || idMatch;
    });
  }, [users, roles, roleFilter, searchQuery]);

  const getInitials = (displayName?: string | null, email?: string | null) => {
    if (displayName?.trim()) {
      return displayName
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
    }
    if (email?.trim()) {
      return email.slice(0, 2).toUpperCase();
    }
    return "VT";
  };

  return (
    <AppShell
      title="Usuarios y Configuración"
      subtitle={
        isAdmin
          ? "Panel de administración · Gestión de usuarios, accesos y ajustes del perfil"
          : "Gestión de tu perfil personal, privacidad y preferencias de la aplicación"
      }
      showAccountPanel={false}
    >
      <div className="space-y-6">
        {/* Banner de perfil del usuario actual */}
        <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-linear-to-r from-card via-card to-accent/20 p-5 shadow-xs md:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="size-16 border-2 border-brand/40 shadow-md">
                <AvatarImage src={avatar || profile?.avatar_url || ""} alt={name || "Usuario"} />
                <AvatarFallback className="bg-brand text-base font-bold text-primary-foreground">
                  {getInitials(profile?.display_name, user?.email)}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight text-foreground">
                    {profile?.display_name || "Mi Cuenta"}
                  </h2>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isAdmin && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        <Shield className="size-3" />
                        Admin
                      </span>
                    )}
                    {isSupervisor && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                        <Eye className="size-3" />
                        Supervisor
                      </span>
                    )}
                    {!isAdmin && !isSupervisor && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        <User className="size-3" />
                        Trader
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-mono">
                    <Mail className="size-3.5" /> {user?.email}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    {isPrivate ? (
                      <span className="inline-flex items-center gap-1 text-amber-500">
                        <Lock className="size-3" /> Perfil privado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-500">
                        <Eye className="size-3" /> Visible a supervisores
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={theme === "dark" ? "outline" : "default"}
                size="sm"
                className="gap-1.5"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4" />}
                <span>{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
              </Button>
            </div>
          </div>
        </section>

        {/* Pestañas para Admin o Grid directo para usuario regular */}
        {isAdmin ? (
          <Tabs defaultValue="admin" className="w-full space-y-6">
            <TabsList className="grid h-11 w-full max-w-md grid-cols-2 rounded-xl bg-muted/60 p-1">
              <TabsTrigger value="admin" className="gap-2 font-semibold">
                <Users className="size-4" />
                <span>Gestión de Usuarios ({users.length})</span>
              </TabsTrigger>
              <TabsTrigger value="profile" className="gap-2 font-semibold">
                <Sliders className="size-4" />
                <span>Mi Perfil y Ajustes</span>
              </TabsTrigger>
            </TabsList>

            {/* Pestaña: Gestión de Usuarios (Admin) */}
            <TabsContent value="admin" className="space-y-5 focus-visible:outline-none">
              {/* Tarjetas KPI de métricas de usuarios */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="panel flex flex-col justify-between p-4">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-semibold uppercase tracking-wider">Total</span>
                    <Users className="size-4 text-brand" />
                  </div>
                  <div className="num mt-2 text-2xl font-bold text-foreground">{users.length}</div>
                  <span className="text-[11px] text-muted-foreground">Usuarios registrados</span>
                </div>

                <div className="panel flex flex-col justify-between p-4">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-semibold uppercase tracking-wider">Admins</span>
                    <ShieldCheck className="size-4 text-primary" />
                  </div>
                  <div className="num mt-2 text-2xl font-bold text-primary">{adminCount}</div>
                  <span className="text-[11px] text-muted-foreground">Control total</span>
                </div>

                <div className="panel flex flex-col justify-between p-4">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-semibold uppercase tracking-wider">Supervisores</span>
                    <Eye className="size-4 text-amber-500" />
                  </div>
                  <div className="num mt-2 text-2xl font-bold text-amber-500">{supervisorCount}</div>
                  <span className="text-[11px] text-muted-foreground">Vista de resumen</span>
                </div>

                <div className="panel flex flex-col justify-between p-4">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-semibold uppercase tracking-wider">Privados</span>
                    <Lock className="size-4 text-muted-foreground" />
                  </div>
                  <div className="num mt-2 text-2xl font-bold text-foreground">{privateCount}</div>
                  <span className="text-[11px] text-muted-foreground">Ocultos a supervisores</span>
                </div>
              </div>

              {/* Panel principal de tabla con buscador y filtros */}
              <section className="panel space-y-4 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-bold">Listado de Usuarios</h3>
                    <p className="text-xs text-muted-foreground">
                      Administra permisos, modifica credenciales de acceso o elimina cuentas registradas.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Buscador */}
                    <div className="relative min-w-[200px]">
                      <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por nombre o correo…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 pl-8 text-xs"
                      />
                    </div>

                    {/* Filtro por Rol */}
                    <div className="flex rounded-md border border-border bg-card p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setRoleFilter("all")}
                        className={cn(
                          "rounded px-2.5 py-1 font-medium transition-colors",
                          roleFilter === "all" ? "bg-brand text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setRoleFilter("admin")}
                        className={cn(
                          "rounded px-2.5 py-1 font-medium transition-colors",
                          roleFilter === "admin" ? "bg-brand text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Admins
                      </button>
                      <button
                        type="button"
                        onClick={() => setRoleFilter("supervisor")}
                        className={cn(
                          "rounded px-2.5 py-1 font-medium transition-colors",
                          roleFilter === "supervisor" ? "bg-brand text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Supervisores
                      </button>
                      <button
                        type="button"
                        onClick={() => setRoleFilter("user")}
                        className={cn(
                          "rounded px-2.5 py-1 font-medium transition-colors",
                          roleFilter === "user" ? "bg-brand text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Traders
                      </button>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="py-3 px-3">Usuario</th>
                        <th className="py-3 px-3">Correo electrónico</th>
                        <th className="py-3 px-3">Privacidad</th>
                        <th className="py-3 px-3">Roles</th>
                        <th className="py-3 px-3">Fecha de alta</th>
                        <th className="py-3 px-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredUsers.map((u) => {
                        const userRoles = roles.filter((r) => r.user_id === u.id).map((r) => r.role);
                        const isUAdmin = userRoles.includes("admin");
                        const isUSupervisor = userRoles.includes("supervisor");
                        const isSelf = u.id === user?.id;

                        return (
                          <tr
                            key={u.id}
                            className={cn(
                              "group transition-colors hover:bg-accent/40",
                              isSelf && "bg-brand/5",
                            )}
                          >
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-3">
                                <Avatar className="size-8 border border-border">
                                  <AvatarImage src={u.avatar_url || ""} />
                                  <AvatarFallback className="text-xs font-semibold">
                                    {getInitials(u.display_name, u.email)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                                    <span>{u.display_name || "Sin nombre asignado"}</span>
                                    {isSelf && (
                                      <span className="rounded bg-brand/20 px-1.5 py-0.2 text-[10px] font-bold text-brand">
                                        TÚ
                                      </span>
                                    )}
                                  </div>
                                  <div className="font-mono text-[10px] text-muted-foreground">
                                    ID: {u.id.slice(0, 8)}…
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5 text-foreground">
                                <span className="font-mono text-xs">
                                  {u.email || (isSelf ? user?.email : "No visible")}
                                </span>
                                {u.email && (
                                  <button
                                    onClick={() => {
                                      void navigator.clipboard.writeText(u.email!);
                                      toast.success("Correo copiado");
                                    }}
                                    className="opacity-0 transition-opacity group-hover:opacity-100 p-1 hover:text-brand"
                                    title="Copiar correo"
                                  >
                                    <Copy className="size-3" />
                                  </button>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              {u.is_private ? (
                                <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-500">
                                  <Lock className="size-3" /> Privado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
                                  <Eye className="size-3" /> Público
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3">
                              <div className="flex flex-wrap gap-1">
                                {isUAdmin && (
                                  <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                                    <ShieldCheck className="size-3" />
                                    Admin
                                  </span>
                                )}
                                {isUSupervisor && (
                                  <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                    <Eye className="size-3" />
                                    Supervisor
                                  </span>
                                )}
                                {!isUAdmin && !isUSupervisor && (
                                  <span className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                    Trader
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-3 text-xs text-muted-foreground">
                              {new Date(u.created_at).toLocaleDateString("es-ES", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>

                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Botón Credenciales */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1 px-2 text-xs"
                                  onClick={() => {
                                    setEditingUser(u);
                                    setEditEmail(u.email ?? (isSelf ? (user?.email ?? "") : ""));
                                    setEditPassword("");
                                  }}
                                  title="Modificar correo y contraseña"
                                >
                                  <KeyRound className="size-3.5 text-brand" />
                                  <span className="hidden lg:inline">Credenciales</span>
                                </Button>

                                {/* Botón Alternar Supervisor */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1 px-2 text-xs"
                                  onClick={() =>
                                    toggleRole.mutate({
                                      userId: u.id,
                                      role: "supervisor",
                                      grant: !isUSupervisor,
                                    })
                                  }
                                  title={isUSupervisor ? "Revocar rol supervisor" : "Hacer supervisor"}
                                >
                                  <Eye className="size-3.5" />
                                  <span className="hidden xl:inline">
                                    {isUSupervisor ? "Quitar Sup." : "Hacer Sup."}
                                  </span>
                                </Button>

                                {/* Botón Alternar Admin */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1 px-2 text-xs"
                                  disabled={isSelf}
                                  onClick={() =>
                                    toggleRole.mutate({ userId: u.id, role: "admin", grant: !isUAdmin })
                                  }
                                  title={isSelf ? "No puedes revocar tu propio rol de admin" : isUAdmin ? "Revocar rol admin" : "Hacer admin"}
                                >
                                  {isUAdmin ? (
                                    <>
                                      <ShieldOff className="size-3.5 text-amber-500" />
                                      <span className="hidden xl:inline">Quitar Admin</span>
                                    </>
                                  ) : (
                                    <>
                                      <ShieldCheck className="size-3.5 text-primary" />
                                      <span className="hidden xl:inline">Hacer Admin</span>
                                    </>
                                  )}
                                </Button>

                                {/* Botón Borrar Usuario */}
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-8 px-2"
                                  disabled={isSelf}
                                  onClick={() => setDeletingUser(u)}
                                  title={isSelf ? "No puedes borrar tu propia cuenta" : "Eliminar usuario"}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-muted-foreground">
                            No se encontraron usuarios con los filtros aplicados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </TabsContent>

            {/* Pestaña: Mi Perfil y Ajustes */}
            <TabsContent value="profile" className="space-y-6 focus-visible:outline-none">
              <ProfileSettingsGrid
                name={name}
                setName={setName}
                avatar={avatar}
                setAvatar={setAvatar}
                isPrivate={isPrivate}
                theme={theme}
                setTheme={setTheme}
                user={user}
                saveProfile={saveProfile}
                togglePrivate={togglePrivate}
              />
            </TabsContent>
          </Tabs>
        ) : (
          /* Vista normal sin pestañas para usuarios no administradores */
          <ProfileSettingsGrid
            name={name}
            setName={setName}
            avatar={avatar}
            setAvatar={setAvatar}
            isPrivate={isPrivate}
            theme={theme}
            setTheme={setTheme}
            user={user}
            saveProfile={saveProfile}
            togglePrivate={togglePrivate}
          />
        )}

        {/* Diálogo para editar correo y contraseña */}
        <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="size-5 text-brand" />
                Cambiar credenciales de acceso
              </DialogTitle>
              <DialogDescription>
                Modifica el correo electrónico o asigna una nueva contraseña para{" "}
                <strong className="text-foreground">
                  {editingUser?.display_name || editingUser?.email || "el usuario"}
                </strong>
                .
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editingUser) return;
                if (!editEmail.trim() && !editPassword.trim()) {
                  toast.info("No has realizado ningún cambio");
                  return;
                }
                updateCredentials.mutate({
                  userId: editingUser.id,
                  newEmail: editEmail.trim() || undefined,
                  newPassword: editPassword.trim() || undefined,
                });
              }}
              className="space-y-4 py-2"
            >
              <div className="space-y-1.5">
                <Label htmlFor="edit-email" className="flex items-center gap-1.5 text-xs font-semibold">
                  <Mail className="size-3.5 text-brand" /> Correo electrónico
                </Label>
                <Input
                  id="edit-email"
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-pass" className="flex items-center gap-1.5 text-xs font-semibold">
                  <Lock className="size-3.5 text-brand" /> Nueva contraseña
                </Label>
                <Input
                  id="edit-pass"
                  type="password"
                  minLength={6}
                  placeholder="Dejar en blanco para conservar la actual"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Mínimo 6 caracteres. Si no deseas modificar la contraseña existente, déjalo vacío.
                </p>
              </div>

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingUser(null)}
                  disabled={updateCredentials.isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateCredentials.isPending} className="gap-1.5">
                  {updateCredentials.isPending ? "Guardando…" : "Guardar credenciales"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Diálogo de confirmación para eliminar usuario */}
        <AlertDialog
          open={Boolean(deletingUser)}
          onOpenChange={(open) => !open && setDeletingUser(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="size-5" />
                ¿Eliminar usuario definitivamente?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2 text-sm">
                <span>
                  Estás a punto de eliminar a{" "}
                  <strong className="text-foreground">
                    {deletingUser?.display_name ?? deletingUser?.email ?? "este usuario"}
                  </strong>
                  .
                </span>
                <span className="block rounded-md border border-destructive/20 bg-destructive/10 p-3 font-medium text-destructive">
                  ⚠️ Esta acción no se puede deshacer. Se eliminarán de forma irreversible todos sus diarios, cuentas, estrategias y operaciones registradas.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteUser.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteUser.isPending}
                onClick={() => {
                  if (deletingUser) {
                    deleteUser.mutate(deletingUser.id);
                  }
                }}
              >
                {deleteUser.isPending ? "Eliminando…" : "Sí, eliminar definitivamente"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Footer elegante */}
        <footer className="mt-12 flex flex-col items-center gap-3 border-t border-border pt-6 text-center">
          <p className="font-hand text-xl text-foreground/80">
            Creado por Toni
          </p>
          <a
            href="https://www.buymeacoffee.com/leblangarcs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#ff813f] px-5 py-2 text-sm font-semibold text-white shadow-md transition-transform hover:scale-105 hover:bg-[#ff7a2e]"
          >
            <Coffee className="size-4" />
            Invítame a un café
          </a>
        </footer>
      </div>
    </AppShell>
  );
}

/** Componente estructurado para la cuadrícula de perfil, privacidad, tema e integraciones */
function ProfileSettingsGrid({
  name,
  setName,
  avatar,
  setAvatar,
  isPrivate,
  theme,
  setTheme,
  user,
  saveProfile,
  togglePrivate,
}: {
  name: string;
  setName: (v: string) => void;
  avatar: string;
  setAvatar: (v: string) => void;
  isPrivate: boolean;
  theme: string;
  setTheme: (v: "light" | "dark") => void;
  user: any;
  saveProfile: any;
  togglePrivate: any;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {/* Card 1: Perfil y Datos Personales */}
        <section className="panel flex flex-col justify-between p-5">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <User className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Datos del Perfil</h3>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-name" className="text-xs font-semibold">
                  Nombre visible
                </Label>
                <Input
                  id="p-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre o alias"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="p-avatar" className="text-xs font-semibold">
                  URL del avatar (imagen)
                </Label>
                <Input
                  id="p-avatar"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder="https://ejemplo.com/avatar.jpg"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-border/60">
            <Button
              onClick={() => saveProfile.mutate()}
              disabled={saveProfile.isPending}
              className="w-full"
            >
              {saveProfile.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </section>

        {/* Card 2: Privacidad y Visibilidad */}
        <section className="panel flex flex-col justify-between p-5">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                {isPrivate ? <Lock className="size-5" /> : <Unlock className="size-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold">Privacidad de la Cuenta</h3>
                <p className="text-xs text-muted-foreground">Visibilidad ante supervisores</p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-xs text-muted-foreground space-y-2">
              <p className="leading-relaxed">
                {isPrivate ? (
                  <>
                    <strong className="text-foreground">Modo Privado:</strong> Ningún supervisor puede ver tus cuentas, operaciones, diarios ni chat interno.
                  </>
                ) : (
                  <>
                    <strong className="text-foreground">Modo Visible:</strong> Los supervisores autorizados pueden consultar tu pestaña de Resumen y apoyarte en el chat.
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/80 p-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-foreground">
                  {isPrivate ? "Perfil Privado" : "Perfil Público"}
                </span>
                <p className="text-[11px] text-muted-foreground">
                  {isPrivate ? "Acceso restringido a ti" : "Supervisión permitida"}
                </p>
              </div>
              <Switch
                checked={isPrivate}
                disabled={togglePrivate.isPending}
                onCheckedChange={(checked) => togglePrivate.mutate(checked)}
              />
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-border/60">
            <Button
              variant={isPrivate ? "default" : "outline"}
              className="w-full gap-2"
              disabled={togglePrivate.isPending}
              onClick={() => togglePrivate.mutate(!isPrivate)}
            >
              {isPrivate ? <Lock className="size-4" /> : <Unlock className="size-4" />}
              {isPrivate ? "Perfil Privado Activado" : "Hacer Perfil Privado"}
            </Button>
          </div>
        </section>

        {/* Card 3: Apariencia del Sistema */}
        <section className="panel flex flex-col justify-between p-5 md:col-span-2 xl:col-span-1">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
                <Sun className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Tema y Apariencia</h3>
                <p className="text-xs text-muted-foreground">Personaliza el aspecto visual</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Opción Claro */}
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={cn(
                  "flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 p-4 text-xs font-semibold transition-all",
                  theme === "light"
                    ? "border-brand bg-brand/10 shadow-xs"
                    : "border-border hover:border-foreground/40",
                )}
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-xs">
                  <Sun className="size-5" />
                </div>
                <span>Modo Claro</span>
                {theme === "light" && <Check className="size-4 text-brand" />}
              </button>

              {/* Opción Oscuro */}
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 p-4 text-xs font-semibold transition-all",
                  theme === "dark"
                    ? "border-brand bg-brand/10 shadow-xs"
                    : "border-border hover:border-foreground/40",
                )}
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-slate-800 text-indigo-400 shadow-xs">
                  <Moon className="size-5" />
                </div>
                <span>Modo Oscuro</span>
                {theme === "dark" && <Check className="size-4 text-brand" />}
              </button>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-border/60 text-center text-xs text-muted-foreground">
            Tema activo: <strong className="text-foreground capitalize">{theme}</strong>
          </div>
        </section>
      </div>

      {/* Card 4: Integraciones de Trading */}
      <section className="panel space-y-4 p-5 md:p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Webhook className="size-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Integraciones y Webhooks de Trading</h3>
            <p className="text-xs text-muted-foreground">
              Conecta NinjaTrader 8, MetaTrader 4/5, cTrader o flujos de n8n para registrar operaciones automáticamente.
            </p>
          </div>
        </div>
        <IntegrationsPanel />
      </section>
    </div>
  );
}

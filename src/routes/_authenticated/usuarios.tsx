import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Lock,
  Mail,
  MessageSquare,
  Moon,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Sliders,
  Sparkles,
  Sun,
  RotateCcw,
  Save,
  Trash2,
  Unlock,
  User,
  UserCheck,
  UserPlus,
  Users,
  Webhook,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { ChatThread } from "@/components/chat-thread";
import {
  deleteUserAdminFn,
  updateCredentialsAdminFn,
  applyForSupervisorServerFn,
  cancelSupervisorServerFn,
  adminReviewSupervisorServerFn,
} from "@/lib/admin.functions";
import {
  getLocalGoogleAiKey,
  setLocalGoogleAiKey,
  getLocalGoogleAiModel,
  setLocalGoogleAiModel,
  DEFAULT_GEMINI_MODEL,
  AVAILABLE_GEMINI_MODELS,
  testGoogleAiConnection,
} from "@/lib/google-ai";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface UserRow {
  id: string;
  email?: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  is_private?: boolean;
  supervisor_status?: "none" | "pending" | "approved" | "rejected";
  assigned_supervisor_id?: string | null;
}

interface AvailableSupervisor {
  id: string;
  display_name: string;
  avatar_url: string | null;
  email?: string;
}

function UsersPage() {
  const { user, profile, isAdmin, isSupervisor } = useAuth();
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();
  const deleteUserServer = useServerFn(deleteUserAdminFn);
  const updateCredentialsServer = useServerFn(updateCredentialsAdminFn);
  const applyForSupervisorServer = useServerFn(applyForSupervisorServerFn);
  const cancelSupervisorServer = useServerFn(cancelSupervisorServerFn);
  const adminReviewSupervisorServer = useServerFn(adminReviewSupervisorServerFn);

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [hasSupervisor, setHasSupervisor] = useState(false);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("none");
  const isPrivate = profile?.is_private ?? false;

  // Filtros y búsqueda para la tabla de administración
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "supervisor" | "pending" | "user">("all");

  // Estados para diálogos de administración
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);

  useEffect(() => {
    setName(profile?.display_name ?? "");
    setAvatar(profile?.avatar_url ?? "");
    const assigned = profile?.assigned_supervisor_id;
    if (assigned) {
      setHasSupervisor(true);
      setSelectedSupervisorId(assigned);
    } else {
      setHasSupervisor(false);
      setSelectedSupervisorId("none");
    }
  }, [profile]);

  // Query: Supervisores disponibles
  const { data: availableSupervisors = [] } = useQuery({
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
      })) as AvailableSupervisor[];
    },
  });

  // Mutación: Guardar perfil personal
  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: name.trim() || null,
          avatar_url: avatar.trim() || null,
        })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil actualizado con éxito");
      qc.invalidateQueries({ queryKey: ["user-meta"] });
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mutación: Cambiar privacidad
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
      toast.success(next ? "Perfil privado activado" : "Perfil visible para supervisión");
      qc.invalidateQueries({ queryKey: ["user-meta"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mutación: Guardar supervisor asignado
  const saveAssignedSupervisor = useMutation({
    mutationFn: async ({ enabled, supId }: { enabled: boolean; supId: string }) => {
      const targetId = enabled && supId && supId !== "none" ? supId : null;
      const { error } = await supabase
        .from("profiles")
        .update({
          assigned_supervisor_id: targetId,
          is_private: targetId ? false : isPrivate,
        })
        .eq("id", user!.id);
      if (error) throw error;
      return targetId;
    },
    onSuccess: (targetId) => {
      if (targetId) {
        toast.success("Supervisor asignado correctamente");
      } else {
        toast.success("Has desactivado la supervisión de tu cuenta");
      }
      qc.invalidateQueries({ queryKey: ["user-meta"] });
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mutación: Solicitar ser supervisor
  const applyForSupervisor = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("No hay sesión activa");
      // 1. Probar RPC
      try {
        const { error: rpcErr } = await (supabase.rpc as any)("apply_for_supervisor");
        if (!rpcErr) return;
      } catch {
        // Fallback
      }

      // 2. Probar Server Function
      try {
        await applyForSupervisorServer({ data: { userId: user.id } });
        return;
      } catch {
        // Fallback
      }

      // 3. Fallback directo
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ supervisor_status: "pending" } as any)
          .eq("id", user.id);
        if (error && !error.message?.includes("schema cache")) throw error;
      } catch (e: any) {
        if (!e?.message?.includes("schema cache")) throw e;
      }
    },
    onMutate: async () => {
      if (user?.id) {
        qc.setQueryData(["user-meta", user.id], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            profile: old.profile ? { ...old.profile, supervisor_status: "pending" } : null,
          };
        });
      }
    },
    onSuccess: () => {
      toast.success("Solicitud enviada al Administrador con éxito");
      qc.invalidateQueries({ queryKey: ["user-meta"] });
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      qc.invalidateQueries({ queryKey: ["user-meta"] });
    },
  });

  // Mutación: Cancelar solicitud de supervisor
  const cancelSupervisorApplication = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("No hay sesión activa");
      // 1. Probar RPC
      try {
        const { error: rpcErr } = await (supabase.rpc as any)("cancel_supervisor_application");
        if (!rpcErr) return;
      } catch {
        // Fallback
      }

      // 2. Probar Server Function
      try {
        await cancelSupervisorServer({ data: { userId: user.id } });
        return;
      } catch {
        // Fallback
      }

      // 3. Fallback directo
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ supervisor_status: "none" } as any)
          .eq("id", user.id);
        if (error && !error.message?.includes("schema cache")) throw error;
      } catch (e: any) {
        if (!e?.message?.includes("schema cache")) throw e;
      }
    },
    onMutate: async () => {
      if (user?.id) {
        qc.setQueryData(["user-meta", user.id], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            profile: old.profile ? { ...old.profile, supervisor_status: "none" } : null,
          };
        });
      }
    },
    onSuccess: () => {
      toast.success("Solicitud de supervisor cancelada");
      qc.invalidateQueries({ queryKey: ["user-meta"] });
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      qc.invalidateQueries({ queryKey: ["user-meta"] });
    },
  });

  // Mutación: Administrador revisa solicitud de supervisor
  const adminReviewSupervisor = useMutation({
    mutationFn: async ({ userId, approve }: { userId: string; approve: boolean }) => {
      // 1. Probar RPC
      try {
        const { error: rpcErr } = await (supabase.rpc as any)("admin_review_supervisor", {
          target_user_id: userId,
          approve,
        });
        if (!rpcErr) return;
      } catch {
        // Fallback
      }

      // 2. Probar Server Function
      try {
        await adminReviewSupervisorServer({ data: { userId, approve } });
        return;
      } catch {
        // Fallback
      }

      // 3. Fallback directo
      if (approve) {
        await supabase.from("user_roles").upsert({ user_id: userId, role: "supervisor" });
        try {
          await supabase.from("profiles").update({ supervisor_status: "approved" } as any).eq("id", userId);
        } catch {
          // ignore schema cache
        }
      } else {
        await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "supervisor");
        try {
          await supabase.from("profiles").update({ supervisor_status: "rejected" } as any).eq("id", userId);
        } catch {
          // ignore schema cache
        }
      }
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.approve
          ? "Supervisor aprobado y activado"
          : "Solicitud de supervisor rechazada",
      );
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
      qc.invalidateQueries({ queryKey: ["all-roles"] });
      qc.invalidateQueries({ queryKey: ["available-supervisors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Queries de Administración y Directorio
  const { data: users = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      try {
        const { data: rpcData, error: rpcError } = await (supabase.rpc as any)("admin_get_users");
        if (!rpcError && Array.isArray(rpcData)) {
          return rpcData as UserRow[];
        }
      } catch {
        // Fallback
      }
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url, created_at, is_private, supervisor_status, assigned_supervisor_id")
          .order("created_at", { ascending: true });
        if (error) {
          const { data: simpleData } = await supabase
            .from("profiles")
            .select("id, display_name, avatar_url, created_at")
            .order("created_at", { ascending: true });
          return (simpleData ?? []) as UserRow[];
        }
        return (data ?? []) as UserRow[];
      } catch {
        return [];
      }
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["all-roles"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from("user_roles").select("user_id, role");
        if (error) return [];
        return (data ?? []) as { user_id: string; role: string }[];
      } catch {
        return [];
      }
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
        if (role === "supervisor") {
          await supabase.from("profiles").update({ supervisor_status: "approved" }).eq("id", userId);
        }
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", role);
        if (error) throw error;
        if (role === "supervisor") {
          await supabase.from("profiles").update({ supervisor_status: "none" }).eq("id", userId);
        }
      }
    },
    onSuccess: () => {
      toast.success("Roles actualizados correctamente");
      qc.invalidateQueries({ queryKey: ["all-roles"] });
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
      qc.invalidateQueries({ queryKey: ["available-supervisors"] });
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
      // 1. Intentar Server Function (usa Service Role para actualizar auth.users directamente)
      try {
        const res = await updateCredentialsServer({
          data: {
            userId,
            email: newEmail?.trim() || undefined,
            password: newPassword?.trim() || undefined,
          },
        });
        if (res?.success) return;
      } catch (err: any) {
        console.warn("Server credentials update error, trying RPC fallback:", err);
      }

      // 2. Intentar RPC
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
      // 1. Intentar Server Function (Service Role con borrado de todas las tablas y auth.users)
      try {
        const res = await deleteUserServer({ data: { userId } });
        if (res?.success) return;
      } catch (err: any) {
        console.warn("Server delete error, trying RPC fallbacks:", err);
      }

      // 2. Intentar RPC delete_user_account
      try {
        const { data: d1, error: e1 } = await (supabase.rpc as any)("delete_user_account", {
          user_id: userId,
        });
        if (!e1 && d1) return;
      } catch {
        // Fallback
      }

      // 3. Intentar RPC admin_delete_user con target_user_id
      try {
        const { data: d2, error: e2 } = await (supabase.rpc as any)("admin_delete_user", {
          target_user_id: userId,
        });
        if (!e2 && d2) return;
      } catch {
        // Fallback
      }

      // 4. Intentar RPC admin_delete_user con p_target_user_id
      try {
        const { data: d3, error: e3 } = await (supabase.rpc as any)("admin_delete_user", {
          p_target_user_id: userId,
        });
        if (!e3 && d3) return;
      } catch {
        // Fallback
      }

      // 5. Fallback directo en cliente (desvincular supervisor y borrar perfil)
      try {
        await supabase.from("profiles").update({ assigned_supervisor_id: null } as any).eq("assigned_supervisor_id", userId);
        await supabase.from("user_roles").delete().eq("user_id", userId);
        const { error: pErr } = await supabase.from("profiles").delete().eq("id", userId);
        if (!pErr) return;
      } catch {
        // Fallback
      }

      throw new Error("No se pudo eliminar el usuario de la base de datos");
    },
    onMutate: async (userId) => {
      await qc.cancelQueries({ queryKey: ["all-profiles"] });
      qc.setQueryData(["all-profiles"], (old: any) =>
        Array.isArray(old) ? old.filter((u: any) => u.id !== userId) : [],
      );
    },
    onSuccess: () => {
      toast.success("Usuario eliminado definitivamente");
      setDeletingUser(null);
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
      qc.invalidateQueries({ queryKey: ["all-roles"] });
      qc.invalidateQueries({ queryKey: ["available-supervisors"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
    },
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

  const pendingRequests = useMemo(() => {
    return users.filter((u) => u.supervisor_status === "pending");
  }, [users]);

  const privateCount = useMemo(() => {
    return users.filter((u) => u.is_private).length;
  }, [users]);

  // Lista filtrada de usuarios para la tabla admin
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (u.display_name?.toLowerCase().includes(q) ?? false) ||
        (u.email?.toLowerCase().includes(q) ?? false) ||
        u.id.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      const userRoles = roles.filter((r) => r.user_id === u.id).map((r) => r.role);
      const isUAdmin = userRoles.includes("admin");
      const isUSupervisor = userRoles.includes("supervisor");
      const isUPending = u.supervisor_status === "pending";

      if (roleFilter === "admin" && !isUAdmin) return false;
      if (roleFilter === "supervisor" && !isUSupervisor) return false;
      if (roleFilter === "pending" && !isUPending) return false;
      if (roleFilter === "user" && (isUAdmin || isUSupervisor)) return false;

      return true;
    });
  }, [users, roles, searchQuery, roleFilter]);

  const currentSupervisorStatus = profile?.supervisor_status ?? "none";
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
                    <span className="text-xs text-muted-foreground">
                      Sin supervisor asignado
                    </span>
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

        {/* ESTRUCTURA POR PESTAÑAS (PERFIL, CHAT Y DIRECTORIO) */}
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 p-1 bg-muted/60 max-w-lg">
            <TabsTrigger value="profile" className="gap-2 font-semibold text-xs md:text-sm">
              <Sliders className="size-4" />
              <span className="truncate">Mi Perfil</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-2 font-semibold text-xs md:text-sm">
              <MessageSquare className="size-4" />
              <span className="truncate">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="admin" className="gap-2 font-semibold text-xs md:text-sm">
              <Users className="size-4" />
              <span className="truncate">{isAdmin ? "Gestión" : "Directorio"}</span>
              {isAdmin && pendingRequests.length > 0 && (
                <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                  {pendingRequests.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* TAB: GESTIÓN / DIRECTORIO DE USUARIOS */}
          <TabsContent value="admin" className="space-y-6">
            {/* Solicitudes de supervisor pendientes (Solo Admin) */}
            {isAdmin && pendingRequests.length > 0 && (
              <section className="panel border-amber-500/40 bg-amber-500/5 p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/20 text-amber-500">
                    <GraduationCap className="size-5" />
                  </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground">
                        Solicitudes para ser Supervisor ({pendingRequests.length})
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Los siguientes usuarios han solicitado ser supervisores en la plataforma.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {pendingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 space-y-3"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="size-10 border border-border">
                            <AvatarImage src={req.avatar_url ?? ""} />
                            <AvatarFallback className="bg-amber-500/10 text-amber-600 font-bold">
                              {req.display_name ? req.display_name.slice(0, 2).toUpperCase() : "TR"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-foreground">
                              {req.display_name || "Sin nombre"}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{req.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                          <Button
                            size="sm"
                            className="flex-1 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                            disabled={adminReviewSupervisor.isPending}
                            onClick={() =>
                              adminReviewSupervisor.mutate({ userId: req.id, approve: true })
                            }
                          >
                            <CheckCircle2 className="size-3.5" /> Aprobar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 gap-1 text-destructive hover:bg-destructive/10 text-xs"
                            disabled={adminReviewSupervisor.isPending}
                            onClick={() =>
                              adminReviewSupervisor.mutate({ userId: req.id, approve: false })
                            }
                          >
                            <XCircle className="size-3.5" /> Rechazar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* KPIs de Administración */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="panel p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Total Usuarios
                    </span>
                    <Users className="size-4 text-brand" />
                  </div>
                  <div className="num mt-2 text-2xl font-bold">{users.length}</div>
                  <span className="text-[11px] text-muted-foreground">Cuentas registradas</span>
                </div>

                <div className="panel p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Administradores
                    </span>
                    <Shield className="size-4 text-brand" />
                  </div>
                  <div className="num mt-2 text-2xl font-bold text-brand">{adminCount}</div>
                  <span className="text-[11px] text-muted-foreground">Control total</span>
                </div>

                <div className="panel p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Supervisores
                    </span>
                    <ShieldCheck className="size-4 text-amber-500" />
                  </div>
                  <div className="num mt-2 text-2xl font-bold text-amber-500">{supervisorCount}</div>
                  <span className="text-[11px] text-muted-foreground">Aprobados activos</span>
                </div>

                <div className="panel p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Solicitudes Pendientes
                    </span>
                    <Clock className="size-4 text-purple-500" />
                  </div>
                  <div className="num mt-2 text-2xl font-bold text-purple-500">
                    {pendingRequests.length}
                  </div>
                  <span className="text-[11px] text-muted-foreground">En espera de revisión</span>
                </div>
              </div>

              {/* Barra de Filtros & Búsqueda */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, correo o ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 text-xs"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRoleFilter("all")}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                      roleFilter === "all"
                        ? "bg-brand text-brand-foreground shadow-xs"
                        : "border border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Todos ({users.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter("admin")}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                      roleFilter === "admin"
                        ? "bg-brand text-brand-foreground shadow-xs"
                        : "border border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Admins ({adminCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter("supervisor")}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                      roleFilter === "supervisor"
                        ? "bg-brand text-brand-foreground shadow-xs"
                        : "border border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Supervisores ({supervisorCount})
                  </button>
                  {pendingRequests.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setRoleFilter("pending")}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                        roleFilter === "pending"
                          ? "bg-amber-500 text-white shadow-xs"
                          : "border border-amber-500/40 text-amber-600 hover:text-amber-500",
                      )}
                    >
                      Solicitudes ({pendingRequests.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setRoleFilter("user")}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                      roleFilter === "user"
                        ? "bg-brand text-brand-foreground shadow-xs"
                        : "border border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Traders ({users.length - adminCount - supervisorCount})
                  </button>
                </div>
              </div>

              {/* Tabla de Usuarios */}
              <div className="panel overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs md:text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3">Usuario</th>
                        <th className="px-4 py-3">Roles</th>
                        <th className="px-4 py-3">Supervisión</th>
                        <th className="px-4 py-3">Privacidad</th>
                        <th className="px-4 py-3 text-right">{isAdmin ? "Acciones" : "Estado"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-muted-foreground">
                            No se encontraron usuarios con ese criterio.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => {
                          const userRoles = roles.filter((r) => r.user_id === u.id).map((r) => r.role);
                          const isUAdmin = userRoles.includes("admin");
                          const isUSupervisor = userRoles.includes("supervisor");
                          const isCurrent = u.id === user?.id;
                          const assignedSup = availableSupervisors.find(
                            (s) => s.id === u.assigned_supervisor_id,
                          );

                          return (
                            <tr key={u.id} className="transition-colors hover:bg-muted/20">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <Avatar className="size-9 border border-border">
                                    <AvatarImage src={u.avatar_url ?? ""} />
                                    <AvatarFallback className="bg-brand/10 text-xs font-bold text-brand">
                                      {u.display_name
                                        ? u.display_name.slice(0, 2).toUpperCase()
                                        : u.email?.slice(0, 2).toUpperCase() ?? "TR"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold text-foreground">
                                      {u.display_name || "Sin nombre visible"}
                                      {isCurrent && (
                                        <span className="ml-1.5 rounded-full bg-brand/10 px-1.5 py-0.2 text-[10px] font-bold text-brand">
                                          Tú
                                        </span>
                                      )}
                                    </p>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <span className="truncate">{u.email || "Sin correo"}</span>
                                      {u.email && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(u.email!);
                                            toast.success("Correo copiado al portapapeles");
                                          }}
                                          className="text-muted-foreground hover:text-foreground"
                                          title="Copiar correo"
                                        >
                                          <Copy className="size-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {isUAdmin && (
                                    <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-bold text-brand">
                                      Admin
                                    </span>
                                  )}
                                  {isUSupervisor && (
                                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-500">
                                      Supervisor
                                    </span>
                                  )}
                                  {!isUAdmin && !isUSupervisor && (
                                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                      Trader
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="px-4 py-3 text-xs">
                                {u.supervisor_status === "pending" ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 font-bold text-amber-600">
                                    <Clock className="size-3" /> Solicitud pendiente
                                  </span>
                                ) : assignedSup ? (
                                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                                    <UserCheck className="size-3 text-brand" /> {assignedSup.display_name}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/60">—</span>
                                )}
                              </td>

                              <td className="px-4 py-3">
                                {u.is_private ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600">
                                    <Lock className="size-3" /> Privado
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                                    <Unlock className="size-3" /> Visible
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-3 text-right">
                                {isAdmin ? (
                                  <div className="flex items-center justify-end gap-1">
                                    {u.supervisor_status === "pending" && (
                                      <>
                                        <Button
                                          size="sm"
                                          className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                                          disabled={adminReviewSupervisor.isPending}
                                          onClick={() =>
                                            adminReviewSupervisor.mutate({ userId: u.id, approve: true })
                                          }
                                          title="Aprobar supervisor"
                                        >
                                          <CheckCircle2 className="size-3.5" /> Aprobar
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-8 text-destructive text-xs gap-1"
                                          disabled={adminReviewSupervisor.isPending}
                                          onClick={() =>
                                            adminReviewSupervisor.mutate({ userId: u.id, approve: false })
                                          }
                                          title="Rechazar solicitud"
                                        >
                                          <XCircle className="size-3.5" /> Rechazar
                                        </Button>
                                      </>
                                    )}

                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 gap-1 text-xs"
                                      onClick={() => {
                                        setEditingUser(u);
                                        setEditEmail(u.email ?? "");
                                        setEditPassword("");
                                      }}
                                    >
                                      <KeyRound className="size-3.5" />
                                      <span className="hidden sm:inline">Credenciales</span>
                                    </Button>

                                    <Button
                                      variant={isUSupervisor ? "default" : "outline"}
                                      size="sm"
                                      className={cn(
                                        "h-8 text-xs",
                                        isUSupervisor && "bg-amber-500 hover:bg-amber-600 text-white",
                                      )}
                                      disabled={toggleRole.isPending}
                                      onClick={() =>
                                        toggleRole.mutate({
                                          userId: u.id,
                                          role: "supervisor",
                                          grant: !isUSupervisor,
                                        })
                                      }
                                      title={isUSupervisor ? "Quitar rol supervisor" : "Hacer supervisor"}
                                    >
                                      <ShieldCheck className="size-3.5" />
                                      <span className="hidden sm:inline">
                                        {isUSupervisor ? "Supervisor" : "+ Sup"}
                                      </span>
                                    </Button>

                                    <Button
                                      variant={isUAdmin ? "default" : "outline"}
                                      size="sm"
                                      className="h-8 text-xs"
                                      disabled={isCurrent || toggleRole.isPending}
                                      onClick={() =>
                                        toggleRole.mutate({
                                          userId: u.id,
                                          role: "admin",
                                          grant: !isUAdmin,
                                        })
                                      }
                                      title={isUAdmin ? "Quitar rol administrador" : "Hacer administrador"}
                                    >
                                      <Shield className="size-3.5" />
                                      <span className="hidden sm:inline">
                                        {isUAdmin ? "Admin" : "+ Admin"}
                                      </span>
                                    </Button>

                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                      disabled={isCurrent}
                                      onClick={() => setDeletingUser(u)}
                                      title={
                                        isCurrent
                                          ? "No puedes eliminar tu propia cuenta"
                                          : "Eliminar usuario definitivamente"
                                      }
                                    >
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Activo</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* TAB MI PERFIL (Para administradores) */}
            <TabsContent value="profile">
              <ProfileSettingsGrid
                user={user}
                name={name}
                setName={setName}
                avatar={avatar}
                setAvatar={setAvatar}
                saveProfile={saveProfile}
                isPrivate={isPrivate}
                togglePrivate={togglePrivate}
                hasSupervisor={hasSupervisor}
                setHasSupervisor={setHasSupervisor}
                selectedSupervisorId={selectedSupervisorId}
                setSelectedSupervisorId={setSelectedSupervisorId}
                saveAssignedSupervisor={saveAssignedSupervisor}
                availableSupervisors={availableSupervisors}
                currentSupervisorStatus={currentSupervisorStatus}
                applyForSupervisor={applyForSupervisor}
                cancelSupervisorApplication={cancelSupervisorApplication}
                isSupervisor={isSupervisor}
                isAdmin={isAdmin}
                theme={theme}
                setTheme={setTheme}
              />
            </TabsContent>

            {/* TAB CHAT INTERNO */}
            <TabsContent value="chat" className="space-y-6">
              <div className="panel p-5 md:p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <MessageSquare className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Chat con tu Supervisor</h3>
                    <p className="text-xs text-muted-foreground">
                      Conversación privada sobre tus operaciones, estrategia y rendimiento con tus supervisores autorizados.
                    </p>
                  </div>
                </div>

                <ChatThread
                  subjectUserId={user?.id ?? null}
                  title="Mi hilo privado"
                  hint="Solo visible para ti y los supervisores de la plataforma."
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

      {/* DIÁLOGO: EDITAR CREDENCIALES (ADMIN) */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modificar Credenciales de Acceso</DialogTitle>
            <DialogDescription>
              Actualiza el correo electrónico y/o la contraseña de {editingUser?.display_name || "este usuario"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Correo electrónico</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="nuevo@correo.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-password">Nueva contraseña</Label>
              <Input
                id="edit-password"
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres (dejar en blanco para no cambiar)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancelar
            </Button>
            <Button
              disabled={updateCredentials.isPending}
              onClick={() => {
                if (!editingUser) return;
                updateCredentials.mutate({
                  userId: editingUser.id,
                  newEmail: editEmail,
                  newPassword: editPassword,
                });
              }}
            >
              {updateCredentials.isPending ? "Guardando…" : "Guardar credenciales"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO: CONFIRMAR ELIMINACIÓN DE USUARIO (ADMIN) */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar definitivamente a este usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la cuenta de{" "}
              <strong>{deletingUser?.display_name || deletingUser?.email}</strong>, sus diarios,
              operaciones, cuentas e historial de la base de datos de forma irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteUser.isPending}
              onClick={() => {
                if (deletingUser) {
                  deleteUser.mutate(deletingUser.id);
                }
              }}
            >
              {deleteUser.isPending ? "Eliminando…" : "Sí, eliminar usuario"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

/** COMPONENTE REUTILIZABLE: CUADRÍCULA DE AJUSTES DEL PERFIL - GOOGLE AI (GEMINI) */
function GoogleAiSettingsCard() {
  const testConn = useServerFn(testGoogleAiConnection);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(DEFAULT_GEMINI_MODEL);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setApiKey(getLocalGoogleAiKey());
    setModel(getLocalGoogleAiModel());
  }, []);

  const handleSave = () => {
    setLocalGoogleAiKey(apiKey);
    setLocalGoogleAiModel(model);
    toast.success("Configuración de Google AI guardada correctamente");
  };

  const handleTest = async () => {
    if (!apiKey.trim()) {
      toast.error("Introduce tu clave API de Google AI Studio antes de probar");
      return;
    }
    setTesting(true);
    try {
      const res = await testConn({
        data: { apiKey: apiKey.trim(), model },
      });
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (e: any) {
      toast.error(e?.message || "Error al conectar con Google AI");
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="panel flex flex-col justify-between p-5 md:col-span-2 xl:col-span-1">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Google AI (Gemini)</h3>
              <p className="text-xs text-muted-foreground">Tu cuenta de Google AI Studio para capturas</p>
            </div>
          </div>
          {apiKey.trim() ? (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
              Conectado
            </span>
          ) : (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
              Sin configurar
            </span>
          )}
        </div>

        <div className="space-y-3 text-xs">
          <p className="text-muted-foreground leading-relaxed">
            Usa tu propia clave gratuita de Google AI Studio para procesar capturas de pantalla, fotos del historial y visión de operaciones con Gemini 2.0 Flash.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="google-api-key" className="text-xs font-semibold">
              Clave API de Google AI Studio
            </Label>
            <div className="relative">
              <Input
                id="google-api-key"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="pr-10 text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showKey ? "Ocultar clave" : "Mostrar clave"}
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="google-ai-model" className="text-xs font-semibold">
              Modelo Gemini
            </Label>
            <select
              id="google-ai-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-ring"
            >
              {AVAILABLE_GEMINI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:underline"
          >
            Obtener clave 100% gratuita en Google AI Studio <ExternalLink className="size-3" />
          </a>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 pt-3 border-t border-border/60">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={testing || !apiKey.trim()}
          onClick={handleTest}
          className="flex-1 text-xs"
        >
          {testing ? "Comprobando…" : "Probar Conexión"}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          className="flex-1 gap-1 text-xs"
        >
          <Save className="size-3.5" /> Guardar
        </Button>
      </div>
    </section>
  );
}

function ProfileSettingsGrid({
  user,
  name,
  setName,
  avatar,
  setAvatar,
  saveProfile,
  isPrivate,
  togglePrivate,
  hasSupervisor,
  setHasSupervisor,
  selectedSupervisorId,
  setSelectedSupervisorId,
  saveAssignedSupervisor,
  availableSupervisors,
  currentSupervisorStatus,
  applyForSupervisor,
  cancelSupervisorApplication,
  isSupervisor,
  isAdmin,
  theme,
  setTheme,
}: {
  user: any;
  name: string;
  setName: (v: string) => void;
  avatar: string;
  setAvatar: (v: string) => void;
  saveProfile: any;
  isPrivate: boolean;
  togglePrivate: any;
  hasSupervisor: boolean;
  setHasSupervisor: (v: boolean) => void;
  selectedSupervisorId: string;
  setSelectedSupervisorId: (v: string) => void;
  saveAssignedSupervisor: any;
  availableSupervisors: AvailableSupervisor[];
  currentSupervisorStatus: string;
  applyForSupervisor: any;
  cancelSupervisorApplication: any;
  isSupervisor: boolean;
  isAdmin: boolean;
  theme: string;
  setTheme: (t: "light" | "dark") => void;
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
              {saveProfile.isPending ? "Guardando…" : "Guardar datos"}
            </Button>
          </div>
        </section>

        {/* Card 2: Supervisión y Asignación Voluntaria */}
        <section className="panel flex flex-col justify-between p-5">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                <UserCheck className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Supervisión de mi Cuenta</h3>
                <p className="text-xs text-muted-foreground">Elige tu supervisor asignado</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-border/80 p-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-foreground">
                    {hasSupervisor ? "Supervisión Activada" : "Sin Supervisor"}
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    {hasSupervisor ? "Compartir con un supervisor" : "No compartir operaciones"}
                  </p>
                </div>
                <Switch
                  checked={hasSupervisor}
                  onCheckedChange={(checked) => {
                    setHasSupervisor(checked);
                    if (!checked) {
                      setSelectedSupervisorId("none");
                    }
                  }}
                />
              </div>

              {hasSupervisor && (
                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs font-semibold">
                    Selecciona tu supervisor en la lista:
                  </Label>
                  <Select
                    value={selectedSupervisorId}
                    onValueChange={(val) => setSelectedSupervisorId(val)}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Elige un supervisor..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin supervisor seleccionado</SelectItem>
                      {availableSupervisors.map((sup) => (
                        <SelectItem key={sup.id} value={sup.id}>
                          {sup.display_name} {sup.email ? `(${sup.email})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Solo este supervisor podrá consultar tus resultados en el panel y apoyarte.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-border/60">
            <Button
              className="w-full gap-1.5"
              disabled={saveAssignedSupervisor.isPending}
              onClick={() =>
                saveAssignedSupervisor.mutate({
                  enabled: hasSupervisor,
                  supId: selectedSupervisorId,
                })
              }
            >
              <Save className="size-4" />
              {saveAssignedSupervisor.isPending ? "Guardando…" : "Guardar preferencia de supervisión"}
            </Button>
          </div>
        </section>

        {/* Card 3: Solicitud de Rol Supervisor */}
        <section className="panel flex flex-col justify-between p-5 md:col-span-2 xl:col-span-1">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <GraduationCap className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Candidatura a Supervisor</h3>
                <p className="text-xs text-muted-foreground">Supervisa el progreso de otros traders</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {isAdmin ? (
                <div className="rounded-xl border border-brand/30 bg-brand/5 p-3.5 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-brand">
                    <Shield className="size-4" /> Eres Administrador Principal
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Tienes permisos completos para supervisar cuentas, asignar tutores y aprobar o rechazar solicitudes de otros usuarios.
                  </p>
                </div>
              ) : isSupervisor ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-600">
                    <CheckCircle2 className="size-4" /> Eres Supervisor Aprobado
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Apareces en el directorio público y los usuarios pueden seleccionarte como su tutor para que revises su operativa.
                  </p>
                </div>
              ) : currentSupervisorStatus === "pending" ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-amber-600">
                    <Clock className="size-4" /> Solicitud en Revisión
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Tu solicitud para ser supervisor ha sido enviada al administrador y está pendiente de aprobación.
                  </p>
                </div>
              ) : currentSupervisorStatus === "rejected" ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-destructive">
                    <XCircle className="size-4" /> Solicitud Anterior Rechazada
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Puedes volver a presentar tu candidatura a supervisor cuando lo desees para una nueva revisión.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-xs space-y-2">
                  <p className="text-muted-foreground leading-relaxed">
                    Como supervisor podrás ver el resumen de los traders que te elijan como su tutor y apoyarlos en su crecimiento.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-border/60">
            {currentSupervisorStatus === "pending" ? (
              <Button
                variant="outline"
                className="w-full gap-2 border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
                disabled={cancelSupervisorApplication.isPending}
                onClick={() => cancelSupervisorApplication.mutate()}
              >
                <X className="size-4" />
                {cancelSupervisorApplication.isPending ? "Cancelando…" : "Cancelar solicitud de supervisor"}
              </Button>
            ) : !isAdmin && !isSupervisor ? (
              <Button
                className="w-full gap-2 font-semibold shadow-xs"
                disabled={applyForSupervisor.isPending}
                onClick={() => applyForSupervisor.mutate()}
              >
                {currentSupervisorStatus === "rejected" ? (
                  <>
                    <RotateCcw className="size-4" />
                    {applyForSupervisor.isPending ? "Enviando…" : "Volver a solicitar ser Supervisor"}
                  </>
                ) : (
                  <>
                    <Send className="size-4" />
                    {applyForSupervisor.isPending ? "Enviando…" : "Solicitar ser Supervisor"}
                  </>
                )}
              </Button>
            ) : (
              <div className="text-center text-xs text-muted-foreground py-1">
                {isAdmin ? "Rol de Administrador con acceso a supervisión" : "Rol de Supervisor activo"}
              </div>
            )}
          </div>
        </section>

        {/* Card 4: Google AI Studio (Gemini) */}
        <GoogleAiSettingsCard />

        {/* Card 5: Apariencia del Sistema */}
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

      {/* Card 6: Integraciones de Trading */}
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

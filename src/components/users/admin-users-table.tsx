import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Search,
  KeyRound,
  Trash2,
  Lock,
  Unlock,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { deleteUserAdminFn, updateCredentialsAdminFn } from "@/lib/admin.functions";
import { formatDateTime } from "@/lib/metrics";
import { cn } from "@/lib/utils";

export interface AdminUserItem {
  id: string;
  email?: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  is_private?: boolean;
  supervisor_status?: "none" | "pending" | "approved" | "rejected";
}

interface AdminUsersTableProps {
  users: AdminUserItem[];
  roles: Record<string, string[]>;
}

export function AdminUsersTable({ users, roles }: AdminUsersTableProps) {
  const { user: currentAuthUser, canEditOtherUsers, setCanEditOtherUsers } = useAuth();
  const qc = useQueryClient();

  const deleteUserServer = useServerFn(deleteUserAdminFn);
  const updateCredentialsServer = useServerFn(updateCredentialsAdminFn);

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "supervisor" | "pending" | "user">("all");

  // Modales
  const [editingUser, setEditingUser] = useState<AdminUserItem | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [deletingUser, setDeletingUser] = useState<AdminUserItem | null>(null);

  // Conteo de roles
  const adminCount = useMemo(
    () => Object.values(roles).filter((r) => r.includes("admin")).length,
    [roles],
  );
  const supervisorCount = useMemo(
    () => Object.values(roles).filter((r) => r.includes("supervisor")).length,
    [roles],
  );
  const pendingCount = useMemo(
    () => users.filter((u) => u.supervisor_status === "pending").length,
    [users],
  );

  // Lista filtrada
  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return users.filter((u) => {
      if (q) {
        const matchName = (u.display_name ?? "").toLowerCase().includes(q);
        const matchEmail = (u.email ?? "").toLowerCase().includes(q);
        const matchId = u.id.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchId) return false;
      }

      const uRoles = roles[u.id] ?? [];
      const isUAdmin = uRoles.includes("admin");
      const isUSupervisor = uRoles.includes("supervisor");
      const isUPending = u.supervisor_status === "pending";

      if (roleFilter === "admin" && !isUAdmin) return false;
      if (roleFilter === "supervisor" && !isUSupervisor) return false;
      if (roleFilter === "pending" && !isUPending) return false;
      if (roleFilter === "user" && (isUAdmin || isUSupervisor)) return false;

      return true;
    });
  }, [users, roles, searchQuery, roleFilter]);

  // Mutación: Cambiar rol de usuario
  const toggleRole = useMutation({
    mutationFn: async ({ userId, role, add }: { userId: string; role: "admin" | "user" | "supervisor"; add: boolean }) => {
      if (add) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role } as any);
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
      toast.success("Rol actualizado con éxito");
      qc.invalidateQueries({ queryKey: ["all-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mutación: Actualizar credenciales
  const updateCredentials = useMutation({
    mutationFn: async () => {
      if (!editingUser) return;
      await updateCredentialsServer({
        data: {
          targetUserId: editingUser.id,
          email: editEmail.trim() || undefined,
          password: editPassword.trim() || undefined,
        },
      });
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

  // Mutación: Eliminar usuario
  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      await deleteUserServer({ data: { targetUserId: userId } });
    },
    onSuccess: () => {
      toast.success("Usuario eliminado de Vita-Trading");
      setDeletingUser(null);
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
      qc.invalidateQueries({ queryKey: ["all-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
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
              Solicitudes
            </span>
            <Clock className="size-4 text-purple-500" />
          </div>
          <div className="num mt-2 text-2xl font-bold text-purple-500">{pendingCount}</div>
          <span className="text-[11px] text-muted-foreground">Pendientes de revisión</span>
        </div>
      </div>

      {/* Control Maestro de Edición para el Administrador */}
      <section className="panel p-5 bg-card/60 border border-brand/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h4 className="flex items-center gap-2 font-display text-base tracking-wide text-brand">
              {canEditOtherUsers ? <Unlock className="size-4" /> : <Lock className="size-4" />}
              Modo de Edición Global para Administrador
            </h4>
            <p className="text-xs text-muted-foreground max-w-lg">
              {canEditOtherUsers
                ? "Edición activa. Puedes crear, modificar o borrar operaciones y cuentas al supervisar a cualquier usuario."
                : "Modo seguro (Solo Lectura). Puedes consultar diarios sin riesgo de modificar o borrar datos ajenos."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={canEditOtherUsers} onCheckedChange={setCanEditOtherUsers} />
            <span className="text-xs font-semibold">
              {canEditOtherUsers ? "Edición Permitida" : "Solo Lectura"}
            </span>
          </div>
        </div>
      </section>

      {/* Filtros & Búsqueda */}
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
          {(
            [
              { key: "all", label: `Todos (${users.length})` },
              { key: "admin", label: `Admins (${adminCount})` },
              { key: "supervisor", label: `Supervisores (${supervisorCount})` },
              { key: "user", label: "Traders" },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setRoleFilter(item.key)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                roleFilter === item.key
                  ? "bg-brand text-brand-foreground shadow-xs"
                  : "border border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla de Usuarios */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-muted/40 font-display text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3">Usuario</th>
              <th className="p-3">Roles</th>
              <th className="p-3">Privacidad</th>
              <th className="p-3">Registro</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  No se encontraron usuarios con los filtros aplicados.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const uRoles = roles[u.id] ?? [];
                const isUAdmin = uRoles.includes("admin");
                const isUSupervisor = uRoles.includes("supervisor");
                const isSelf = u.id === currentAuthUser?.id;

                return (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8">
                          <AvatarImage src={u.avatar_url ?? ""} />
                          <AvatarFallback className="text-[11px] font-bold">
                            {u.display_name?.slice(0, 2).toUpperCase() || "TR"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-bold text-foreground">
                            <span className="truncate">{u.display_name || "Sin nombre"}</span>
                            {isSelf && (
                              <span className="rounded-sm bg-brand/15 px-1.5 py-0.2 text-[10px] text-brand">
                                Tú
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {isUAdmin && (
                          <span className="rounded-md bg-brand/15 px-2 py-0.5 text-[11px] font-bold text-brand">
                            Admin
                          </span>
                        )}
                        {isUSupervisor && (
                          <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-500">
                            Supervisor
                          </span>
                        )}
                        {!isUAdmin && !isUSupervisor && (
                          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            Trader
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-[11px] font-medium",
                          u.is_private ? "text-muted-foreground" : "text-emerald-500",
                        )}
                      >
                        {u.is_private ? "Privado" : "Público"}
                      </span>
                    </td>

                    <td className="p-3 text-muted-foreground text-[11px]">
                      {formatDateTime(u.created_at)}
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          title="Gestionar credenciales"
                          onClick={() => {
                            setEditingUser(u);
                            setEditEmail(u.email ?? "");
                            setEditPassword("");
                          }}
                        >
                          <KeyRound className="size-3.5 text-muted-foreground hover:text-foreground" />
                        </Button>

                        <Select
                          value={isUAdmin ? "admin" : isUSupervisor ? "supervisor" : "user"}
                          onValueChange={(newRole) => {
                            if (newRole === "admin") {
                              toggleRole.mutate({ userId: u.id, role: "admin", add: true });
                            } else if (newRole === "supervisor") {
                              if (isUAdmin) {
                                toggleRole.mutate({ userId: u.id, role: "admin", add: false });
                              }
                              toggleRole.mutate({ userId: u.id, role: "supervisor", add: true });
                            } else {
                              if (isUAdmin) {
                                toggleRole.mutate({ userId: u.id, role: "admin", add: false });
                              }
                              if (isUSupervisor) {
                                toggleRole.mutate({ userId: u.id, role: "supervisor", add: false });
                              }
                            }
                          }}
                          disabled={isSelf}
                        >
                          <SelectTrigger className="h-7 text-[11px] w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent align="end">
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="supervisor">Supervisor</SelectItem>
                            <SelectItem value="user">Trader</SelectItem>
                          </SelectContent>
                        </Select>

                        {!isSelf && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                            title="Eliminar usuario"
                            onClick={() => setDeletingUser(u)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Diálogo para Editar Credenciales */}
      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl tracking-wide">
              Credenciales de {editingUser?.display_name || "Usuario"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Modifica el correo o restablece la contraseña de acceso de este usuario.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateCredentials.mutate();
            }}
            className="space-y-4 pt-2"
          >
            <div>
              <Label className="text-xs">Correo Electrónico</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="nuevo@correo.com"
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Nueva Contraseña (dejar en blanco para no cambiar)</Label>
              <Input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="mt-1 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingUser(null)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={updateCredentials.isPending}
                className="text-xs font-display tracking-wide"
              >
                {updateCredentials.isPending ? "Actualizando..." : "Guardar Credenciales"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AlertDialog para Eliminar Usuario */}
      <AlertDialog open={Boolean(deletingUser)} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl tracking-wide text-destructive">
              ¿Eliminar usuario definitivamente?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Estás a punto de eliminar la cuenta de <strong>{deletingUser?.email}</strong>. Esta acción
              es irreversible y eliminará todos sus diarios, cuentas y operaciones asociadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-display tracking-wide"
              onClick={() => deletingUser && deleteUser.mutate(deletingUser.id)}
            >
              Sí, Eliminar Usuario
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

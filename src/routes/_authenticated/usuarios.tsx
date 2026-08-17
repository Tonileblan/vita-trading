import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Coffee,
  Eye,
  KeyRound,
  Lock,
  Mail,
  Moon,
  ShieldCheck,
  ShieldOff,
  Sun,
  Trash2,
  Unlock,
} from "lucide-react";
import { useEffect, useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { IntegrationsPanel } from "@/components/integrations-panel";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuarios — Vita-Trading" },
      {
        name: "description",
        content: "Gestiona tu perfil y, si eres administrador, los roles y credenciales del resto de usuarios.",
      },
      { property: "og:title", content: "Usuarios — Vita-Trading" },
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
  const { user, profile, isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const isPrivate = profile?.is_private ?? false;

  // Estados para diálogos de administración
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);

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

  useEffect(() => {
    setName(profile?.display_name ?? "");
    setAvatar(profile?.avatar_url ?? "");
  }, [profile]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: name.trim() || null, avatar_url: avatar.trim() || null })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil actualizado");
      qc.invalidateQueries({ queryKey: ["profile"] });
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
      toast.success("Roles actualizados");
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
      toast.success("Usuario eliminado correctamente");
      setDeletingUser(null);
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
      qc.invalidateQueries({ queryKey: ["all-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Usuarios"
      subtitle={isAdmin ? "Administrador · gestiona perfiles, credenciales y permisos" : "Tu perfil"}
      showAccountPanel={false}
    >
      <div className="space-y-5">
        <section className="panel max-w-lg space-y-3 p-5">
          <h2 className="text-base font-semibold">Mi perfil</h2>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Nombre visible</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-avatar">URL del avatar</Label>
            <Input id="p-avatar" value={avatar} onChange={(e) => setAvatar(e.target.value)} />
          </div>
          <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
            Guardar perfil
          </Button>
        </section>

        <section className="panel max-w-lg space-y-3 p-5">
          <h2 className="text-base font-semibold">Privacidad</h2>
          <p className="text-xs text-muted-foreground">
            {isPrivate
              ? "Tu perfil es privado: nadie más, ni siquiera un supervisor, puede ver tus diarios, cuentas, operaciones ni tu chat."
              : "Los supervisores pueden ver tu resumen y comentarte en el chat interno."}
          </p>
          <Button
            variant={isPrivate ? "default" : "outline"}
            disabled={togglePrivate.isPending}
            onClick={() => togglePrivate.mutate(!isPrivate)}
          >
            {isPrivate ? <Lock className="size-4" /> : <Unlock className="size-4" />}
            {isPrivate ? "Perfil privado activado" : "Hacer perfil privado"}
          </Button>
        </section>

        <section className="panel max-w-lg space-y-3 p-5">
          <h2 className="text-base font-semibold">Apariencia</h2>
          <p className="text-xs text-muted-foreground">Elige el tema de la interfaz.</p>
          <div className="flex gap-2">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              onClick={() => setTheme("light")}
            >
              <Sun className="size-4" /> Modo claro
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              onClick={() => setTheme("dark")}
            >
              <Moon className="size-4" /> Modo oscuro
            </Button>
          </div>
        </section>

        <section className="panel space-y-4 p-5">
          <div>
            <h2 className="text-base font-semibold">Integraciones</h2>
            <p className="text-xs text-muted-foreground">
              Automatiza el registro de operaciones con n8n, MetaTrader, cTrader o NinjaTrader 8.
            </p>
          </div>
          <IntegrationsPanel />
        </section>

        {isAdmin && (
          <section className="panel p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Todos los usuarios</h2>
                <p className="text-xs text-muted-foreground">
                  Como administrador, puedes cambiar el correo o contraseña de cualquier usuario, gestionar sus roles o eliminar su cuenta.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">Usuario / Nombre</th>
                    <th className="py-2">Correo electrónico</th>
                    <th className="py-2">Alta</th>
                    <th className="py-2">Roles</th>
                    <th className="py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const userRoles = roles.filter((r) => r.user_id === u.id).map((r) => r.role);
                    const admin = userRoles.includes("admin");
                    const supervisor = userRoles.includes("supervisor");
                    const isSelf = u.id === user?.id;

                    return (
                      <tr key={u.id} className="border-t border-border">
                        <td className="py-2">
                          <div className="font-medium text-foreground">
                            {u.display_name ?? "Sin nombre"}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            ID: {u.id.slice(0, 8)}…
                          </div>
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {u.email ? (
                            <span className="font-mono text-xs text-foreground">{u.email}</span>
                          ) : (
                            <span className="text-xs italic text-muted-foreground">
                              {isSelf ? user?.email : "No disponible"}
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString("es-ES")}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1">
                            {admin && (
                              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                                Admin
                              </span>
                            )}
                            {supervisor && (
                              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                Supervisor
                              </span>
                            )}
                            {!admin && !supervisor && (
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                Usuario
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {/* Botón Editar Credenciales */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingUser(u);
                                setEditEmail(u.email ?? (isSelf ? (user?.email ?? "") : ""));
                                setEditPassword("");
                              }}
                              title="Cambiar correo y contraseña"
                            >
                              <KeyRound className="size-3.5" />
                              <span className="hidden sm:inline">Credenciales</span>
                            </Button>

                            {/* Botón Asignar Supervisor */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                toggleRole.mutate({
                                  userId: u.id,
                                  role: "supervisor",
                                  grant: !supervisor,
                                })
                              }
                              title={supervisor ? "Quitar rol de supervisor" : "Hacer supervisor"}
                            >
                              <Eye className="size-3.5" />
                              <span className="hidden md:inline">
                                {supervisor ? "Quitar Sup." : "Hacer Sup."}
                              </span>
                            </Button>

                            {/* Botón Asignar Admin */}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isSelf}
                              onClick={() =>
                                toggleRole.mutate({ userId: u.id, role: "admin", grant: !admin })
                              }
                              title={admin ? "Quitar rol de admin" : "Hacer admin"}
                            >
                              {admin ? (
                                <>
                                  <ShieldOff className="size-3.5" />
                                  <span className="hidden md:inline">Quitar Admin</span>
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="size-3.5" />
                                  <span className="hidden md:inline">Hacer Admin</span>
                                </>
                              )}
                            </Button>

                            {/* Botón Borrar Usuario */}
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={isSelf}
                              onClick={() => setDeletingUser(u)}
                              title={isSelf ? "No puedes borrarte a ti mismo" : "Eliminar usuario"}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Diálogo para editar correo y contraseña */}
        <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="size-5 text-brand" />
                Cambiar credenciales
              </DialogTitle>
              <DialogDescription>
                Modifica el correo electrónico o asigna una nueva contraseña para{" "}
                <strong>{editingUser?.display_name ?? editingUser?.email ?? "este usuario"}</strong>.
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
                <Label htmlFor="edit-email" className="flex items-center gap-1.5">
                  <Mail className="size-3.5" /> Correo electrónico
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
                <Label htmlFor="edit-pass" className="flex items-center gap-1.5">
                  <Lock className="size-3.5" /> Nueva contraseña
                </Label>
                <Input
                  id="edit-pass"
                  type="password"
                  minLength={6}
                  placeholder="Dejar en blanco para no cambiarla"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Mínimo 6 caracteres. Si no deseas cambiar la contraseña, déjalo vacío.
                </p>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingUser(null)}
                  disabled={updateCredentials.isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateCredentials.isPending}>
                  {updateCredentials.isPending ? "Guardando…" : "Guardar cambios"}
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
                  <strong>{deletingUser?.display_name ?? deletingUser?.email ?? "este usuario"}</strong>.
                </span>
                <span className="block font-medium text-destructive">
                  Esta acción no se puede deshacer. Se eliminarán permanentemente su usuario, todos sus diarios, cuentas, estrategias y operaciones registradas.
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
                {deleteUser.isPending ? "Eliminando…" : "Sí, eliminar usuario"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <footer className="mt-10 flex flex-col items-center gap-3 border-t border-ink/10 pt-6 text-center">
          <p className="font-hand text-xl text-ink/70">
            Creado por Toni
          </p>
          <a
            href="https://www.buymeacoffee.com/leblangarcs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#ff813f] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#ff7a2e]"
          >
            <Coffee className="size-4" />
            Invítame a un café
          </a>
        </footer>
      </div>
    </AppShell>
  );
}

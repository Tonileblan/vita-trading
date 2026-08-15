import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Moon, ShieldCheck, ShieldOff, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
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
        content: "Gestiona tu perfil y, si eres administrador, los roles del resto de usuarios.",
      },
      { property: "og:title", content: "Usuarios — Vita-Trading" },
      {
        property: "og:description",
        content: "Perfiles, nombres visibles y permisos de administrador.",
      },
    ],
  }),
  component: UsersPage,
});

interface Row {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

function UsersPage() {
  const { user, profile, isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");

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
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
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

  return (
    <AppShell
      title="Usuarios"
      subtitle={isAdmin ? "Administrador · gestiona perfiles y permisos" : "Tu perfil"}
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
            <h2 className="mb-3 text-base font-semibold">Todos los usuarios</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">Usuario</th>
                    <th className="py-2">Alta</th>
                    <th className="py-2">Roles</th>
                    <th className="py-2 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const userRoles = roles.filter((r) => r.user_id === u.id).map((r) => r.role);
                    const admin = userRoles.includes("admin");
                    const supervisor = userRoles.includes("supervisor");
                    return (
                      <tr key={u.id} className="border-t border-border">
                        <td className="py-2">{u.display_name ?? u.id.slice(0, 8)}</td>
                        <td className="py-2 text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString("es-ES")}
                        </td>
                        <td className="py-2">{userRoles.join(", ") || "user"}</td>
                        <td className="py-2">
                          <div className="flex flex-wrap justify-end gap-2">
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
                            >
                              <Eye className="size-4" />
                              {supervisor ? "Quitar supervisor" : "Hacer supervisor"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={u.id === user?.id}
                              onClick={() =>
                                toggleRole.mutate({ userId: u.id, role: "admin", grant: !admin })
                              }
                            >
                              {admin ? (
                                <>
                                  <ShieldOff className="size-4" /> Quitar admin
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="size-4" /> Hacer admin
                                </>
                              )}
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

        <footer className="mt-10 flex flex-col items-center gap-3 border-t border-ink/10 pt-6 text-center">
          <p className="font-hand text-xl text-ink/70">
            Creado por Toni
          </p>
          <a
            href="https://www.buymeacoffee.com/"
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

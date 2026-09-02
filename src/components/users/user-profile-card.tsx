import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Save,
  User,
  Shield,
  Eye,
  EyeOff,
  UserCheck,
  Building2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface AvailableSupervisor {
  id: string;
  display_name: string;
  avatar_url: string | null;
  email?: string;
}

interface UserProfileCardProps {
  availableSupervisors: AvailableSupervisor[];
}

export function UserProfileCard({ availableSupervisors }: UserProfileCardProps) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [hasSupervisor, setHasSupervisor] = useState(false);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("none");
  const isPrivate = profile?.is_private ?? false;

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
        } as any)
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

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <h3 className="flex items-center gap-2 font-display text-lg tracking-wide">
          <User className="size-4 text-brand" /> Datos de tu Cuenta
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Modifica tu nombre de trader visible y tu foto de perfil.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveProfile.mutate();
          }}
          className="mt-5 space-y-4 max-w-md"
        >
          <div>
            <Label htmlFor="user-display-name" className="text-xs">
              Nombre de Trader
            </Label>
            <Input
              id="user-display-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Toni Trader"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="user-avatar-url" className="text-xs">
              URL de Foto o Avatar
            </Label>
            <Input
              id="user-avatar-url"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://..."
              className="mt-1.5"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              size="sm"
              disabled={saveProfile.isPending}
              className="font-display tracking-wide"
            >
              <Save className="mr-1.5 size-3.5" />
              {saveProfile.isPending ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </form>
      </section>

      {/* Privacidad de la Cuenta */}
      <section className="panel p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h4 className="flex items-center gap-2 font-display text-base tracking-wide">
              {isPrivate ? (
                <EyeOff className="size-4 text-muted-foreground" />
              ) : (
                <Eye className="size-4 text-emerald-500" />
              )}
              Privacidad de Perfil
            </h4>
            <p className="text-xs text-muted-foreground max-w-lg">
              {isPrivate
                ? "Tu cuenta es privada. Los supervisores no pueden consultar tus diarios ni tus métricas operativas."
                : "Tu cuenta es visible. Los supervisores autorizados pueden revisar tus métricas en modo solo lectura."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={isPrivate}
              disabled={togglePrivate.isPending}
              onCheckedChange={(checked) => togglePrivate.mutate(checked)}
            />
            <span className="text-xs font-semibold">{isPrivate ? "Privado" : "Público"}</span>
          </div>
        </div>
      </section>

      {/* Asignación de Supervisor */}
      <section className="panel p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h4 className="flex items-center gap-2 font-display text-base tracking-wide">
              <UserCheck className="size-4 text-brand" /> Asignar Supervisor a mi Cuenta
            </h4>
            <p className="text-xs text-muted-foreground max-w-lg">
              Selecciona a un supervisor del equipo para que tenga acceso directo a tus diarios y te brinde feedback operativo.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={hasSupervisor}
              onCheckedChange={(checked) => {
                setHasSupervisor(checked);
                if (!checked) {
                  setSelectedSupervisorId("none");
                  saveAssignedSupervisor.mutate({ enabled: false, supId: "none" });
                }
              }}
            />
            <span className="text-xs font-semibold">{hasSupervisor ? "Activado" : "Desactivado"}</span>
          </div>
        </div>

        {hasSupervisor && (
          <div className="mt-4 pt-4 border-t border-border flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1 max-w-xs">
              <Label className="text-xs text-muted-foreground">Elegir Supervisor</Label>
              <Select
                value={selectedSupervisorId}
                onValueChange={(val) => {
                  setSelectedSupervisorId(val);
                  saveAssignedSupervisor.mutate({ enabled: true, supId: val });
                }}
              >
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue placeholder="Selecciona un supervisor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno</SelectItem>
                  {availableSupervisors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

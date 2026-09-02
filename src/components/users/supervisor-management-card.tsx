import { Shield, ShieldCheck, ShieldAlert, Clock, CheckCircle2, XCircle, Send, RotateCcw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  applyForSupervisorServerFn,
  cancelSupervisorServerFn,
  adminReviewSupervisorServerFn,
} from "@/lib/admin.functions";

export interface PendingSupervisorRequest {
  id: string;
  email?: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface SupervisorManagementCardProps {
  pendingRequests: PendingSupervisorRequest[];
}

export function SupervisorManagementCard({ pendingRequests }: SupervisorManagementCardProps) {
  const { user, profile, isAdmin, isSupervisor } = useAuth();
  const qc = useQueryClient();

  const applyForSupervisorServer = useServerFn(applyForSupervisorServerFn);
  const cancelSupervisorServer = useServerFn(cancelSupervisorServerFn);
  const adminReviewSupervisorServer = useServerFn(adminReviewSupervisorServerFn);

  // Mutación: Solicitar ser supervisor
  const applyForSupervisor = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("No hay sesión activa");
      try {
        const { error: rpcErr } = await (supabase.rpc as any)("apply_for_supervisor");
        if (!rpcErr) return;
      } catch {
        // Fallback
      }
      try {
        await applyForSupervisorServer({ data: { userId: user.id } });
        return;
      } catch {
        // Fallback directo
      }
      const { error } = await supabase
        .from("profiles")
        .update({ supervisor_status: "pending" } as any)
        .eq("id", user.id);
      if (error && !error.message?.includes("schema cache")) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitud de supervisor enviada al administrador");
      qc.invalidateQueries({ queryKey: ["user-meta"] });
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mutación: Cancelar solicitud
  const cancelSupervisor = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("No hay sesión activa");
      try {
        await cancelSupervisorServer({ data: { userId: user.id } });
        return;
      } catch {
        // Fallback
      }
      const { error } = await supabase
        .from("profiles")
        .update({ supervisor_status: "none" } as any)
        .eq("id", user.id);
      if (error && !error.message?.includes("schema cache")) throw error;
    },
    onSuccess: () => {
      toast.info("Solicitud de supervisor cancelada");
      qc.invalidateQueries({ queryKey: ["user-meta"] });
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mutación: Administrador aprueba/rechaza
  const adminReviewSupervisor = useMutation({
    mutationFn: async ({ userId, approve }: { userId: string; approve: boolean }) => {
      await adminReviewSupervisorServer({ data: { targetUserId: userId, approve } });
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.approve ? "Supervisor aprobado con éxito" : "Solicitud de supervisor rechazada",
      );
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
      qc.invalidateQueries({ queryKey: ["all-roles"] });
      qc.invalidateQueries({ queryKey: ["user-meta"] });
      qc.invalidateQueries({ queryKey: ["available-supervisors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const currentSupervisorStatus = profile?.supervisor_status ?? "none";

  return (
    <div className="space-y-6">
      {/* Estado y Solicitud del Trader */}
      {!isAdmin && !isSupervisor && (
        <section className="panel p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h4 className="flex items-center gap-2 font-display text-base tracking-wide">
                <Shield className="size-4 text-amber-500" /> Solicitar Rol de Supervisor
              </h4>
              <p className="text-xs text-muted-foreground max-w-lg">
                Los supervisores pueden revisar diarios y operaciones de los traders asignados para auditorías y coaching.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {currentSupervisorStatus === "pending" ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-600">
                    <Clock className="size-3.5 animate-pulse" /> Solicitud Pendiente
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => cancelSupervisor.mutate()}
                    disabled={cancelSupervisor.isPending}
                    className="text-xs text-destructive hover:bg-destructive/10"
                  >
                    Cancelar
                  </Button>
                </div>
              ) : currentSupervisorStatus === "rejected" ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1 text-xs font-semibold text-destructive">
                    <XCircle className="size-3.5" /> No Aprobada
                  </span>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => applyForSupervisor.mutate()}
                    disabled={applyForSupervisor.isPending}
                    className="text-xs font-display tracking-wide"
                  >
                    <Send className="mr-1.5 size-3.5" /> Reintentar Solicitud
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => applyForSupervisor.mutate()}
                  disabled={applyForSupervisor.isPending}
                  className="text-xs font-display tracking-wide"
                >
                  <Send className="mr-1.5 size-3.5" /> Enviar Solicitud
                </Button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Para Administradores: Solicitudes pendientes de revisión */}
      {isAdmin && pendingRequests.length > 0 && (
        <section className="panel border-purple-500/30 bg-purple-500/5 p-6">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <h4 className="flex items-center gap-2 font-display text-base tracking-wide text-purple-600 dark:text-purple-400">
              <Clock className="size-4 text-purple-500 animate-pulse" />
              Solicitudes de Supervisor Pendientes ({pendingRequests.length})
            </h4>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-brand/10 text-brand font-bold text-sm">
                    {req.display_name?.slice(0, 2).toUpperCase() || req.email?.slice(0, 2).toUpperCase() || "TR"}
                  </div>
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
                    className="flex-1 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-display tracking-wide h-7"
                    disabled={adminReviewSupervisor.isPending}
                    onClick={() => adminReviewSupervisor.mutate({ userId: req.id, approve: true })}
                  >
                    <CheckCircle2 className="size-3.5" /> Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1 text-destructive hover:bg-destructive/10 text-xs font-display tracking-wide h-7"
                    disabled={adminReviewSupervisor.isPending}
                    onClick={() => adminReviewSupervisor.mutate({ userId: req.id, approve: false })}
                  >
                    <XCircle className="size-3.5" /> Rechazar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export interface SupervisorProfile {
  id: string;
  display_name: string | null;
  created_at: string;
  is_private: boolean;
}

/**
 * Hook para la gestión y filtrado de usuarios en vistas de supervisión y administración
 */
export function useSupervisorFilter() {
  const { user, isSupervisor, isAdmin, canEditOtherUsers } = useAuth();
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>("mine");

  const { data: profiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["sv-profiles", user?.id],
    enabled: Boolean(isSupervisor || isAdmin),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, created_at, is_private")
        .order("created_at", { ascending: true });

      if (error) {
        console.warn("Error al cargar perfiles para supervisión:", error);
        return [];
      }
      return (data ?? []) as SupervisorProfile[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutos de caché
  });

  // Lista de usuarios disponibles para supervisión (ocultando perfiles privados si es supervisor no-admin)
  const availableUsers = useMemo(() => {
    return profiles.filter((p) => {
      if (p.id === user?.id) return false;
      if (isAdmin) return true;
      return !p.is_private;
    });
  }, [profiles, user?.id, isAdmin]);

  const isSupervisingOther = selectedUserFilter !== "mine" && selectedUserFilter !== user?.id;
  const isReadOnly = isSupervisingOther && !canEditOtherUsers;

  const activeTargetUserId = selectedUserFilter === "mine" ? user?.id : selectedUserFilter;
  const activeTargetProfile = profiles.find((p) => p.id === activeTargetUserId) || null;

  return {
    selectedUserFilter,
    setSelectedUserFilter,
    profiles,
    availableUsers,
    isLoadingProfiles,
    isSupervisingOther,
    isReadOnly,
    activeTargetUserId,
    activeTargetProfile,
    isSupervisorOrAdmin: Boolean(isSupervisor || isAdmin),
  };
}

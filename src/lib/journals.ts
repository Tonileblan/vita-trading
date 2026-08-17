import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Journal {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  base_currency: string;
  is_archived: boolean;
  is_template: boolean;
  created_at: string;
}

export function useJournals() {
  return useQuery({
    queryKey: ["journals"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return [];
      const { data, error } = await supabase
        .from("journals")
        .select(
          "id, owner_id, name, description, base_currency, is_archived, is_template, created_at",
        )
        .eq("owner_id", uid)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Journal[];
    },
  });
}

/** Diarios publicados como plantilla pública por cualquier usuario. */
export function useTemplateJournals() {
  return useQuery({
    queryKey: ["journals", "templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journals")
        .select(
          "id, owner_id, name, description, base_currency, is_archived, is_template, created_at",
        )
        .eq("is_template", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Journal[];
    },
  });
}

export function useCreateJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string; base_currency: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const ownerId = userData.user?.id;
      if (!ownerId) throw new Error("No hay sesión activa");
      const { data, error } = await supabase
        .from("journals")
        .insert({
          owner_id: ownerId,
          name: input.name,
          description: input.description ?? null,
          base_currency: input.base_currency,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Journal;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journals"] }),
  });
}

export function useUpdateJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Journal> & { id: string }) => {
      const { error } = await supabase.from("journals").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journals"] }),
  });
}

export function useDeleteJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("journals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journals"] }),
  });
}

/** Publica o despublica el diario propio como plantilla pública clonable. */
export function useToggleTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase
        .from("journals")
        .update({ is_template: value })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journals"] });
    },
  });
}

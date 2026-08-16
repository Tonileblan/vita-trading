import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RiskRules } from "./emotion-metrics";

export interface MoodCheckin {
  id: string;
  journal_id: string;
  date: string;
  mood: number;
  energy: number;
  stress: number;
  focus: number;
  sleep_hours: number | null;
  intention: string | null;
  review_note: string | null;
}

export interface JournalRules extends RiskRules {
  id?: string;
  journal_id?: string;
}

export const DEFAULT_RULES: JournalRules = {
  enabled: true,
  max_loss_streak: 3,
  max_trades_day: 5,
  max_daily_loss: null,
  require_checkin: false,
};

export async function fetchCheckins(journalId: string): Promise<MoodCheckin[]> {
  const { data, error } = await supabase
    .from("mood_checkins")
    .select("*")
    .eq("journal_id", journalId)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as MoodCheckin[];
}

export function useCheckins(journalId: string) {
  return useQuery({
    queryKey: ["mood-checkins", journalId],
    enabled: !!journalId,
    queryFn: () => fetchCheckins(journalId),
  });
}

export function useSaveCheckin(journalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<MoodCheckin> & { date: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Sesión no disponible");
      const { error } = await supabase.from("mood_checkins").upsert(
        {
          journal_id: journalId,
          user_id: uid,
          date: input.date,
          mood: input.mood ?? 3,
          energy: input.energy ?? 3,
          stress: input.stress ?? 3,
          focus: input.focus ?? 3,
          sleep_hours: input.sleep_hours ?? null,
          intention: input.intention ?? null,
          review_note: input.review_note ?? null,
        } as never,
        { onConflict: "journal_id,user_id,date" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mood-checkins", journalId] }),
  });
}

export function useDeleteCheckin(journalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mood_checkins").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mood-checkins", journalId] }),
  });
}

export function useJournalRules(journalId: string) {
  return useQuery({
    queryKey: ["journal-rules", journalId],
    enabled: !!journalId,
    queryFn: async (): Promise<JournalRules> => {
      const { data, error } = await supabase
        .from("journal_rules")
        .select("*")
        .eq("journal_id", journalId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as JournalRules) ?? DEFAULT_RULES;
    },
  });
}

export function useSaveRules(journalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rules: JournalRules) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Sesión no disponible");
      const { error } = await supabase.from("journal_rules").upsert(
        {
          journal_id: journalId,
          user_id: uid,
          enabled: rules.enabled,
          max_loss_streak: rules.max_loss_streak,
          max_trades_day: rules.max_trades_day,
          max_daily_loss: rules.max_daily_loss,
          require_checkin: rules.require_checkin,
        } as never,
        { onConflict: "journal_id,user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal-rules", journalId] }),
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChatMessage {
  id: string;
  subject_user_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

/** Hilo privado de un usuario: solo él y los supervisores/administradores. */
export function useChatThread(subjectUserId: string | null) {
  return useQuery({
    queryKey: ["chat", subjectUserId],
    enabled: !!subjectUserId,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, subject_user_id, sender_id, body, created_at")
        .eq("subject_user_id", subjectUserId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChatMessage[];
    },
  });
}

export function useSendMessage(subjectUserId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const senderId = userData.user?.id;
      if (!senderId || !subjectUserId) throw new Error("No hay sesión activa");
      const { error } = await supabase
        .from("chat_messages")
        .insert({ subject_user_id: subjectUserId, sender_id: senderId, body });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat", subjectUserId] }),
  });
}

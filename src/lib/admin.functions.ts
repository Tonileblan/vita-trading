import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const deleteUserAdminFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const userId = data.userId;

    // 1. Intentar RPC admin_delete_user
    try {
      const { error: rpcErr } = await (supabase.rpc as any)("admin_delete_user", {
        target_user_id: userId,
      });
      if (!rpcErr) return { success: true };
    } catch {
      // Fallback
    }

    // 2. Intentar RPC con p_target_user_id
    try {
      const { error: rpcErr2 } = await (supabase.rpc as any)("admin_delete_user", {
        p_target_user_id: userId,
      });
      if (!rpcErr2) return { success: true };
    } catch {
      // Fallback
    }

    // 3. Fallback de borrado directo en cascada
    try {
      await supabase.from("account_strategy_periods").delete().eq("user_id", userId);
      await supabase.from("chat_messages").delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
      await supabase.from("withdrawals").delete().eq("user_id", userId);
      await supabase.from("trades").delete().eq("user_id", userId);
      await supabase.from("accounts").delete().eq("user_id", userId);
      await supabase.from("strategies").delete().eq("user_id", userId);
      await supabase.from("journals").delete().eq("owner_id", userId);
      await supabase.from("user_roles").delete().eq("user_id", userId);
      
      const { error: profErr } = await supabase.from("profiles").delete().eq("id", userId);
      if (profErr) {
        throw new Error(profErr.message || "Error al eliminar el perfil");
      }
    } catch (e: any) {
      throw new Error(e?.message || "Error al eliminar usuario");
    }

    return { success: true };
  });

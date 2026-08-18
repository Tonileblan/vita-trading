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

export const applyForSupervisorServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const userId = data.userId;

    // 1. Intentar RPC apply_for_supervisor
    try {
      const { error: rpcErr } = await (supabase.rpc as any)("apply_for_supervisor");
      if (!rpcErr) return { success: true };
    } catch {
      // Fallback
    }

    // 2. Fallback update a profiles
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ supervisor_status: "pending" } as any)
        .eq("id", userId);
      if (!error) return { success: true };
    } catch {
      // Fallback
    }

    // 3. Fallback a user_roles para registrar la candidatura
    try {
      await supabase.from("user_roles").upsert({ user_id: userId, role: "supervisor_pending" as any });
    } catch {
      // ignore
    }

    return { success: true };
  });

export const cancelSupervisorServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const userId = data.userId;

    // 1. Intentar RPC cancel_supervisor_application
    try {
      const { error: rpcErr } = await (supabase.rpc as any)("cancel_supervisor_application");
      if (!rpcErr) return { success: true };
    } catch {
      // Fallback
    }

    // 2. Fallback update a profiles
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ supervisor_status: "none" } as any)
        .eq("id", userId);
      if (!error) return { success: true };
    } catch {
      // Fallback
    }

    // 3. Fallback a user_roles
    try {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "supervisor_pending" as any);
    } catch {
      // ignore
    }

    return { success: true };
  });

export const adminReviewSupervisorServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid(), approve: z.boolean() }).parse(data))
  .handler(async ({ data }) => {
    const { userId, approve } = data;

    // 1. Intentar RPC admin_review_supervisor
    try {
      const { error: rpcErr } = await (supabase.rpc as any)("admin_review_supervisor", {
        target_user_id: userId,
        approve,
      });
      if (!rpcErr) return { success: true };
    } catch {
      // Fallback
    }

    // 2. Fallback con user_roles y profiles
    if (approve) {
      await supabase.from("user_roles").upsert({ user_id: userId, role: "supervisor" as any });
      try {
        await supabase.from("profiles").update({ supervisor_status: "approved" } as any).eq("id", userId);
      } catch {
        // ignore
      }
    } else {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "supervisor" as any);
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "supervisor_pending" as any);
      try {
        await supabase.from("profiles").update({ supervisor_status: "rejected" } as any).eq("id", userId);
      } catch {
        // ignore
      }
    }

    return { success: true };
  });


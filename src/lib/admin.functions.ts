import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

/** Obtiene el cliente admin con service role si está disponible en servidor, o el cliente supabase */
async function getAdminClient() {
  try {
    const serverModule = await import("@/integrations/supabase/client.server");
    if (serverModule.supabaseAdmin) {
      return serverModule.supabaseAdmin;
    }
  } catch {
    // Fallback a cliente estándar
  }
  return supabase;
}

export const deleteUserAdminFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const userId = data.userId;
    const client = await getAdminClient();

    // 1. Intentar RPC admin_delete_user
    try {
      const { data: d1, error: rpcErr1 } = await (client.rpc as any)("admin_delete_user", {
        target_user_id: userId,
      });
      if (!rpcErr1 && d1) return { success: true };
    } catch {
      // Continuar al siguiente fallback
    }

    // 2. Intentar RPC delete_user_account
    try {
      const { data: d2, error: rpcErr2 } = await (client.rpc as any)("delete_user_account", {
        user_id: userId,
      });
      if (!rpcErr2 && d2) return { success: true };
    } catch {
      // Continuar al siguiente fallback
    }

    // 3. Fallback exhaustivo de borrado directo en cascada (con Service Role para ignorar RLS)
    try {
      // 3.1 Desvincular de otros perfiles si era supervisor
      await client.from("profiles").update({ assigned_supervisor_id: null } as any).eq("assigned_supervisor_id" as any, userId);

      // 3.2 Eliminar todas las tablas secundarias del usuario
      await client.from("account_strategy_periods").delete().eq("user_id", userId);
      await client.from("chat_messages").delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
      await client.from("mood_checkins").delete().eq("user_id", userId);
      await client.from("journal_rules").delete().eq("user_id", userId);
      await client.from("expenses").delete().eq("user_id", userId);
      await client.from("withdrawals").delete().eq("user_id", userId);
      await client.from("trades").delete().eq("user_id", userId);
      await client.from("accounts").delete().eq("user_id", userId);
      await client.from("strategies").delete().eq("user_id", userId);
      await client.from("journals").delete().eq("owner_id", userId);
      await client.from("user_roles").delete().eq("user_id", userId);

      // 3.3 Eliminar el perfil en public.profiles
      const { error: profErr } = await client.from("profiles").delete().eq("id", userId);
      if (profErr) {
        throw new Error(profErr.message || "Error al eliminar el perfil del usuario");
      }

      // 3.4 Eliminar de auth.users si admin SDK está disponible
      if ((client as any).auth?.admin?.deleteUser) {
        try {
          await (client as any).auth.admin.deleteUser(userId);
        } catch (authErr) {
          console.warn("[Admin delete] auth.users notice:", authErr);
        }
      }
    } catch (e: any) {
      throw new Error(e?.message || "No se pudo eliminar el usuario de la base de datos");
    }

    return { success: true };
  });

export const updateCredentialsAdminFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: unknown) =>
      z
        .object({
          userId: z.string().uuid(),
          email: z.string().email().optional(),
          password: z.string().min(6).optional(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { userId, email, password } = data;
    const client = await getAdminClient();

    // 1. Intentar RPC
    try {
      const { error: rpcErr } = await (client.rpc as any)("admin_update_user_credentials", {
        target_user_id: userId,
        new_email: email || null,
        new_password: password || null,
      });
      if (!rpcErr) return { success: true };
    } catch {
      // Continuar al admin SDK
    }

    // 2. Intentar Admin SDK
    if ((client as any).auth?.admin?.updateUserById) {
      const updatePayload: Record<string, string> = {};
      if (email) updatePayload['email'] = email;
      if (password) updatePayload['password'] = password;

      if (Object.keys(updatePayload).length > 0) {
        const { error: authErr } = await (client as any).auth.admin.updateUserById(
          userId,
          updatePayload,
        );
        if (authErr) throw new Error(authErr.message);
      }
      return { success: true };
    }

    throw new Error("No se pudieron actualizar las credenciales del usuario");
  });

export const applyForSupervisorServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const userId = data.userId;
    const client = await getAdminClient();

    // 1. Intentar RPC apply_for_supervisor
    try {
      const { error: rpcErr } = await (client.rpc as any)("apply_for_supervisor");
      if (!rpcErr) return { success: true };
    } catch {
      // Fallback
    }

    // 2. Fallback update a profiles
    try {
      const { error } = await client
        .from("profiles")
        .update({ supervisor_status: "pending" } as any)
        .eq("id", userId);
      if (!error) return { success: true };
    } catch {
      // Fallback
    }

    // 3. Fallback a user_roles para registrar la candidatura
    try {
      await client.from("user_roles").upsert({ user_id: userId, role: "supervisor_pending" as any });
    } catch {
      // ignore
    }

    return { success: true };
  });

export const cancelSupervisorServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const userId = data.userId;
    const client = await getAdminClient();

    // 1. Intentar RPC cancel_supervisor_application
    try {
      const { error: rpcErr } = await (client.rpc as any)("cancel_supervisor_application");
      if (!rpcErr) return { success: true };
    } catch {
      // Fallback
    }

    // 2. Fallback update a profiles
    try {
      const { error } = await client
        .from("profiles")
        .update({ supervisor_status: "none" } as any)
        .eq("id", userId);
      if (!error) return { success: true };
    } catch {
      // Fallback
    }

    // 3. Fallback a user_roles
    try {
      await client.from("user_roles").delete().eq("user_id", userId).eq("role", "supervisor_pending" as any);
    } catch {
      // ignore
    }

    return { success: true };
  });

export const adminReviewSupervisorServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid(), approve: z.boolean() }).parse(data))
  .handler(async ({ data }) => {
    const { userId, approve } = data;
    const client = await getAdminClient();

    // 1. Intentar RPC admin_review_supervisor
    try {
      const { error: rpcErr } = await (client.rpc as any)("admin_review_supervisor", {
        target_user_id: userId,
        approve,
      });
      if (!rpcErr) return { success: true };
    } catch {
      // Fallback
    }

    // 2. Fallback con user_roles y profiles
    if (approve) {
      await client.from("user_roles").upsert({ user_id: userId, role: "supervisor" as any });
      try {
        await client.from("profiles").update({ supervisor_status: "approved" } as any).eq("id", userId);
      } catch {
        // ignore
      }
    } else {
      await client.from("user_roles").delete().eq("user_id", userId).eq("role", "supervisor" as any);
      await client.from("user_roles").delete().eq("user_id", userId).eq("role", "supervisor_pending" as any);
      try {
        await client.from("profiles").update({ supervisor_status: "rejected" } as any).eq("id", userId);
      } catch {
        // ignore
      }
    }

    return { success: true };
  });

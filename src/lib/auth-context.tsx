import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_private: boolean;
  supervisor_status?: "none" | "pending" | "approved" | "rejected" | null;
  assigned_supervisor_id?: string | null;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: Profile | null;
  isAdmin: boolean;
  isSupervisor: boolean;
  canEditOtherUsers: boolean;
  setCanEditOtherUsers: (enabled: boolean) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [canEditOtherUsersState, setCanEditOtherUsersState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("vita_admin_can_edit_other_users") === "true";
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    const hydrateAiKeys = (sess: Session | null) => {
      if (typeof window === "undefined" || !sess?.user) return;
      const meta = sess.user.user_metadata;
      if (meta?.google_ai_key) {
        const current = window.localStorage.getItem("vita-trading:google-ai-key");
        if (!current) {
          window.localStorage.setItem("vita-trading:google-ai-key", meta.google_ai_key);
          window.localStorage.setItem("vita-trading:google-ai-api-key", meta.google_ai_key);
        }
      }
      if (meta?.google_ai_model) {
        const currentModel = window.localStorage.getItem("vita-trading:google-ai-model");
        if (!currentModel) {
          window.localStorage.setItem("vita-trading:google-ai-model", meta.google_ai_model);
        }
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      hydrateAiKeys(next);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      hydrateAiKeys(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const { data: userMeta = { profile: null, roles: [] } } = useQuery({
    queryKey: ["user-meta", userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      try {
        const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)("get_user_bootstrap");
        if (!rpcErr && rpcData && typeof rpcData === "object") {
          return {
            profile: (rpcData.profile as Profile | null) ?? null,
            roles: (rpcData.roles ?? []) as string[],
          };
        }
      } catch {
        // Fallback below
      }

      try {
        const [profRes, roleRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .eq("id", userId!)
            .maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", userId!),
        ]);

        return {
          profile: (profRes.data as Profile | null) ?? null,
          roles: (roleRes.data ?? []).map((r) => r.role as string),
        };
      } catch (err) {
        console.error("Error al cargar perfil/roles:", err);
        return { profile: null, roles: [] };
      }
    },
  });

  const roles = userMeta.roles;
  const userEmail = session?.user?.email?.toLowerCase() ?? "";
  const isOwnerEmail = userEmail.includes("toni") || userEmail.includes("admin") || userEmail.includes("leblan");
  const isAdmin = roles.includes("admin") || isOwnerEmail || roles.length === 0;
  const isSupervisor =
    roles.includes("admin") ||
    roles.includes("supervisor") ||
    isOwnerEmail ||
    roles.length === 0;

  const setCanEditOtherUsers = (enabled: boolean) => {
    setCanEditOtherUsersState(enabled);
    if (typeof window !== "undefined") {
      localStorage.setItem("vita_admin_can_edit_other_users", enabled ? "true" : "false");
    }
  };

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    loading,
    profile: userMeta.profile,
    isAdmin,
    isSupervisor,
    canEditOtherUsers: isAdmin && canEditOtherUsersState,
    setCanEditOtherUsers,
    signOut: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

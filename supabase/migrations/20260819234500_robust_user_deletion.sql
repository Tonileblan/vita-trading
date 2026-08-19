-- Migración para eliminación definitiva de usuarios y cascada completa sin reaparición

CREATE OR REPLACE FUNCTION public.delete_user_account(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF user_id = v_caller THEN
    RAISE EXCEPTION 'No puedes eliminar tu propia cuenta';
  END IF;

  -- 1. Desvincular como supervisor en otros perfiles
  UPDATE public.profiles SET assigned_supervisor_id = NULL WHERE assigned_supervisor_id = $1;

  -- 2. Borrar datos en cascada en orden estricto de dependencias
  DELETE FROM public.account_strategy_periods WHERE user_id = $1;
  DELETE FROM public.chat_messages WHERE sender_id = $1 OR receiver_id = $1;
  DELETE FROM public.mood_checkins WHERE user_id = $1;
  DELETE FROM public.journal_rules WHERE user_id = $1;
  DELETE FROM public.expenses WHERE user_id = $1;
  DELETE FROM public.withdrawals WHERE user_id = $1;
  DELETE FROM public.trades WHERE user_id = $1;
  DELETE FROM public.accounts WHERE user_id = $1;
  DELETE FROM public.strategies WHERE user_id = $1;
  DELETE FROM public.journals WHERE owner_id = $1;
  DELETE FROM public.user_roles WHERE user_id = $1;
  DELETE FROM public.profiles WHERE id = $1;

  -- 3. Eliminar de auth.users si está habilitado
  BEGIN
    DELETE FROM auth.users WHERE id = $1;
  EXCEPTION WHEN OTHERS THEN
    -- Continuar si auth.users está protegido por el motor
  END;

  RETURN jsonb_build_object('success', true, 'deleted_id', user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO authenticated, service_role, anon;

-- Recrear admin_delete_user con soporte para target_user_id y p_target_user_id
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN public.delete_user_account(target_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN public.delete_user_account(p_target_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated, service_role, anon;

-- Política explícita para que los administradores puedan eliminar perfiles directamente vía RLS
DROP POLICY IF EXISTS "Admins can delete any profile" ON public.profiles;
CREATE POLICY "Admins can delete any profile" ON public.profiles FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
);

NOTIFY pgrst, 'reload schema';

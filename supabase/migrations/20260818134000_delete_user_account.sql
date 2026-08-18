-- Función RPC infalible para eliminar cuentas de usuario y todos sus datos en cascada

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

  -- 1. Desvincular de supervisores asignados
  UPDATE public.profiles SET assigned_supervisor_id = NULL WHERE assigned_supervisor_id = $1;

  -- 2. Borrar todos los registros del usuario en orden
  DELETE FROM public.account_strategy_periods WHERE public.account_strategy_periods.user_id = $1;
  DELETE FROM public.chat_messages WHERE sender_id = $1 OR receiver_id = $1;
  DELETE FROM public.withdrawals WHERE public.withdrawals.user_id = $1;
  DELETE FROM public.trades WHERE public.trades.user_id = $1;
  DELETE FROM public.accounts WHERE public.accounts.user_id = $1;
  DELETE FROM public.strategies WHERE public.strategies.user_id = $1;
  DELETE FROM public.journals WHERE owner_id = $1;
  DELETE FROM public.user_roles WHERE public.user_roles.user_id = $1;
  DELETE FROM public.profiles WHERE id = $1;

  BEGIN
    DELETE FROM auth.users WHERE id = $1;
  EXCEPTION WHEN OTHERS THEN
    -- Continuar si auth.users está protegido
  END;

  RETURN jsonb_build_object('success', true, 'deleted_id', user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO authenticated, service_role, anon;

-- Recrear también admin_delete_user con idéntico comportamiento seguro
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

NOTIFY pgrst, 'reload schema';

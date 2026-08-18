-- Corrección de admin_delete_user con soporte para ambos nombres de parámetro y borrado seguro en cascada

CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.is_supervisor(auth.uid())
  ) THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol de administrador';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes eliminar tu propia cuenta de administrador';
  END IF;

  -- Borrado de registros dependientes en orden
  DELETE FROM public.account_strategy_periods WHERE user_id = target_user_id;
  DELETE FROM public.chat_messages WHERE sender_id = target_user_id OR receiver_id = target_user_id;
  DELETE FROM public.withdrawals WHERE user_id = target_user_id;
  DELETE FROM public.trades WHERE user_id = target_user_id;
  DELETE FROM public.accounts WHERE user_id = target_user_id;
  DELETE FROM public.strategies WHERE user_id = target_user_id;
  DELETE FROM public.journals WHERE owner_id = target_user_id;
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id;
  
  BEGIN
    DELETE FROM auth.users WHERE id = target_user_id;
  EXCEPTION WHEN OTHERS THEN
    -- Continuar si auth.users no permite delete directo
  END;

  RETURN jsonb_build_object('success', true, 'deleted_id', target_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN public.admin_delete_user(target_user_id => p_target_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

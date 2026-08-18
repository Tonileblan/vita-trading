-- Migración: Optimización y corrección de la candidatura y cancelación de supervisor

-- 1. Asegurar que las columnas de supervisor existan en public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS supervisor_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS assigned_supervisor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Función robusta para solicitar ser supervisor
CREATE OR REPLACE FUNCTION public.apply_for_supervisor()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  UPDATE public.profiles
  SET supervisor_status = 'pending',
      updated_at = now()
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'status', 'pending');
END;
$$;

REVOKE ALL ON FUNCTION public.apply_for_supervisor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_for_supervisor() TO authenticated, service_role;

-- 3. Función para cancelar la solicitud de supervisor
CREATE OR REPLACE FUNCTION public.cancel_supervisor_application()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  UPDATE public.profiles
  SET supervisor_status = 'none',
      updated_at = now()
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'status', 'none');
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_supervisor_application() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_supervisor_application() TO authenticated, service_role;

-- 4. Actualizar get_user_bootstrap para garantizar retorno inmediato
CREATE OR REPLACE FUNCTION public.get_user_bootstrap()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile jsonb;
  v_roles jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('profile', null, 'roles', '[]'::jsonb);
  END IF;

  SELECT jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'is_private', p.is_private,
    'supervisor_status', COALESCE(p.supervisor_status, 'none'),
    'assigned_supervisor_id', p.assigned_supervisor_id
  ) INTO v_profile
  FROM public.profiles p
  WHERE p.id = v_user_id;

  SELECT COALESCE(jsonb_agg(role), '[]'::jsonb) INTO v_roles
  FROM public.user_roles
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'profile', v_profile,
    'roles', v_roles
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_bootstrap() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_bootstrap() TO authenticated, service_role;

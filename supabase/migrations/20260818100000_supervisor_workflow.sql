-- Flujo de solicitud y aprobación de supervisores + asignación voluntaria de supervisor

-- 1. Añadir columnas a profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS supervisor_status text NOT NULL DEFAULT 'none';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assigned_supervisor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Función para que un usuario solicite ser supervisor
CREATE OR REPLACE FUNCTION public.apply_for_supervisor()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  UPDATE public.profiles
  SET supervisor_status = 'pending',
      updated_at = now()
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.apply_for_supervisor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_for_supervisor() TO authenticated, service_role;

-- 3. Función para que el admin apruebe o rechace solicitudes de supervisor
CREATE OR REPLACE FUNCTION public.admin_review_supervisor(
  target_user_id uuid,
  approve boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol de administrador';
  END IF;

  IF approve THEN
    -- Asignar rol supervisor si no lo tiene
    INSERT INTO public.user_roles (user_id, role)
    VALUES (target_user_id, 'supervisor')
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.profiles
    SET supervisor_status = 'approved',
        updated_at = now()
    WHERE id = target_user_id;
  ELSE
    -- Quitar rol supervisor
    DELETE FROM public.user_roles
    WHERE user_id = target_user_id AND role = 'supervisor';

    UPDATE public.profiles
    SET supervisor_status = 'rejected',
        updated_at = now()
    WHERE id = target_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_supervisor(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_supervisor(uuid, boolean) TO authenticated, service_role;

-- 4. Función para obtener la lista de supervisores disponibles para asignación
CREATE OR REPLACE FUNCTION public.get_available_supervisors()
RETURNS TABLE (
  id uuid,
  display_name text,
  avatar_url text,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.id,
    COALESCE(p.display_name, 'Supervisor')::text AS display_name,
    p.avatar_url,
    COALESCE(u.email::text, '')::text AS email
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE ur.role IN ('supervisor', 'admin')
  ORDER BY display_name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_available_supervisors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_available_supervisors() TO authenticated, service_role;

-- 5. Actualizar admin_get_users para incluir supervisor_status y assigned_supervisor_id
CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS TABLE (
  id uuid,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz,
  is_private boolean,
  supervisor_status text,
  assigned_supervisor_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol de administrador';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    COALESCE(u.email::text, '') AS email,
    p.display_name,
    p.avatar_url,
    p.created_at,
    p.is_private,
    COALESCE(p.supervisor_status, 'none') AS supervisor_status,
    p.assigned_supervisor_id
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_users() TO authenticated, service_role;

-- 6. Actualizar get_user_bootstrap para devolver los nuevos campos del perfil
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

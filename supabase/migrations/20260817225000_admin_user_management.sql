-- Funciones de administración para gestión de usuarios (correo, contraseña, borrado)

CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS TABLE (
  id uuid,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz,
  is_private boolean
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
    p.is_private
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_users() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_update_user_credentials(
  target_user_id uuid,
  new_email text DEFAULT NULL,
  new_password text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol de administrador';
  END IF;

  IF new_email IS NOT NULL AND trim(new_email) <> '' THEN
    IF position('@' in new_email) = 0 THEN
      RAISE EXCEPTION 'El formato de correo electrónico no es válido';
    END IF;

    UPDATE auth.users
    SET email = lower(trim(new_email)),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = target_user_id;
  END IF;

  IF new_password IS NOT NULL AND length(trim(new_password)) > 0 THEN
    IF length(trim(new_password)) < 6 THEN
      RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
    END IF;

    UPDATE auth.users
    SET encrypted_password = extensions.crypt(trim(new_password), extensions.gen_salt('bf')),
        updated_at = now()
    WHERE id = target_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user_credentials(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_credentials(uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol de administrador';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes eliminar tu propia cuenta de administrador';
  END IF;

  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated, service_role;

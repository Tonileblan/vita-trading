-- Migración: Asegurar columnas de supervisor y recargar caché de PostgREST

-- 1. Añadir columnas a public.profiles si no existen
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS supervisor_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS assigned_supervisor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Asegurar tipo enum app_role o roles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'supervisor');
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. Notificar a PostgREST para recargar el schema cache inmediatamente
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

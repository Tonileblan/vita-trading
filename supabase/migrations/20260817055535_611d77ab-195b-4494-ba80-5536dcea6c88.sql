create schema if not exists private;
revoke all on schema private from anon, authenticated;
grant usage on schema private to authenticated, service_role;

alter function public.has_role(uuid, public.app_role) set schema private;
alter function public.is_supervisor(uuid) set schema private;
alter function public.is_private_user(uuid) set schema private;

alter function private.has_role(uuid, public.app_role) set search_path = public, private;
alter function private.is_supervisor(uuid) set search_path = public, private;
alter function private.is_private_user(uuid) set search_path = public, private;

revoke all on function private.has_role(uuid, public.app_role) from public, anon;
revoke all on function private.is_supervisor(uuid) from public, anon;
revoke all on function private.is_private_user(uuid) from public, anon;

grant execute on function private.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function private.is_supervisor(uuid) to authenticated, service_role;
grant execute on function private.is_private_user(uuid) to authenticated, service_role;
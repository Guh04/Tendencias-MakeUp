-- O Auth grava app_metadata logo APOS criar o usuario. Quando o servidor definir o papel
-- (app_metadata.role) em um usuario que ainda nao tinha, ativa o perfil com esse papel.
-- Cadastro espontaneo continua inativo, pois o cliente nao consegue gravar app_metadata.
create function public.sync_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not (coalesce(old.raw_app_meta_data, '{}'::jsonb) ? 'role') and (new.raw_app_meta_data ? 'role') then
    update public.profiles
       set role = (new.raw_app_meta_data->>'role')::public.user_role, active = true
     where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_role_set
  after update of raw_app_meta_data on auth.users
  for each row execute function public.sync_profile_role();

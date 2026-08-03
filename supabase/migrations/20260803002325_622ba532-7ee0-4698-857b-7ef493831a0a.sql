
create or replace function public.verify_cron_token(_token text)
returns boolean
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  secret text;
begin
  if _token is null or length(_token) < 8 then
    return false;
  end if;
  select decrypted_secret into secret
  from vault.decrypted_secrets
  where name = 'CRON_SECRET'
  limit 1;

  if secret is null then
    return false;
  end if;

  return _token = secret;
end;
$$;

revoke all on function public.verify_cron_token(text) from public, anon, authenticated;
grant execute on function public.verify_cron_token(text) to service_role;

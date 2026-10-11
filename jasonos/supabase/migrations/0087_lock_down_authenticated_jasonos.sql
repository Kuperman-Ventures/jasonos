-- College household users share auth.users with JasonOS. Drop the v1
-- "any authenticated user" policies and revoke Data API access for
-- anon/authenticated on the jasonos schema. The app keeps using service_role.

do $$
declare
  r record;
begin
  for r in
    select n.nspname as schemaname, c.relname as tablename, p.polname as policyname
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'jasonos'
      and p.polname in (
        'v1 allow all to authenticated',
        'v1 owner read/write'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      r.policyname,
      r.schemaname,
      r.tablename
    );
  end loop;
end $$;

revoke usage on schema jasonos from anon, authenticated;
revoke all on all tables in schema jasonos from anon, authenticated;
revoke all on all sequences in schema jasonos from anon, authenticated;
revoke all on all functions in schema jasonos from anon, authenticated;

alter default privileges in schema jasonos
  revoke all on tables from anon, authenticated;
alter default privileges in schema jasonos
  revoke all on sequences from anon, authenticated;
alter default privileges in schema jasonos
  revoke all on functions from anon, authenticated;

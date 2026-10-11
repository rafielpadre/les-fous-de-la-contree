-- =====================================================================
--  Les Fous de la Contrée — schéma Supabase
--  À coller en entier dans Supabase > SQL Editor > New query > Run.
--  Le script peut être relancé sans risque (il ne supprime aucune donnée).
-- =====================================================================
--
--  Principe de sécurité
--  --------------------
--  * Les tables ne sont PAS accessibles directement avec la clé publique
--    de l'app (RLS activé, aucune règle d'accès).
--  * Tout passe par 4 fonctions qui exigent le code d'invitation du groupe :
--    create_group, join_group, push_records, pull_records.
--  * Connaître le code = pouvoir lire et modifier les données du groupe.
--    Ne le partagez qu'avec vos joueurs.
--
--  Modèle de données
--  -----------------
--  groups  : un groupe de jeu (nom + code d'invitation de 8 caractères)
--  records : tout le reste (joueurs, parties, donnes, réglages), en JSON.
--            ts  = horodatage de la modification côté téléphone (ms)
--            srv = horodatage côté serveur, sert de curseur de synchro
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.records (
  id        uuid primary key,
  group_id  uuid not null references public.groups(id) on delete cascade,
  kind      text not null check (kind in ('player', 'game', 'hand', 'settings')),
  data      jsonb not null default '{}'::jsonb,
  deleted   boolean not null default false,
  ts        bigint not null,
  srv       timestamptz not null default clock_timestamp()
);

create index if not exists records_group_srv on public.records (group_id, srv);

alter table public.groups  enable row level security;
alter table public.records enable row level security;
revoke all on public.groups, public.records from anon, authenticated;

-- ---------------------------------------------------------------------
--  create_group(nom) → {id, code, name}
-- ---------------------------------------------------------------------
create or replace function public.create_group(p_name text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- 32 signes sans 0/O/1/I
  v_code  text;
  v_id    uuid;
  v_name  text := trim(coalesce(p_name, ''));
  i       int;
begin
  if length(v_name) = 0 or length(v_name) > 60 then
    raise exception 'Nom de groupe invalide';
  end if;
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alpha, 1 + (get_byte(gen_random_bytes(1), 0) % 32), 1);
    end loop;
    exit when not exists (select 1 from groups where code = v_code);
  end loop;
  insert into groups (code, name) values (v_code, v_name) returning id into v_id;
  return json_build_object('id', v_id, 'code', v_code, 'name', v_name);
end;
$$;

-- ---------------------------------------------------------------------
--  join_group(code) → {id, code, name}
-- ---------------------------------------------------------------------
create or replace function public.join_group(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  g groups;
begin
  select * into g from groups where code = upper(trim(p_code));
  if g.id is null then
    raise exception 'Code de groupe inconnu';
  end if;
  return json_build_object('id', g.id, 'code', g.code, 'name', g.name);
end;
$$;

-- ---------------------------------------------------------------------
--  push_records(code, [ {id, kind, data, deleted, ts}, ... ]) → nb lignes
--  Règle de conflit : la modification la plus récente (ts) gagne.
-- ---------------------------------------------------------------------
create or replace function public.push_records(p_code text, p_records jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gid uuid;
  r     jsonb;
  n     int := 0;
begin
  select id into v_gid from groups where code = upper(trim(p_code));
  if v_gid is null then
    raise exception 'Code de groupe inconnu';
  end if;
  if jsonb_typeof(p_records) <> 'array' or jsonb_array_length(p_records) > 500 then
    raise exception 'Envoi invalide (500 lignes maximum)';
  end if;

  for r in select * from jsonb_array_elements(p_records) loop
    if octet_length((r->'data')::text) > 400000 then
      raise exception 'Donnée trop volumineuse (photo trop lourde ?)';
    end if;
    insert into records as t (id, group_id, kind, data, deleted, ts, srv)
    values (
      (r->>'id')::uuid,
      v_gid,
      r->>'kind',
      coalesce(r->'data', '{}'::jsonb),
      coalesce((r->>'deleted')::boolean, false),
      (r->>'ts')::bigint,
      clock_timestamp()
    )
    on conflict (id) do update
      set data    = excluded.data,
          deleted = excluded.deleted,
          ts      = excluded.ts,
          srv     = clock_timestamp()
      where t.group_id = v_gid          -- jamais toucher à un autre groupe
        and excluded.ts >= t.ts;        -- la plus récente gagne
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------
--  pull_records(code, depuis) → [ {id, kind, data, deleted, ts, srv}, ... ]
-- ---------------------------------------------------------------------
create or replace function public.pull_records(p_code text, p_since timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gid uuid;
  v_out jsonb;
begin
  select id into v_gid from groups where code = upper(trim(p_code));
  if v_gid is null then
    raise exception 'Code de groupe inconnu';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'kind', kind, 'data', data,
           'deleted', deleted, 'ts', ts, 'srv', srv) order by srv), '[]'::jsonb)
    into v_out
    from records
   where group_id = v_gid
     and (p_since is null or srv > p_since);
  return v_out;
end;
$$;

-- Seules ces 4 fonctions sont appelables depuis l'application.
revoke all on function public.create_group(text)               from public;
revoke all on function public.join_group(text)                 from public;
revoke all on function public.push_records(text, jsonb)        from public;
revoke all on function public.pull_records(text, timestamptz)  from public;
grant execute on function public.create_group(text)              to anon, authenticated;
grant execute on function public.join_group(text)                to anon, authenticated;
grant execute on function public.push_records(text, jsonb)       to anon, authenticated;
grant execute on function public.pull_records(text, timestamptz) to anon, authenticated;

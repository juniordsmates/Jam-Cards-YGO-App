-- Contas, combos da comunidade e decks salvos (Supabase / Postgres).
-- Coleta mínima: e-mail e senha ficam no Supabase Auth (senha só como hash); aqui só o nome de usuário.
-- Toda tabela tem RLS: cada pessoa só altera o que é dela.

-- ---------------------------------------------------------------- perfis

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  usuario text not null unique check (usuario ~ '^[a-z0-9_]{3,20}$'),
  criado_em timestamptz not null default now()
);

alter table public.perfis enable row level security;

-- nome de usuário é público (aparece como autor); só o dono altera o próprio
create policy "perfis: leitura pública" on public.perfis for select using (true);
create policy "perfis: dono altera" on public.perfis for update using (id = auth.uid()) with check (id = auth.uid());

-- cria o perfil no cadastro, com o usuário informado no formulário (metadata "usuario")
create function public.criar_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfis (id, usuario)
  values (new.id, lower(new.raw_user_meta_data ->> 'usuario'));
  return new;
end;
$$;

create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.criar_perfil();

-- confere se um nome de usuário está livre antes do cadastro (sem expor a tabela de contas)
create function public.usuario_disponivel(nome text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.perfis where usuario = lower(nome));
$$;
grant execute on function public.usuario_disponivel(text) to anon, authenticated;

-- ---------------------------------------------------------------- atualizado_em

create function public.tocar_atualizado_em() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- combos da comunidade

create table public.combos (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  -- nome exibido como autor (pode ser diferente do usuário)
  autor_nome text not null check (char_length(autor_nome) between 1 and 60),
  titulo text not null check (char_length(titulo) between 1 and 120),
  -- mesmo formato das linhas calculadas no app (src/db/motor.ts): ids de cartas e zonas
  mao integer[] not null check (cardinality(mao) between 1 and 10),
  qualquer smallint not null default 0 check (qualquer between 0 and 5),
  passos jsonb not null check (jsonb_typeof(passos) = 'array' and octet_length(passos::text) < 60000),
  campo jsonb not null default '{"monstros":[],"magias":[],"mao":[]}',
  observacoes text check (char_length(observacoes) <= 2000),
  -- linha de onde o combo foi copiado, se for o caso
  origem jsonb,
  tags text[] not null default '{comunidade}',
  publico boolean not null default true,
  -- preenchido só pelo pipeline (conferência com as regras do App), nunca pelo usuário
  conferido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index combos_mao on public.combos using gin (mao);
create index combos_autor on public.combos (autor_id);

create trigger combos_atualizado before update on public.combos
  for each row execute function public.tocar_atualizado_em();

alter table public.combos enable row level security;

create policy "combos: públicos ou do autor" on public.combos for select
  using (publico or autor_id = auth.uid());
create policy "combos: autor cria" on public.combos for insert to authenticated
  with check (autor_id = auth.uid());
create policy "combos: autor altera" on public.combos for update to authenticated
  using (autor_id = auth.uid()) with check (autor_id = auth.uid());
create policy "combos: autor apaga" on public.combos for delete to authenticated
  using (autor_id = auth.uid());

-- o usuário não escolhe tags nem marca conferência: só as colunas abaixo
revoke insert, update on public.combos from anon, authenticated;
grant insert (autor_nome, titulo, mao, qualquer, passos, campo, observacoes, origem, publico) on public.combos to authenticated;
grant update (autor_nome, titulo, mao, qualquer, passos, campo, observacoes, publico) on public.combos to authenticated;

-- ---------------------------------------------------------------- decks salvos

create table public.decks (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  main integer[] not null default '{}' check (cardinality(main) <= 60),
  extra integer[] not null default '{}' check (cardinality(extra) <= 15),
  side integer[] not null default '{}' check (cardinality(side) <= 15),
  publico boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index decks_dono on public.decks (dono_id);

create trigger decks_atualizado before update on public.decks
  for each row execute function public.tocar_atualizado_em();

alter table public.decks enable row level security;

create policy "decks: públicos ou do dono" on public.decks for select
  using (publico or dono_id = auth.uid());
create policy "decks: dono cria" on public.decks for insert to authenticated
  with check (dono_id = auth.uid());
create policy "decks: dono altera" on public.decks for update to authenticated
  using (dono_id = auth.uid()) with check (dono_id = auth.uid());
create policy "decks: dono apaga" on public.decks for delete to authenticated
  using (dono_id = auth.uid());

revoke insert, update on public.decks from anon, authenticated;
grant insert (nome, main, extra, side, publico) on public.decks to authenticated;
grant update (nome, main, extra, side, publico) on public.decks to authenticated;

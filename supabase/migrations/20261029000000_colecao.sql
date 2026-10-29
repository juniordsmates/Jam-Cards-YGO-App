-- Minha Coleção: as cartas que o usuário possui, uma linha por impressão e detalhe.
-- Impressão (código da coleção e raridade), idioma, edição e estado são opcionais: '' = "Não aplicado".
-- Cada usuário só vê e altera a própria coleção.

create table public.colecao (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  carta_id integer not null check (carta_id > 0),
  set_code text not null default '' check (char_length(set_code) <= 40),
  raridade text not null default '' check (char_length(raridade) <= 60),
  idioma text not null default '' check (char_length(idioma) <= 20),
  edicao text not null default '' check (edicao in ('', 'primeira', 'ilimitada', 'limitada')),
  estado text not null default '' check (estado in ('', 'NM', 'LP', 'MP', 'HP', 'DMG')),
  quantidade integer not null check (quantidade between 1 and 99),
  atualizado_em timestamptz not null default now(),
  -- a mesma carta com os mesmos detalhes é uma linha só (a quantidade soma)
  unique (usuario_id, carta_id, set_code, raridade, idioma, edicao, estado)
);

create index colecao_usuario on public.colecao (usuario_id);

alter table public.colecao enable row level security;
create policy "colecao: só o dono" on public.colecao for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
revoke all on public.colecao from anon;

create function public.colecao_atualizado() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger colecao_atualizado before update on public.colecao
  for each row execute function public.colecao_atualizado();

-- Lista de Desejos: as cartas que cada jogador quer conseguir, uma linha por carta, com a quantidade.
-- Cada usuário só vê e altera a própria lista (sem login, ela fica só no aparelho).

create table public.lista_desejos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  carta_id integer not null check (carta_id > 0),
  quantidade integer not null check (quantidade between 1 and 99),
  atualizado_em timestamptz not null default now(),
  unique (usuario_id, carta_id)
);

create index lista_desejos_usuario on public.lista_desejos (usuario_id);

alter table public.lista_desejos enable row level security;
create policy "lista_desejos: só o dono" on public.lista_desejos for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
revoke all on public.lista_desejos from anon;

-- reaproveita o gatilho da coleção (só atualiza atualizado_em)
create trigger lista_desejos_atualizado before update on public.lista_desejos
  for each row execute function public.colecao_atualizado();

-- Guia de Deck → Artigos de Jogadores: jogadores enviam artigos (táticas, jogadas, ideias) sobre um
-- deck; o artigo entra como pendente e só aparece para todos depois de aprovado pelo administrador.

create table public.artigos (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  autor_nome text not null check (char_length(autor_nome) between 1 and 60),
  -- nome oficial do arquétipo (em inglês), como no Guia de Deck
  arquetipo text not null check (char_length(arquetipo) between 1 and 80),
  idioma text not null check (idioma in ('pt', 'en', 'es')),
  tipo text not null check (tipo in ('tatica', 'jogada', 'ideia', 'combo', 'side')),
  titulo text not null check (char_length(titulo) between 3 and 140),
  resumo text not null default '' check (char_length(resumo) <= 400),
  conteudo text not null check (char_length(conteudo) between 50 and 20000),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  -- motivo da recusa (o autor vê)
  motivo text not null default '' check (char_length(motivo) <= 500),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index artigos_arquetipo on public.artigos (arquetipo, status);

alter table public.artigos enable row level security;

-- aprovados: todos (inclusive sem login); pendentes e recusados: o autor e o administrador
create policy "artigos: aprovados, do autor ou admin" on public.artigos for select
  using (status = 'aprovado' or autor_id = auth.uid() or public.sou_admin());
-- enviar: com login, sempre como pendente
create policy "artigos: usuário envia" on public.artigos for insert to authenticated
  with check (autor_id = auth.uid() and status = 'pendente');
-- o autor edita o próprio artigo enquanto está pendente (continua pendente)
create policy "artigos: autor edita pendente" on public.artigos for update to authenticated
  using (autor_id = auth.uid() and status = 'pendente')
  with check (autor_id = auth.uid() and status = 'pendente');
-- o administrador aprova ou recusa
create policy "artigos: admin modera" on public.artigos for update to authenticated
  using (public.sou_admin()) with check (public.sou_admin());
create policy "artigos: autor ou admin apaga" on public.artigos for delete to authenticated
  using (autor_id = auth.uid() or public.sou_admin());

revoke insert, update on public.artigos from anon, authenticated;
grant insert (autor_nome, arquetipo, idioma, tipo, titulo, resumo, conteudo) on public.artigos to authenticated;
grant update (titulo, resumo, conteudo, tipo, idioma, status, motivo) on public.artigos to authenticated;

create trigger artigos_atualizado before update on public.artigos
  for each row execute function public.tocar_atualizado_em();

-- Guia de Deck: decks acrescentados pelos administradores e referências da comunidade. Os decks do
-- metagame vêm da camada (metaTcg); aqui ficam os decks que não estão nela (com a deck list, de onde
-- sai o núcleo), os textos escritos em cada idioma e as referências encontradas nos sites do app
-- ("Buscar novos decks"), inclusive para os decks do meta. Todos leem; só administradores mudam.
-- Pode rodar de novo sem problema (não duplica nada).

create table if not exists public.guias_deck (
  arquetipo text primary key check (char_length(arquetipo) between 1 and 80),
  -- deck list: {main, extra, side} (opcional; os decks do meta usam a camada)
  lista jsonb check (lista is null or (jsonb_typeof(lista) = 'object' and octet_length(lista::text) < 20000)),
  -- {pt|en|es: {resumo, iniciais: [{titulo, itens}], avancadas: [{titulo, itens}]}}
  textos jsonb not null default '{}' check (jsonb_typeof(textos) = 'object' and octet_length(textos::text) < 200000),
  -- [{titulo, url, site, idioma, resumo, encontrado_em}]
  referencias jsonb not null default '[]' check (jsonb_typeof(referencias) = 'array' and octet_length(referencias::text) < 200000),
  revisado date not null default current_date,
  criado_por uuid default auth.uid() references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- o mesmo arquétipo não entra duas vezes com maiúsculas diferentes
create unique index if not exists guias_deck_arquetipo_unico on public.guias_deck (lower(arquetipo));

alter table public.guias_deck enable row level security;

drop policy if exists "guias_deck: todos leem" on public.guias_deck;
create policy "guias_deck: todos leem" on public.guias_deck for select using (true);

drop policy if exists "guias_deck: admin cria" on public.guias_deck;
create policy "guias_deck: admin cria" on public.guias_deck for insert to authenticated
  with check (public.sou_admin());

drop policy if exists "guias_deck: admin muda" on public.guias_deck;
create policy "guias_deck: admin muda" on public.guias_deck for update to authenticated
  using (public.sou_admin()) with check (public.sou_admin());

drop policy if exists "guias_deck: admin apaga" on public.guias_deck;
create policy "guias_deck: admin apaga" on public.guias_deck for delete to authenticated
  using (public.sou_admin());

grant select on public.guias_deck to anon, authenticated;
grant insert, update, delete on public.guias_deck to authenticated;

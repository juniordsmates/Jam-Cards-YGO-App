-- Eventos: resultados de torneio compartilhados pelos jogadores (aba Eventos), com a decklist.
--
-- Cada resultado é TCG ou OCG e Meta, Conceito ou Local. Meta e Local pedem o tipo de torneio
-- (um dos oficiais da Konami ou "Torneio Local"), a posição final e quantos jogadores, mais ou
-- menos, participaram. Conceito é só a ideia de deck, sem torneio.
--
-- Publicação: Conceito e Local saem na hora; Meta fica "pendente" até um administrador aprovar
-- (Análise de resultados). O administrador também pode recusar qualquer resultado (sai da lista).
-- Quem é administrador: a tabela admins (sou_admin()).
-- Pode rodar de novo sem problema (não duplica nada).

create table if not exists public.resultados_eventos (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  jogador text not null check (char_length(jogador) between 1 and 60),
  nome_deck text not null check (char_length(nome_deck) between 1 and 80),
  formato text not null check (formato in ('TCG', 'OCG')),
  categoria text not null check (categoria in ('meta', 'conceito', 'local')),
  -- tipos de torneio (rótulos no app, src/db/eventos.ts)
  tipo_torneio text check (tipo_torneio in ('wcs', 'wcq_continental', 'wcq_nacional', 'ycs', 'regional', 'ots', 'remote_duel', 'asia_ocg', 'local')),
  nome_evento text check (char_length(nome_evento) <= 120),
  data_evento date,
  posicao integer check (posicao between 1 and 100000),
  jogadores integer check (jogadores between 2 and 100000),
  main integer[] not null check (cardinality(main) between 40 and 60),
  extra integer[] not null default '{}' check (cardinality(extra) <= 15),
  side integer[] not null default '{}' check (cardinality(side) <= 15),
  observacoes text check (char_length(observacoes) <= 1000),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  motivo_recusa text check (char_length(motivo_recusa) <= 300),
  analisado_por uuid references public.perfis (id) on delete set null,
  analisado_em timestamptz,
  criado_em timestamptz not null default now(),
  -- Meta e Local: torneio, posição e jogadores obrigatórios
  check (categoria = 'conceito' or (tipo_torneio is not null and posicao is not null and jogadores is not null)),
  check (posicao is null or jogadores is null or posicao <= jogadores)
);

create index if not exists resultados_eventos_lista on public.resultados_eventos (status, formato, categoria, criado_em desc);
create index if not exists resultados_eventos_autor on public.resultados_eventos (autor_id);

alter table public.resultados_eventos enable row level security;

-- publicados para todos; pendentes e recusados só para o autor e os administradores
drop policy if exists "resultados_eventos: publicados, do autor ou admin" on public.resultados_eventos;
create policy "resultados_eventos: publicados, do autor ou admin" on public.resultados_eventos for select
  using (status = 'aprovado' or autor_id = auth.uid() or public.sou_admin());
drop policy if exists "resultados_eventos: autor cria" on public.resultados_eventos;
create policy "resultados_eventos: autor cria" on public.resultados_eventos for insert to authenticated
  with check (autor_id = auth.uid());
drop policy if exists "resultados_eventos: autor ou admin apaga" on public.resultados_eventos;
create policy "resultados_eventos: autor ou admin apaga" on public.resultados_eventos for delete to authenticated
  using (autor_id = auth.uid() or public.sou_admin());

-- o jogador não escolhe a situação: só as colunas abaixo; alterar, só pela análise
revoke insert, update on public.resultados_eventos from anon, authenticated;
grant insert (jogador, nome_deck, formato, categoria, tipo_torneio, nome_evento, data_evento, posicao, jogadores, main, extra, side, observacoes)
  on public.resultados_eventos to authenticated;

-- situação inicial: Meta aguarda avaliação; Conceito e Local são publicados na hora
create or replace function public.resultado_evento_situacao() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.status := case when new.categoria = 'meta' then 'pendente' else 'aprovado' end;
  new.motivo_recusa := null;
  new.analisado_por := null;
  new.analisado_em := null;
  -- Conceito não tem torneio
  if new.categoria = 'conceito' then
    new.tipo_torneio := null;
    new.posicao := null;
    new.jogadores := null;
  end if;
  return new;
end;
$$;
drop trigger if exists resultados_eventos_situacao on public.resultados_eventos;
create trigger resultados_eventos_situacao before insert on public.resultados_eventos
  for each row execute function public.resultado_evento_situacao();

-- Análise de resultados (administradores): aprovar ou recusar, com motivo opcional
create or replace function public.analisar_resultado(resultado uuid, aprovar boolean, motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.sou_admin() then
    raise exception 'só administradores analisam resultados';
  end if;
  update public.resultados_eventos
     set status = case when aprovar then 'aprovado' else 'recusado' end,
         motivo_recusa = case when aprovar then null else left(nullif(trim(motivo), ''), 300) end,
         analisado_por = auth.uid(),
         analisado_em = now()
   where id = resultado;
  if not found then
    raise exception 'resultado não encontrado';
  end if;
end;
$$;
revoke execute on function public.analisar_resultado(uuid, boolean, text) from public, anon;
grant execute on function public.analisar_resultado(uuid, boolean, text) to authenticated;

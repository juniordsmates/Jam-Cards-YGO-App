-- Simulador: match (melhor de 3) nas partidas 1x1. A match guarda os dois decks originais (com o Side),
-- o placar e o preparo do próximo jogo; cada jogo é uma sala normal em "duelos" (coluna "match" e
-- número do jogo), com a mesma troca de respostas de sempre.
-- Regras de torneio: vence quem ganha 2 jogos; antes do jogo 2 e do jogo 3 cada um troca cartas do Main
-- ou do Extra com o Side, carta por carta (Main, Extra e Side continuam do mesmo tamanho); o perdedor do
-- jogo anterior escolhe quem começa. Um jogo empatado não conta, e quem escolheu da última vez escolhe
-- de novo. O próximo jogo nasce aqui no banco quando os dois mandaram o deck e a escolha foi feita.
-- Pode rodar de novo sem problema (não duplica nada).

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  criador uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  convidado uuid references public.perfis (id) on delete set null,
  -- decks originais: {main, extra, side}
  deck_criador jsonb not null check (jsonb_typeof(deck_criador) = 'object' and octet_length(deck_criador::text) < 20000),
  deck_convidado jsonb check (deck_convidado is null or (jsonb_typeof(deck_convidado) = 'object' and octet_length(deck_convidado::text) < 20000)),
  vitorias_criador smallint not null default 0,
  vitorias_convidado smallint not null default 0,
  -- jogos já encerrados (o placar vale para o jogo atual quando jogos >= número dele)
  jogos smallint not null default 0,
  -- quem escolhe quem começa o próximo jogo
  escolhe text check (escolhe in ('criador', 'convidado')),
  estado text not null default 'em-andamento' check (estado in ('em-andamento', 'encerrado')),
  -- quem venceu a match; nulo enquanto ela não acaba (ou se foi cancelada)
  vencedor uuid references public.perfis (id) on delete set null,
  -- sala do jogo atual
  duelo_atual uuid,
  -- preparo do próximo jogo: o deck com o side trocado de cada um e quem começa
  prox_deck_criador jsonb check (prox_deck_criador is null or octet_length(prox_deck_criador::text) < 20000),
  prox_deck_convidado jsonb check (prox_deck_convidado is null or octet_length(prox_deck_convidado::text) < 20000),
  prox_primeiro text check (prox_primeiro in ('criador', 'convidado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.matches enable row level security;
revoke all on public.matches from anon;

-- quem joga lê a match; enquanto falta o convidado, quem tem o link da sala também lê
drop policy if exists "matches: participantes e convite" on public.matches;
create policy "matches: participantes e convite" on public.matches for select to authenticated
  using (auth.uid() in (criador, convidado) or convidado is null);

drop policy if exists "matches: criar" on public.matches;
create policy "matches: criar" on public.matches for insert to authenticated
  with check (
    criador = auth.uid() and convidado is null and deck_convidado is null and estado = 'em-andamento'
    and vitorias_criador = 0 and vitorias_convidado = 0 and jogos = 0 and escolhe is null and vencedor is null
    and duelo_atual is null and prox_deck_criador is null and prox_deck_convidado is null and prox_primeiro is null
  );
-- o resto muda só pelas funções abaixo (não há política de update)

-- cada jogo da match é uma sala em "duelos"
alter table public.duelos add column if not exists match uuid references public.matches (id) on delete cascade;
alter table public.duelos add column if not exists jogo smallint not null default 1;

-- criar sala: a do jogo 1 de uma match só pelo criador da match, antes de o oponente entrar
drop policy if exists "duelos: criar sala" on public.duelos;
create policy "duelos: criar sala" on public.duelos for insert to authenticated
  with check (
    criador = auth.uid() and convidado is null and deck_convidado is null and estado = 'aguardando' and vencedor is null
    and mao_criador is null and mao_convidado is null
    and (not escolher_mao or public.sou_premium())
    and jogo = 1
    and (
      match is null
      or (not escolher_mao and exists (select 1 from public.matches m where m.id = match and m.criador = auth.uid() and m.convidado is null and m.duelo_atual is null))
    )
  );

-- a sala do jogo 1 vira o jogo atual da match
create or replace function public.matches_jogo_1() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.match is not null and new.jogo = 1 then
    update public.matches set duelo_atual = new.id, atualizado_em = now() where id = new.match and duelo_atual is null;
  end if;
  return null;
end;
$$;
revoke all on function public.matches_jogo_1() from public, anon;
drop trigger if exists matches_jogo_1 on public.duelos;
create trigger matches_jogo_1 after insert on public.duelos
  for each row execute function public.matches_jogo_1();

-- o deck com o side trocado tem as mesmas cartas do original e Main, Extra e Side do mesmo tamanho
create or replace function public.deck_sideado_valido(p_original jsonb, p_novo jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  parte text;
  a text[];
  b text[];
begin
  if jsonb_typeof(p_novo) <> 'object' or octet_length(p_novo::text) >= 20000 then return false; end if;
  foreach parte in array array['main', 'extra', 'side'] loop
    if jsonb_typeof(coalesce(p_novo -> parte, '[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(p_original -> parte, '[]'::jsonb)) <> 'array' then return false; end if;
    if jsonb_array_length(coalesce(p_novo -> parte, '[]'::jsonb)) <> jsonb_array_length(coalesce(p_original -> parte, '[]'::jsonb)) then return false; end if;
  end loop;
  select coalesce(array_agg(x order by x), '{}') into a from (
    select jsonb_array_elements_text(coalesce(p_original -> 'main', '[]'::jsonb)) as x
    union all select jsonb_array_elements_text(coalesce(p_original -> 'extra', '[]'::jsonb))
    union all select jsonb_array_elements_text(coalesce(p_original -> 'side', '[]'::jsonb))
  ) s;
  select coalesce(array_agg(x order by x), '{}') into b from (
    select jsonb_array_elements_text(coalesce(p_novo -> 'main', '[]'::jsonb)) as x
    union all select jsonb_array_elements_text(coalesce(p_novo -> 'extra', '[]'::jsonb))
    union all select jsonb_array_elements_text(coalesce(p_novo -> 'side', '[]'::jsonb))
  ) s;
  return a = b;
end;
$$;
revoke all on function public.deck_sideado_valido(jsonb, jsonb) from public, anon;

-- entrar numa sala (como em 20261110020000); na sala de uma match, o convidado entra na match também
create or replace function public.entrar_duelo(p_duelo uuid, p_deck jsonb, p_versao_motor text, p_versao_app text)
returns public.duelos
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.duelos;
begin
  perform public.limpar_duelos_antigos();
  select * into d from public.duelos where id = p_duelo for update;
  if not found then raise exception 'sala não encontrada (as salas valem por 4 horas)'; end if;
  if d.criador = auth.uid() then raise exception 'você criou esta sala: mande o link ou o código para o seu oponente'; end if;
  if d.estado <> 'aguardando' or d.convidado is not null then raise exception 'esta sala já começou ou foi encerrada'; end if;
  if d.versao_app <> p_versao_app then raise exception 'versões diferentes do app (sala: %, sua: %): atualizem para a mesma versão', d.versao_app, p_versao_app; end if;
  if d.versao_motor <> p_versao_motor then raise exception 'motores de regras diferentes: abram o Simulador de novo para baixar o mais recente'; end if;
  if jsonb_typeof(p_deck) <> 'object' or octet_length(p_deck::text) >= 20000 then raise exception 'deck inválido'; end if;
  update public.duelos
    set convidado = auth.uid(), deck_convidado = p_deck, estado = 'em-andamento', atualizado_em = now()
    where id = p_duelo
    returning * into d;
  if d.match is not null then
    update public.matches set convidado = auth.uid(), deck_convidado = p_deck, atualizado_em = now()
      where id = d.match and convidado is null;
  end if;
  return d;
end;
$$;
revoke all on function public.entrar_duelo(uuid, jsonb, text, text) from public, anon;
grant execute on function public.entrar_duelo(uuid, jsonb, text, text) to authenticated;

-- encerrar (como em 20261110000000); o jogo atual de uma match também atualiza o placar dela
create or replace function public.encerrar_duelo(p_duelo uuid, p_vencedor smallint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.duelos;
  m public.matches;
  ganhou text;
begin
  update public.duelos
    set estado = 'encerrado', vencedor = case when estado = 'em-andamento' then p_vencedor end, atualizado_em = now()
    where id = p_duelo and estado <> 'encerrado' and auth.uid() in (criador, convidado)
      and (p_vencedor is null or p_vencedor in (0, 1))
    returning * into d;
  if not found or d.match is null then return; end if;
  select * into m from public.matches where id = d.match for update;
  if not found or m.estado <> 'em-andamento' or m.duelo_atual is distinct from d.id then return; end if;
  -- sala cancelada antes de o oponente entrar: a match acaba sem vencedor
  if d.convidado is null then
    update public.matches set estado = 'encerrado', atualizado_em = now() where id = m.id;
    return;
  end if;
  ganhou := case when d.vencedor is null then null when d.vencedor = d.criador_jogador then 'criador' else 'convidado' end;
  update public.matches set
    vitorias_criador = vitorias_criador + case when ganhou = 'criador' then 1 else 0 end,
    vitorias_convidado = vitorias_convidado + case when ganhou = 'convidado' then 1 else 0 end,
    jogos = jogos + 1,
    -- o perdedor escolhe; no empate, quem escolheu antes (no jogo 1, quem começou)
    escolhe = case ganhou
      when 'criador' then 'convidado'
      when 'convidado' then 'criador'
      else coalesce(escolhe, case when d.criador_jogador = 0 then 'criador' else 'convidado' end)
    end,
    prox_deck_criador = null, prox_deck_convidado = null, prox_primeiro = null,
    atualizado_em = now()
    where id = m.id
    returning * into m;
  if m.vitorias_criador >= 2 or m.vitorias_convidado >= 2 then
    update public.matches
      set estado = 'encerrado', vencedor = case when m.vitorias_criador >= 2 then m.criador else m.convidado end, atualizado_em = now()
      where id = m.id;
  end if;
end;
$$;
revoke all on function public.encerrar_duelo(uuid, smallint) from public, anon;
grant execute on function public.encerrar_duelo(uuid, smallint) to authenticated;

-- entre os jogos: cada um manda o deck com o side trocado; quem escolhe manda também quem começa.
-- Com tudo gravado, a sala do próximo jogo nasce aqui, já em andamento.
create or replace function public.preparar_jogo(p_match uuid, p_deck jsonb, p_primeiro text)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches;
  anterior public.duelos;
  novo public.duelos;
  papel text;
  h text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  select * into m from public.matches where id = p_match for update;
  if not found then raise exception 'match não encontrada (as salas valem por 4 horas)'; end if;
  if auth.uid() is null or auth.uid() not in (m.criador, m.convidado) then raise exception 'você não está nesta match'; end if;
  if m.estado <> 'em-andamento' then raise exception 'esta match já terminou'; end if;
  select * into anterior from public.duelos where id = m.duelo_atual;
  if not found or anterior.estado <> 'encerrado' or m.jogos < anterior.jogo then raise exception 'o jogo atual ainda não terminou'; end if;
  papel := case when auth.uid() = m.criador then 'criador' else 'convidado' end;
  if not public.deck_sideado_valido(case when papel = 'criador' then m.deck_criador else m.deck_convidado end, p_deck) then
    raise exception 'troca de side inválida: Main, Extra e Side precisam ter as mesmas cartas e o mesmo tamanho do deck original';
  end if;
  if p_primeiro is not null then
    if papel is distinct from m.escolhe then raise exception 'quem escolhe quem começa é o perdedor do jogo anterior'; end if;
    if p_primeiro not in ('criador', 'convidado') then raise exception 'escolha inválida'; end if;
  end if;
  update public.matches set
    prox_deck_criador = case when papel = 'criador' then p_deck else prox_deck_criador end,
    prox_deck_convidado = case when papel = 'convidado' then p_deck else prox_deck_convidado end,
    prox_primeiro = coalesce(p_primeiro, prox_primeiro),
    atualizado_em = now()
    where id = m.id
    returning * into m;
  if m.prox_deck_criador is null or m.prox_deck_convidado is null or m.prox_primeiro is null then return m; end if;
  -- semente: 4 números de 32 bits sorteados (o mesmo formato que o app usa)
  insert into public.duelos (criador, convidado, criador_jogador, semente, deck_criador, deck_convidado, versao_motor, versao_app, estado, match, jogo)
    values (
      m.criador, m.convidado,
      case when m.prox_primeiro = 'criador' then 0 else 1 end,
      array[
        (('x' || lpad(substr(h, 1, 8), 16, '0'))::bit(64)::bigint)::text,
        (('x' || lpad(substr(h, 9, 8), 16, '0'))::bit(64)::bigint)::text,
        (('x' || lpad(substr(h, 33, 8), 16, '0'))::bit(64)::bigint)::text,
        (('x' || lpad(substr(h, 41, 8), 16, '0'))::bit(64)::bigint)::text
      ],
      m.prox_deck_criador, m.prox_deck_convidado, anterior.versao_motor, anterior.versao_app, 'em-andamento', m.id, anterior.jogo + 1
    )
    returning * into novo;
  update public.matches
    set duelo_atual = novo.id, prox_deck_criador = null, prox_deck_convidado = null, prox_primeiro = null, atualizado_em = now()
    where id = m.id
    returning * into m;
  return m;
end;
$$;
revoke all on function public.preparar_jogo(uuid, jsonb, text) from public, anon;
grant execute on function public.preparar_jogo(uuid, jsonb, text) to authenticated;

-- abandonar a match: o outro vence a match (e o jogo em andamento, se houver)
create or replace function public.abandonar_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches;
begin
  select * into m from public.matches where id = p_match for update;
  if not found or m.estado <> 'em-andamento' then return; end if;
  if auth.uid() is null or auth.uid() not in (m.criador, m.convidado) then raise exception 'você não está nesta match'; end if;
  update public.matches
    set estado = 'encerrado', vencedor = case when auth.uid() = m.criador then m.convidado else m.criador end, atualizado_em = now()
    where id = m.id;
  update public.duelos
    set estado = 'encerrado',
      vencedor = case when estado = 'em-andamento' then (case when auth.uid() = criador then 1 - criador_jogador else criador_jogador end)::smallint end,
      atualizado_em = now()
    where id = m.duelo_atual and estado <> 'encerrado';
end;
$$;
revoke all on function public.abandonar_match(uuid) from public, anon;
grant execute on function public.abandonar_match(uuid) to authenticated;

-- limpeza (como em 20261110020000): as matches de mais de 4 horas também saem (com as salas delas)
create or replace function public.limpar_duelos_antigos() returns void
language sql security definer set search_path = '' as $$
  delete from public.matches where criado_em < now() - interval '4 hours';
  delete from public.duelos where criado_em < now() - interval '4 hours';
$$;
revoke all on function public.limpar_duelos_antigos() from public, anon;

-- Realtime: placar, preparo e o próximo jogo chegam na hora para os dois
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'matches') then
    alter publication supabase_realtime add table public.matches;
  end if;
end;
$$;

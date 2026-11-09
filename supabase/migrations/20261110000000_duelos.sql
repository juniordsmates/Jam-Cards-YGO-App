-- Simulador: partidas 1x1 entre jogadores. Os dois aparelhos rodam o motor de regras com a mesma
-- semente e os mesmos decks e trocam só as respostas (o motor é determinístico: as mesmas respostas
-- refazem o mesmo duelo). A sala fica em "duelos"; cada resposta, numerada, em "duelo_respostas",
-- que também serve para voltar ao duelo depois de cair. As duas tabelas vão para o Realtime.
-- Pode rodar de novo sem problema (não duplica nada).

create table if not exists public.duelos (
  id uuid primary key default gen_random_uuid(),
  criador uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  convidado uuid references public.perfis (id) on delete set null,
  -- lugar do criador no motor (0 começa o duelo); sorteado ao criar a sala
  criador_jogador smallint not null check (criador_jogador in (0, 1)),
  semente text[] not null check (array_length(semente, 1) = 4),
  deck_criador jsonb not null check (jsonb_typeof(deck_criador) = 'object' and octet_length(deck_criador::text) < 20000),
  deck_convidado jsonb check (deck_convidado is null or (jsonb_typeof(deck_convidado) = 'object' and octet_length(deck_convidado::text) < 20000)),
  -- os dois precisam do mesmo motor e do mesmo app, senão o duelo diverge
  versao_motor text not null check (char_length(versao_motor) <= 40),
  versao_app text not null check (char_length(versao_app) <= 40),
  estado text not null default 'aguardando' check (estado in ('aguardando', 'em-andamento', 'encerrado')),
  -- jogador do motor (0 ou 1) que venceu; nulo em empate ou sala cancelada
  vencedor smallint check (vencedor in (0, 1)),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.duelos enable row level security;
revoke all on public.duelos from anon;

-- quem joga lê a sala; uma sala aguardando é lida por quem tem o link (para entrar)
drop policy if exists "duelos: participantes e convite" on public.duelos;
create policy "duelos: participantes e convite" on public.duelos for select to authenticated
  using (auth.uid() in (criador, convidado) or estado = 'aguardando');

drop policy if exists "duelos: criar sala" on public.duelos;
create policy "duelos: criar sala" on public.duelos for insert to authenticated
  with check (criador = auth.uid() and convidado is null and deck_convidado is null and estado = 'aguardando' and vencedor is null);
-- entrar e encerrar só pelas funções abaixo (não há política de update)

create table if not exists public.duelo_respostas (
  duelo uuid not null references public.duelos (id) on delete cascade,
  -- posição da resposta no histórico do duelo (0, 1, 2…)
  n integer not null check (n >= 0),
  -- jogador do motor que respondeu
  jogador smallint not null check (jogador in (0, 1)),
  resposta jsonb not null check (octet_length(resposta::text) < 4000),
  criado_em timestamptz not null default now(),
  primary key (duelo, n)
);

alter table public.duelo_respostas enable row level security;
revoke all on public.duelo_respostas from anon;

drop policy if exists "duelo_respostas: participantes leem" on public.duelo_respostas;
create policy "duelo_respostas: participantes leem" on public.duelo_respostas for select to authenticated
  using (exists (select 1 from public.duelos d where d.id = duelo_respostas.duelo and auth.uid() in (d.criador, d.convidado)));

-- cada um envia só as próprias respostas, num duelo em andamento, sem pular posição
drop policy if exists "duelo_respostas: jogador envia a sua" on public.duelo_respostas;
create policy "duelo_respostas: jogador envia a sua" on public.duelo_respostas for insert to authenticated
  with check (
    exists (
      select 1 from public.duelos d
      where d.id = duelo_respostas.duelo
        and d.estado = 'em-andamento'
        and ((auth.uid() = d.criador and jogador = d.criador_jogador) or (auth.uid() = d.convidado and jogador = 1 - d.criador_jogador))
    )
    and n = (select count(*) from public.duelo_respostas r where r.duelo = duelo_respostas.duelo)
  );

-- entrar numa sala: confere as versões e grava o convidado e o deck dele
create or replace function public.entrar_duelo(p_duelo uuid, p_deck jsonb, p_versao_motor text, p_versao_app text)
returns public.duelos
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.duelos;
begin
  select * into d from public.duelos where id = p_duelo for update;
  if not found then raise exception 'sala não encontrada'; end if;
  if d.criador = auth.uid() then raise exception 'você criou esta sala: mande o link para o seu oponente'; end if;
  if d.estado <> 'aguardando' or d.convidado is not null then raise exception 'esta sala já começou ou foi encerrada'; end if;
  if d.versao_app <> p_versao_app then raise exception 'versões diferentes do app (sala: %, sua: %): atualizem para a mesma versão', d.versao_app, p_versao_app; end if;
  if d.versao_motor <> p_versao_motor then raise exception 'motores de regras diferentes: abram o Simulador de novo para baixar o mais recente'; end if;
  if jsonb_typeof(p_deck) <> 'object' or octet_length(p_deck::text) >= 20000 then raise exception 'deck inválido'; end if;
  update public.duelos
    set convidado = auth.uid(), deck_convidado = p_deck, estado = 'em-andamento', atualizado_em = now()
    where id = p_duelo
    returning * into d;
  return d;
end;
$$;

-- encerrar: fim do duelo (vencedor), desistência ou cancelamento da sala; repetir não muda nada
create or replace function public.encerrar_duelo(p_duelo uuid, p_vencedor smallint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.duelos
    set estado = 'encerrado', vencedor = case when estado = 'em-andamento' then p_vencedor end, atualizado_em = now()
    where id = p_duelo and estado <> 'encerrado' and auth.uid() in (criador, convidado)
      and (p_vencedor is null or p_vencedor in (0, 1));
end;
$$;

revoke all on function public.entrar_duelo(uuid, jsonb, text, text) from public, anon;
revoke all on function public.encerrar_duelo(uuid, smallint) from public, anon;
grant execute on function public.entrar_duelo(uuid, jsonb, text, text) to authenticated;
grant execute on function public.encerrar_duelo(uuid, smallint) to authenticated;

-- Realtime: as jogadas e as mudanças da sala chegam na hora para os dois
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'duelos') then
    alter publication supabase_realtime add table public.duelos;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'duelo_respostas') then
    alter publication supabase_realtime add table public.duelo_respostas;
  end if;
end;
$$;

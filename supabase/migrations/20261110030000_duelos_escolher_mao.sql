-- Partidas 1x1: "Escolher Cartas na Mão" (Premium). Quem cria a sala (precisa ser Premium) pode ligar
-- a escolha das mãos: depois que o oponente entra, cada jogador escolhe as cartas da própria mão
-- inicial e clica em "Pronto"; o duelo começa quando as duas mãos estão gravadas. A mão gravada
-- vai para o topo do Deck depois de embaralhar (Partida.maos no app); lista vazia = mão aleatória.
-- Pode rodar de novo sem problema (não duplica nada).

alter table public.duelos add column if not exists escolher_mao boolean not null default false;
-- mão escolhida por cada um (até 5 cartas do próprio Deck); nula enquanto ele não deu "Pronto"
alter table public.duelos add column if not exists mao_criador integer[];
alter table public.duelos add column if not exists mao_convidado integer[];

-- criar sala: as mãos começam vazias e só um Premium liga a escolha das mãos
drop policy if exists "duelos: criar sala" on public.duelos;
create policy "duelos: criar sala" on public.duelos for insert to authenticated
  with check (
    criador = auth.uid() and convidado is null and deck_convidado is null and estado = 'aguardando' and vencedor is null
    and mao_criador is null and mao_convidado is null
    and (not escolher_mao or public.sou_premium())
  );

-- "Pronto": grava a mão de quem chama, uma vez só, numa sala com a escolha ligada e já com os dois
create or replace function public.definir_mao_duelo(p_duelo uuid, p_mao integer[])
returns public.duelos
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.duelos;
begin
  select * into d from public.duelos where id = p_duelo for update;
  if not found then raise exception 'sala não encontrada (as salas valem por 4 horas)'; end if;
  if auth.uid() is null or auth.uid() not in (d.criador, d.convidado) then raise exception 'você não está nesta sala'; end if;
  if not d.escolher_mao then raise exception 'esta sala não tem a escolha das mãos'; end if;
  if d.estado <> 'em-andamento' then raise exception 'a escolha das mãos é depois que o oponente entra e antes do duelo'; end if;
  if coalesce(array_length(p_mao, 1), 0) > 5 then raise exception 'a mão inicial tem no máximo 5 cartas'; end if;
  if auth.uid() = d.criador then
    if d.mao_criador is not null then raise exception 'você já deu Pronto'; end if;
    update public.duelos set mao_criador = coalesce(p_mao, '{}'), atualizado_em = now() where id = p_duelo returning * into d;
  else
    if d.mao_convidado is not null then raise exception 'você já deu Pronto'; end if;
    update public.duelos set mao_convidado = coalesce(p_mao, '{}'), atualizado_em = now() where id = p_duelo returning * into d;
  end if;
  return d;
end;
$$;
revoke all on function public.definir_mao_duelo(uuid, integer[]) from public, anon;
grant execute on function public.definir_mao_duelo(uuid, integer[]) to authenticated;

-- as jogadas só valem depois das duas mãos (com a escolha ligada)
drop policy if exists "duelo_respostas: jogador envia a sua" on public.duelo_respostas;
create policy "duelo_respostas: jogador envia a sua" on public.duelo_respostas for insert to authenticated
  with check (
    exists (
      select 1 from public.duelos d
      where d.id = duelo_respostas.duelo
        and d.estado = 'em-andamento'
        and (not d.escolher_mao or (d.mao_criador is not null and d.mao_convidado is not null))
        and ((auth.uid() = d.criador and jogador = d.criador_jogador) or (auth.uid() = d.convidado and jogador = 1 - d.criador_jogador))
    )
    and n = public.duelo_total_respostas(duelo_respostas.duelo)
  );

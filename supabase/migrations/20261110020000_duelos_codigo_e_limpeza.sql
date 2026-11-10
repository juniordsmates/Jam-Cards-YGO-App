-- Partidas 1x1: código numérico da sala (6 dígitos, além do link) e limpeza das salas antigas.
-- Toda sala criada há mais de 4 horas é apagada (com as respostas dela) sempre que alguém cria
-- uma sala ou entra numa; esta migração também já apaga as que existirem.
-- Pode rodar de novo sem problema (não duplica nada).

-- código de 6 dígitos que nenhuma sala existente usa
create or replace function public.novo_codigo_duelo() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  c text;
begin
  loop
    c := lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not exists (select 1 from public.duelos where codigo = c);
  end loop;
  return c;
end;
$$;
revoke all on function public.novo_codigo_duelo() from public, anon;
-- quem cria a sala usa a função (valor padrão da coluna no insert)
grant execute on function public.novo_codigo_duelo() to authenticated;

alter table public.duelos add column if not exists codigo text;
update public.duelos set codigo = public.novo_codigo_duelo() where codigo is null;
alter table public.duelos alter column codigo set default public.novo_codigo_duelo();
alter table public.duelos alter column codigo set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'duelos_codigo_unico') then
    alter table public.duelos add constraint duelos_codigo_unico unique (codigo);
  end if;
end;
$$;

-- apaga as salas com mais de 4 horas (as respostas vão junto: on delete cascade)
create or replace function public.limpar_duelos_antigos() returns void
language sql security definer set search_path = '' as $$
  delete from public.duelos where criado_em < now() - interval '4 hours';
$$;
revoke all on function public.limpar_duelos_antigos() from public, anon;

create or replace function public.duelos_limpar_ao_criar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.limpar_duelos_antigos();
  return null;
end;
$$;
drop trigger if exists duelos_limpar_ao_criar on public.duelos;
create trigger duelos_limpar_ao_criar after insert on public.duelos
  for each statement execute function public.duelos_limpar_ao_criar();

-- entrar numa sala: limpa as antigas antes (uma sala de mais de 4 horas não pode mais ser usada)
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
  return d;
end;
$$;
revoke all on function public.entrar_duelo(uuid, jsonb, text, text) from public, anon;
grant execute on function public.entrar_duelo(uuid, jsonb, text, text) to authenticated;

-- já apaga as salas antigas que existirem
select public.limpar_duelos_antigos();

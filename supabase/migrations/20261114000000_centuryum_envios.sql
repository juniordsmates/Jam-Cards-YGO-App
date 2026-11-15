-- Envios ao Centuryum, a IA principal do Jam Cards: com a opção "Ajudar a IA a aprender" ligada, o
-- Simulador envia o que cada duelo ensinou (linhas de combo, respostas e a análise da IA), sem nomes.
-- Ninguém lê pelo app: só a rotina do Centuryum, com a chave de serviço. Para enviar, é preciso estar
-- logado; até 100 envios por conta por dia. Apagar a conta apaga os envios dela.
-- Pode rodar de novo sem problema (não duplica nada).

create table if not exists public.centuryum_envios (
  id bigint generated always as identity primary key,
  conta uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('duelo', 'analise')),
  dados jsonb not null check (jsonb_typeof(dados) = 'object' and octet_length(dados::text) < 262144),
  versao_motor text not null check (length(versao_motor) <= 100),
  versao_app text not null check (length(versao_app) <= 40),
  criado_em timestamptz not null default now()
);

create index if not exists centuryum_envios_conta on public.centuryum_envios (conta, criado_em);

alter table public.centuryum_envios enable row level security;

-- o cliente só escolhe o conteúdo; conta e data vêm do servidor; ninguém lê pelo app
revoke all on public.centuryum_envios from anon, authenticated;
grant insert (tipo, dados, versao_motor, versao_app) on public.centuryum_envios to authenticated;

drop policy if exists "centuryum: a conta envia os seus" on public.centuryum_envios;
create policy "centuryum: a conta envia os seus" on public.centuryum_envios for insert to authenticated
  with check (conta = auth.uid());

-- antes de gravar: no máximo 100 envios por conta nas últimas 24 horas
create or replace function public.centuryum_antes_de_enviar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.centuryum_envios where conta = new.conta and criado_em > now() - interval '1 day') >= 100 then
    raise exception 'Limite de 100 envios ao Centuryum por dia.';
  end if;
  return new;
end;
$$;
drop trigger if exists centuryum_antes_de_enviar on public.centuryum_envios;
create trigger centuryum_antes_de_enviar before insert on public.centuryum_envios
  for each row execute function public.centuryum_antes_de_enviar();

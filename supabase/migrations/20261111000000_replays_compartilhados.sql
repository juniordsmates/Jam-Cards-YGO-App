-- Replays compartilhados do Simulador: o jogador envia um replay (semente, decks e respostas) e
-- recebe um link curto (#/replay/<código>). Qualquer pessoa com o link vê o replay, mesmo sem conta.
-- Cada link vale por 10 dias. Para criar, é preciso estar logado: até 3 links ativos por conta
-- (20 no Premium). Só quem criou apaga o próprio link.
-- Pode rodar de novo sem problema (não duplica nada).

-- código de 8 letras/dígitos que nenhum replay existente usa (difícil de adivinhar)
create or replace function public.novo_codigo_replay() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  c text;
begin
  loop
    c := substr(md5(random()::text || clock_timestamp()::text), 1, 8);
    exit when not exists (select 1 from public.replays_compartilhados where codigo = c);
  end loop;
  return c;
end;
$$;

create table if not exists public.replays_compartilhados (
  codigo text primary key,
  criador uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dados jsonb not null check (jsonb_typeof(dados) = 'object' and octet_length(dados::text) < 262144),
  versao_motor text not null check (length(versao_motor) <= 100),
  versao_app text not null check (length(versao_app) <= 40),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '10 days'
);
-- o padrão do código depende da tabela existir (a função consulta a tabela)
alter table public.replays_compartilhados alter column codigo set default public.novo_codigo_replay();
revoke all on function public.novo_codigo_replay() from public, anon;
grant execute on function public.novo_codigo_replay() to authenticated;

create index if not exists replays_compartilhados_criador on public.replays_compartilhados (criador);

alter table public.replays_compartilhados enable row level security;

-- o cliente só escolhe o conteúdo; código, criador, datas e validade vêm do servidor
revoke all on public.replays_compartilhados from anon, authenticated;
grant select on public.replays_compartilhados to anon, authenticated;
grant insert (dados, versao_motor, versao_app) on public.replays_compartilhados to authenticated;
grant delete on public.replays_compartilhados to authenticated;

drop policy if exists "replays: qualquer um vê os válidos" on public.replays_compartilhados;
create policy "replays: qualquer um vê os válidos" on public.replays_compartilhados for select to anon, authenticated
  using (expira_em > now());

drop policy if exists "replays: a conta cria os seus" on public.replays_compartilhados;
create policy "replays: a conta cria os seus" on public.replays_compartilhados for insert to authenticated
  with check (criador = auth.uid());

drop policy if exists "replays: quem criou apaga" on public.replays_compartilhados;
create policy "replays: quem criou apaga" on public.replays_compartilhados for delete to authenticated
  using (criador = auth.uid());

-- antes de criar: apaga os vencidos e confere o limite de links ativos da conta
create or replace function public.replays_antes_de_criar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  limite int := case when public.sou_premium() then 20 else 3 end;
begin
  delete from public.replays_compartilhados where expira_em <= now();
  if (select count(*) from public.replays_compartilhados where criador = new.criador) >= limite then
    raise exception 'Limite de % links de replay ativos: apague um link ou espere ele vencer (cada um vale por 10 dias).', limite;
  end if;
  return new;
end;
$$;
drop trigger if exists replays_antes_de_criar on public.replays_compartilhados;
create trigger replays_antes_de_criar before insert on public.replays_compartilhados
  for each row execute function public.replays_antes_de_criar();

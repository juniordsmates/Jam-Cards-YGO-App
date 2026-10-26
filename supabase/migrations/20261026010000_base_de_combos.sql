-- Base de combos única e indexada.
-- Cada combo guarda o JSON completo em "dados" e é encontrado pelos índices:
--   arquétipo (nome oficial em inglês) > starters (cartas iniciais) > combos  — visão combos_indice
--   cartas finais e todas as cartas                                         — para o Combo Search
-- A origem diz de onde veio: calculado pelo App, criado pela comunidade ou sugerido por IA.
-- (substitui a tabela combos da migração anterior, que ainda estava vazia)

drop table public.combos;

create type public.origem_combo as enum ('app', 'comunidade', 'ia');

-- ---------------------------------------------------------------- buscas do Combo Search

create table public.buscas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  iniciais integer[] not null default '{}' check (cardinality(iniciais) <= 10),
  finais integer[] not null default '{}' check (cardinality(finais) <= 10),
  formato text check (formato in ('TCG', 'OCG')),
  modelo text check (char_length(modelo) <= 60),
  criado_em timestamptz not null default now(),
  check (cardinality(iniciais) + cardinality(finais) > 0)
);

alter table public.buscas enable row level security;

create policy "buscas: usuário vê as suas" on public.buscas for select using (usuario_id = auth.uid());
create policy "buscas: usuário registra as suas" on public.buscas for insert to authenticated
  with check (usuario_id = auth.uid());

revoke insert, update on public.buscas from anon, authenticated;
grant insert (iniciais, finais, formato, modelo) on public.buscas to authenticated;

-- ---------------------------------------------------------------- combos

create table public.combos (
  id uuid primary key default gen_random_uuid(),
  origem public.origem_combo not null,
  -- autor: obrigatório na comunidade; combos do App não têm autor
  autor_id uuid default auth.uid() references public.perfis (id) on delete set null,
  autor_nome text check (char_length(autor_nome) between 1 and 60),
  titulo text not null check (char_length(titulo) between 1 and 120),
  -- índices
  arquetipos text[] not null default '{}',
  iniciais integer[] not null default '{}' check (cardinality(iniciais) <= 10),
  finais integer[] not null default '{}' check (cardinality(finais) <= 20),
  cartas integer[] not null default '{}', -- preenchido pelo trigger
  -- o combo: { qualquer, passos, campo, observacoes, fontes } no mesmo formato do app (src/db/motor.ts)
  dados jsonb not null check (jsonb_typeof(dados -> 'passos') = 'array' and octet_length(dados::text) < 80000),
  busca_id uuid references public.buscas (id) on delete set null,
  copiado_de uuid references public.combos (id) on delete set null,
  publico boolean not null default true,
  -- preenchido só pelo pipeline (conferência com as regras do App)
  conferido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (origem <> 'comunidade' or autor_nome is not null),
  check (cardinality(iniciais) + cardinality(finais) > 0)
);

create index combos_arquetipos on public.combos using gin (arquetipos);
create index combos_iniciais on public.combos using gin (iniciais);
create index combos_finais on public.combos using gin (finais);
create index combos_cartas on public.combos using gin (cartas);
create index combos_origem on public.combos (origem);
create index combos_autor on public.combos (autor_id);

-- todas as cartas do combo: iniciais, finais e todo id citado nos passos e no campo final
create function public.combos_indexar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if cardinality(new.finais) = 0 then
    new.finais := coalesce(array(
      select distinct (v #>> '{}')::integer
      from jsonb_path_query(new.dados, 'strict $.campo.** ? (@.type() == "number")') as v
    ), '{}');
  end if;
  new.cartas := coalesce(array(
    select distinct x from (
      select unnest(new.iniciais || new.finais) as x
      union
      select (v #>> '{}')::integer
      from jsonb_path_query(new.dados, 'strict $.passos[*].** ? (@.type() == "number")') as v
    ) ids where x > 0
  ), '{}');
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger combos_indexar before insert or update on public.combos
  for each row execute function public.combos_indexar();

alter table public.combos enable row level security;

create policy "combos: públicos ou do autor" on public.combos for select
  using (publico or autor_id = auth.uid());
-- usuários só criam combos da comunidade ou sugestões de IA (combos do App vêm do pipeline)
create policy "combos: usuário cria" on public.combos for insert to authenticated
  with check (autor_id = auth.uid() and origem in ('comunidade', 'ia'));
create policy "combos: autor altera os da comunidade" on public.combos for update to authenticated
  using (autor_id = auth.uid() and origem = 'comunidade')
  with check (autor_id = auth.uid() and origem = 'comunidade');
create policy "combos: autor apaga os da comunidade" on public.combos for delete to authenticated
  using (autor_id = auth.uid() and origem = 'comunidade');

revoke insert, update on public.combos from anon, authenticated;
grant insert (origem, autor_nome, titulo, arquetipos, iniciais, finais, dados, busca_id, copiado_de, publico)
  on public.combos to authenticated;
grant update (autor_nome, titulo, arquetipos, iniciais, finais, dados, publico) on public.combos to authenticated;

-- ---------------------------------------------------------------- índice: arquétipo > starter > combos

create view public.combos_indice with (security_invoker = true) as
select a.arquetipo, s.starter, c.id as combo_id, c.origem, c.titulo
from public.combos c
cross join lateral unnest(
  case when cardinality(c.arquetipos) = 0 then array['(sem arquétipo)'] else c.arquetipos end
) as a (arquetipo)
cross join lateral unnest(c.iniciais) as s (starter);

grant select on public.combos_indice to anon, authenticated;

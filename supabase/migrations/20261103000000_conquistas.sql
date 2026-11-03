-- Conquistas (por enquanto, só pontos) e o Rank dos duelistas.
--
-- Compartilhar um combo vale 5 pontos: Combo da Comunidade público, criado pela própria conta.
-- Os pontos são calculados dos próprios combos, não de uma tabela de pontos que o app alteraria:
-- tirar o compartilhamento ou apagar o combo tira os pontos dele. Um combo salvo a partir de outro
-- (copiado_de: linha do App, sugestão de IA) conta uma vez por conta, por mais que seja salvo de novo.
--
-- Os valores ficam em regras_pontos: mudar ou acrescentar conquistas não exige mudar o app.

-- ---------------------------------------------------------------- regras

create table public.regras_pontos (
  acao text primary key,
  pontos integer not null check (pontos >= 0),
  descricao text not null
);

alter table public.regras_pontos enable row level security;
create policy "regras_pontos: leitura pública" on public.regras_pontos for select using (true);
-- só o banco (migrações) altera as regras
revoke insert, update, delete on public.regras_pontos from anon, authenticated;

insert into public.regras_pontos (acao, pontos, descricao)
values ('combo_compartilhado', 5, 'Compartilhar um Combo da Comunidade');

-- ---------------------------------------------------------------- combos que pontuam

-- um combo por conta e por origem: o primeiro compartilhamento de cada combo (ou de cada cópia)
create view public.combos_pontuados with (security_invoker = true) as
select distinct on (c.autor_id, coalesce(c.copiado_de, c.id))
  c.id, c.autor_id, c.arquetipos, c.criado_em
from public.combos c
where c.origem = 'comunidade' and c.publico and c.autor_id is not null
order by c.autor_id, coalesce(c.copiado_de, c.id), c.criado_em;

-- ---------------------------------------------------------------- rank geral

create view public.ranking_duelistas with (security_invoker = true) as
select p.id as usuario_id,
       p.usuario,
       count(*)::integer as combos_compartilhados,
       (count(*) * (select r.pontos from public.regras_pontos r where r.acao = 'combo_compartilhado'))::integer as pontos,
       max(c.criado_em) as ultimo_combo
from public.combos_pontuados c
join public.perfis p on p.id = c.autor_id
group by p.id, p.usuario;

-- ---------------------------------------------------------------- rank por arquétipo (aba Comunidade)

create view public.ranking_arquetipos with (security_invoker = true) as
select a.arquetipo,
       p.id as usuario_id,
       p.usuario,
       count(*)::integer as combos_compartilhados,
       (count(*) * (select r.pontos from public.regras_pontos r where r.acao = 'combo_compartilhado'))::integer as pontos
from public.combos_pontuados c
cross join lateral unnest(c.arquetipos) as a (arquetipo)
join public.perfis p on p.id = c.autor_id
group by a.arquetipo, p.id, p.usuario;

grant select on public.regras_pontos, public.combos_pontuados, public.ranking_duelistas, public.ranking_arquetipos to anon, authenticated;

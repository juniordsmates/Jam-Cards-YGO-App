-- Conquistas desbloqueáveis (como os troféus do PS5 e as conquistas da Steam), ao lado dos pontos
-- do Rank (20261103000000_conquistas.sql).
--
-- conquistas: o catálogo (nível, ordem, carta cuja arte é o ícone). Os nomes e as descrições ficam
--   no app (src/data/conquistas.ts), nos três idiomas.
-- conquistas_obtidas: uma linha por conta e conquista, com a data.
--
-- Quem concede:
-- - o banco, quando o evento acontece no banco (gatilhos abaixo: combo compartilhado, deck salvo);
-- - o app, pela função registrar_conquista, só para as conquistas marcadas pelo_app (o evento
--   acontece só no aparelho, como abrir um arquétipo na aba Comunidade).
--
-- Para acrescentar uma conquista: uma linha em conquistas (aqui ou numa migração nova), o texto em
-- src/data/conquistas.ts e o evento que a concede (gatilho no banco ou conquistar() no app).
-- Pode rodar de novo sem problema (não duplica nada).

-- ---------------------------------------------------------------- catálogo

create table if not exists public.conquistas (
  id text primary key check (id ~ '^[a-z0-9_]{3,40}$'),
  -- como os troféus do PS5: bronze, prata, ouro, platina
  nivel text not null default 'bronze' check (nivel in ('bronze', 'prata', 'ouro', 'platina')),
  ordem integer not null,
  -- ícone: a arte (recorte quadrado) desta carta
  carta_id integer not null,
  -- o app pode registrar (evento que só o aparelho vê); senão, só o banco concede
  pelo_app boolean not null default false,
  -- secreta: nome e descrição escondidos até desbloquear
  secreta boolean not null default false,
  criada_em timestamptz not null default now()
);

alter table public.conquistas enable row level security;
drop policy if exists "conquistas: leitura pública" on public.conquistas;
create policy "conquistas: leitura pública" on public.conquistas for select using (true);
revoke insert, update, delete on public.conquistas from anon, authenticated;

insert into public.conquistas (id, nivel, ordem, carta_id, pelo_app) values
  ('compartilhar', 'bronze', 10, 90359458, false),        -- Top Share
  ('entrando_comunidade', 'bronze', 20, 712559, true),    -- Amazoness Village
  ('meu_primeiro_deck', 'bronze', 30, 12183332, true)     -- Card Shuffle
on conflict (id) do nothing;

-- ---------------------------------------------------------------- obtidas

create table if not exists public.conquistas_obtidas (
  usuario_id uuid not null references public.perfis (id) on delete cascade,
  conquista_id text not null references public.conquistas (id) on delete cascade,
  obtida_em timestamptz not null default now(),
  primary key (usuario_id, conquista_id)
);

alter table public.conquistas_obtidas enable row level security;
drop policy if exists "conquistas_obtidas: dono lê" on public.conquistas_obtidas;
create policy "conquistas_obtidas: dono lê" on public.conquistas_obtidas for select to authenticated
  using (usuario_id = auth.uid());
-- só o banco grava (gatilhos e registrar_conquista)
revoke insert, update, delete on public.conquistas_obtidas from anon, authenticated;

-- concede (uma vez por conta; a data que fica é a primeira)
create or replace function public.conceder_conquista(p_usuario uuid, p_conquista text, p_quando timestamptz default now())
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.conquistas_obtidas (usuario_id, conquista_id, obtida_em)
  values (p_usuario, p_conquista, least(coalesce(p_quando, now()), now()))
  on conflict (usuario_id, conquista_id) do update
    set obtida_em = least(public.conquistas_obtidas.obtida_em, excluded.obtida_em);
$$;
revoke execute on function public.conceder_conquista(uuid, text, timestamptz) from public, anon, authenticated;

-- o app registra uma conquista pelo_app da própria conta; `quando`: a data em que foi obtida no
-- aparelho (antes do login), nunca no futuro
create or replace function public.registrar_conquista(conquista text, quando timestamptz default now())
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  data_obtida timestamptz;
begin
  if uid is null then
    raise exception 'entre na conta para registrar conquistas';
  end if;
  if not exists (select 1 from public.conquistas c where c.id = conquista and c.pelo_app) then
    raise exception 'conquista % não pode ser registrada pelo app', conquista;
  end if;
  perform public.conceder_conquista(uid, conquista, quando);
  select o.obtida_em into data_obtida from public.conquistas_obtidas o where o.usuario_id = uid and o.conquista_id = conquista;
  return data_obtida;
end;
$$;
revoke execute on function public.registrar_conquista(text, timestamptz) from public, anon;
grant execute on function public.registrar_conquista(text, timestamptz) to authenticated;

-- raridade (como a Steam: % dos duelistas com conta que já obtiveram), sem expor quem obteve
create or replace function public.raridade_conquistas()
returns table (conquista_id text, obtidas integer, duelistas integer)
language sql
stable
security definer
set search_path = public
as $$
  select c.id,
         (select count(*) from public.conquistas_obtidas o where o.conquista_id = c.id)::integer,
         (select count(*) from public.perfis)::integer
  from public.conquistas c;
$$;
grant execute on function public.raridade_conquistas() to anon, authenticated;

-- ---------------------------------------------------------------- eventos do banco

-- "Compartilhar": o primeiro Combo da Comunidade compartilhado (criado já público ou tornado público)
create or replace function public.conquista_combo_compartilhado() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.origem = 'comunidade' and new.publico and new.autor_id is not null then
    perform public.conceder_conquista(new.autor_id, 'compartilhar');
  end if;
  return new;
end;
$$;
drop trigger if exists combos_conquista on public.combos;
create trigger combos_conquista after insert or update of publico on public.combos
  for each row execute function public.conquista_combo_compartilhado();

-- "Meu Primeiro Deck": o primeiro deck salvo na conta
create or replace function public.conquista_deck_salvo() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.conceder_conquista(new.dono_id, 'meu_primeiro_deck');
  return new;
end;
$$;
drop trigger if exists decks_conquista on public.decks;
create trigger decks_conquista after insert on public.decks
  for each row execute function public.conquista_deck_salvo();

-- ---------------------------------------------------------------- quem já tinha feito antes

insert into public.conquistas_obtidas (usuario_id, conquista_id, obtida_em)
select c.autor_id, 'compartilhar', min(c.criado_em)
from public.combos c
where c.origem = 'comunidade' and c.publico and c.autor_id is not null
group by c.autor_id
on conflict do nothing;

insert into public.conquistas_obtidas (usuario_id, conquista_id, obtida_em)
select d.dono_id, 'meu_primeiro_deck', min(d.criado_em)
from public.decks d
group by d.dono_id
on conflict do nothing;

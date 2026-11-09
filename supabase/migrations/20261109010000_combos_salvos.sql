-- Meus Combos: combos que cada jogador salvou (calculados pelo App, da Comunidade, de IA ou os
-- próprios), para abrir de novo rápido. Cada linha guarda uma cópia do combo (o combo do App não
-- tem id fixo: as linhas são recalculadas pelo pipeline). Sem login, ficam só no aparelho.
-- Pode rodar de novo sem problema (não duplica nada).

create table if not exists public.combos_salvos (
  usuario_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  -- id do combo na base, "app:<hash>" (linha calculada) ou "local:<id>" (combo só no aparelho)
  chave text not null check (char_length(chave) between 1 and 120),
  combo jsonb not null check (jsonb_typeof(combo) = 'object' and octet_length(combo::text) < 100000),
  salvo_em timestamptz not null default now(),
  primary key (usuario_id, chave)
);

alter table public.combos_salvos enable row level security;
drop policy if exists "combos_salvos: só o dono" on public.combos_salvos;
create policy "combos_salvos: só o dono" on public.combos_salvos for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
revoke all on public.combos_salvos from anon;

-- até 500 combos salvos por conta
create or replace function public.combos_salvos_limite() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.combos_salvos where usuario_id = new.usuario_id) >= 500 then
    raise exception 'limite de 500 combos salvos';
  end if;
  return new;
end;
$$;
drop trigger if exists combos_salvos_limite on public.combos_salvos;
create trigger combos_salvos_limite before insert on public.combos_salvos
  for each row execute function public.combos_salvos_limite();

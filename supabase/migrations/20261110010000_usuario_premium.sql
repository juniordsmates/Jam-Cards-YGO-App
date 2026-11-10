-- Usuário Premium: assinatura que libera recursos exclusivos (o primeiro previsto é o auxílio no
-- Simulador, indicando possibilidades de jogada). É uma marcação separada do nível (Padrão,
-- Avançado, Mentor): uma conta pode ser Padrão e Premium. Só o administrador marca ou desmarca.
-- Pode rodar de novo sem problema (não duplica nada).

alter table public.perfis add column if not exists premium boolean not null default false;
-- o usuário continua podendo mudar só o próprio nome (a coluna premium fica fora do grant)
revoke update on public.perfis from anon, authenticated;
grant update (usuario) on public.perfis to authenticated;

-- a conta aberta é Premium (o administrador tem todos os recursos)
create or replace function public.sou_premium() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.sou_admin() or exists (select 1 from public.perfis where id = auth.uid() and premium);
$$;
revoke all on function public.sou_premium() from public, anon;
grant execute on function public.sou_premium() to authenticated;

create or replace function public.admin_definir_premium(p_id uuid, p_premium boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.sou_admin() then
    raise exception 'Só o administrador define quem é Premium.';
  end if;
  update public.perfis set premium = coalesce(p_premium, false) where id = p_id;
  if not found then
    raise exception 'Usuário não encontrado.';
  end if;
end;
$$;
revoke all on function public.admin_definir_premium(uuid, boolean) from public, anon;
grant execute on function public.admin_definir_premium(uuid, boolean) to authenticated;

-- a lista do administrador passa a trazer a marcação Premium (o retorno muda: recria a função)
drop function if exists public.admin_listar_usuarios();
create function public.admin_listar_usuarios()
returns table (id uuid, usuario text, email text, nivel text, premium boolean, admin boolean, criado_em timestamptz, ultimo_acesso timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.sou_admin() then
    raise exception 'Só o administrador lista os usuários.';
  end if;
  return query
    select p.id, p.usuario, u.email::text, p.nivel, p.premium,
           exists (select 1 from public.admins a where a.usuario_id = p.id),
           p.criado_em, u.last_sign_in_at
    from public.perfis p
    join auth.users u on u.id = p.id
    order by p.criado_em;
end;
$$;
revoke all on function public.admin_listar_usuarios() from public, anon;
grant execute on function public.admin_listar_usuarios() to authenticated;

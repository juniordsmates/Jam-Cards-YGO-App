-- Níveis de usuário: Padrão, Avançado e Mentor. O administrador lista as contas e define o nível.
-- Avançado e Mentor têm todos os recursos; o Padrão não usa o Teste Avançado e os combos que ele
-- cria ficam só no aparelho (não vão para a tabela combos).

alter table public.perfis
  add column nivel text not null default 'padrao' check (nivel in ('padrao', 'avancado', 'mentor'));

-- o administrador já começa como Mentor
update public.perfis set nivel = 'mentor' where id in (select usuario_id from public.admins);

-- o dono continua podendo trocar só o nome de usuário (o nível é do administrador)
revoke update on public.perfis from anon, authenticated;
grant update (usuario) on public.perfis to authenticated;

-- recursos avançados: nível Avançado ou Mentor (ou administrador)
create function public.recursos_avancados() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.sou_admin()
    or exists (select 1 from public.perfis where id = auth.uid() and nivel in ('avancado', 'mentor'));
$$;
revoke all on function public.recursos_avancados() from public, anon;
grant execute on function public.recursos_avancados() to authenticated;

-- combos da comunidade só entram na base por usuários Avançado ou Mentor
-- (sugestões de IA continuam liberadas: são o registro das buscas)
drop policy "combos: usuário cria" on public.combos;
create policy "combos: usuário cria" on public.combos for insert to authenticated
  with check (autor_id = auth.uid() and (origem = 'ia' or (origem = 'comunidade' and public.recursos_avancados())));

-- ---------------------------------------------------------------- administrador

-- todas as contas, com e-mail e último acesso (só o administrador)
create function public.admin_listar_usuarios()
returns table (id uuid, usuario text, email text, nivel text, admin boolean, criado_em timestamptz, ultimo_acesso timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.sou_admin() then
    raise exception 'Só o administrador lista os usuários.';
  end if;
  return query
    select p.id, p.usuario, u.email::text, p.nivel,
           exists (select 1 from public.admins a where a.usuario_id = p.id),
           p.criado_em, u.last_sign_in_at
    from public.perfis p
    join auth.users u on u.id = p.id
    order by p.criado_em;
end;
$$;
revoke all on function public.admin_listar_usuarios() from public, anon;
grant execute on function public.admin_listar_usuarios() to authenticated;

create function public.admin_definir_nivel(p_id uuid, p_nivel text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.sou_admin() then
    raise exception 'Só o administrador define o nível dos usuários.';
  end if;
  if p_nivel not in ('padrao', 'avancado', 'mentor') then
    raise exception 'Nível inválido.';
  end if;
  update public.perfis set nivel = p_nivel where id = p_id;
  if not found then
    raise exception 'Usuário não encontrado.';
  end if;
end;
$$;
revoke all on function public.admin_definir_nivel(uuid, text) from public, anon;
grant execute on function public.admin_definir_nivel(uuid, text) to authenticated;

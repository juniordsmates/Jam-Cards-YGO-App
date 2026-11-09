-- Dono do app: só a conta dona torna outras contas administradoras (ou tira a administração).
-- A tabela admins continua sem escrita para anon e authenticated: tudo passa pela função abaixo.

alter table public.admins add column if not exists dono boolean not null default false;

-- a conta dona é a conta de administrador do autor do app (só uma conta que já está em admins vira dona,
-- então criar outra conta com o mesmo e-mail não dá acesso)
update public.admins a
  set dono = true
  from auth.users u
  where u.id = a.usuario_id and lower(u.email) = 'juniordsmates@icloud.com';

create or replace function public.sou_dono() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where usuario_id = auth.uid() and dono);
$$;
revoke all on function public.sou_dono() from public, anon;
grant execute on function public.sou_dono() to authenticated;

-- torna uma conta administradora (p_admin = true) ou tira a administração (false); só o dono,
-- e nunca na própria conta (o dono não perde o acesso por engano)
create or replace function public.dono_definir_admin(p_id uuid, p_admin boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.sou_dono() then
    raise exception 'Só o dono do app define administradores.';
  end if;
  if p_id = auth.uid() then
    raise exception 'O dono não muda a própria conta.';
  end if;
  if not exists (select 1 from public.perfis where id = p_id) then
    raise exception 'Usuário não encontrado.';
  end if;
  if p_admin then
    insert into public.admins (usuario_id) values (p_id) on conflict (usuario_id) do nothing;
  else
    delete from public.admins where usuario_id = p_id and not dono;
  end if;
end;
$$;
revoke all on function public.dono_definir_admin(uuid, boolean) from public, anon;
grant execute on function public.dono_definir_admin(uuid, boolean) to authenticated;

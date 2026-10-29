-- 1. Várias IAs por usuário: uma configuração por provedor (antes, uma só por usuário).
-- 2. Cadastro de usuários só pelo administrador: o cadastro público (por e-mail) fica bloqueado no
--    banco e o administrador cria contas pela função admin_criar_usuario (usuário, e-mail e senha).

-- ---------------------------------------------------------------- 1. IAs por provedor

alter table public.config_ia drop constraint config_ia_pkey;
alter table public.config_ia add primary key (usuario_id, provedor);

-- ---------------------------------------------------------------- 2. cadastro só pelo administrador

-- toda conta nova passa por admin_criar_usuario, que liga esta marca só durante a própria transação
create function public.bloquear_cadastro_publico() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('jam.cadastro_admin', true), '') <> 'sim' then
    raise exception 'Cadastro de novos usuários desativado: as contas são criadas pelo administrador.';
  end if;
  return new;
end;
$$;

create trigger bloquear_cadastro_publico before insert on auth.users
  for each row execute function public.bloquear_cadastro_publico();

-- conta já confirmada (o administrador informa o e-mail); o perfil (nome de usuário) é criado pelo
-- gatilho ao_criar_usuario, a partir de raw_user_meta_data.usuario
create function public.admin_criar_usuario(p_usuario text, p_email text, p_senha text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  novo uuid := gen_random_uuid();
  nome text := lower(trim(p_usuario));
  mail text := lower(trim(p_email));
begin
  if not public.sou_admin() then
    raise exception 'Só o administrador cadastra usuários.';
  end if;
  if nome !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Usuário: 3 a 20 letras minúsculas, números ou _.';
  end if;
  if mail !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'E-mail inválido.';
  end if;
  if char_length(coalesce(p_senha, '')) < 8 then
    raise exception 'A senha precisa ter pelo menos 8 caracteres.';
  end if;
  if exists (select 1 from public.perfis where usuario = nome) then
    raise exception 'Este nome de usuário já está em uso.';
  end if;
  if exists (select 1 from auth.users where lower(email) = mail) then
    raise exception 'Já existe uma conta com este e-mail.';
  end if;

  perform set_config('jam.cadastro_admin', 'sim', true);
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, reauthentication_token, phone_change, phone_change_token
  ) values (
    '00000000-0000-0000-0000-000000000000', novo, 'authenticated', 'authenticated', mail,
    extensions.crypt(p_senha, extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}', jsonb_build_object('usuario', nome, 'email_verified', true), now(), now(),
    '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (novo::text, novo, jsonb_build_object('sub', novo::text, 'email', mail, 'email_verified', true), 'email', now(), now(), now());
  perform set_config('jam.cadastro_admin', '', true);
  return novo;
end;
$$;

revoke all on function public.admin_criar_usuario(text, text, text) from public, anon;
grant execute on function public.admin_criar_usuario(text, text, text) to authenticated;

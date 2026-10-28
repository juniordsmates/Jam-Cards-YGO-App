-- Administração (botão "Recalcular Ações") e configuração de IA guardada na conta.

-- ---------------------------------------------------------------- administradores

-- pelo id da conta (não pelo e-mail: sem confirmação de e-mail, alguém poderia criar conta com ele)
create table public.admins (
  usuario_id uuid primary key references public.perfis (id) on delete cascade
);

alter table public.admins enable row level security;
create policy "admins: a própria linha" on public.admins for select using (usuario_id = auth.uid());
revoke insert, update, delete on public.admins from anon, authenticated;

create function public.sou_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where usuario_id = auth.uid());
$$;
grant execute on function public.sou_admin() to authenticated;

-- ---------------------------------------------------------------- recálculos

-- cada pedido dispara a Action "Atualizar base" do Database-Cards-Ygo pela API do GitHub;
-- o token fica no cofre do Supabase (Vault, segredo "github_token") e nunca chega ao app
create extension if not exists pg_net;

create table public.recalculos (
  id uuid primary key default gen_random_uuid(),
  solicitado_por uuid default auth.uid() references public.perfis (id) on delete set null,
  tipo text not null check (tipo in ('combos', 'respostas', 'tudo')),
  forcar boolean not null default false,
  status text not null default 'solicitado',
  criado_em timestamptz not null default now()
);

alter table public.recalculos enable row level security;
create policy "recalculos: admins veem" on public.recalculos for select using (public.sou_admin());
create policy "recalculos: admins pedem" on public.recalculos for insert to authenticated
  with check (public.sou_admin() and solicitado_por = auth.uid());
revoke insert, update, delete on public.recalculos from anon, authenticated;
grant insert (tipo, forcar) on public.recalculos to authenticated;

create function public.disparar_recalculo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  token text;
begin
  -- nome sem diferenciar maiúsculas (ex.: GitHub_token)
  select decrypted_secret into token from vault.decrypted_secrets where lower(name) = 'github_token' limit 1;
  if token is null then
    new.status := 'sem token do GitHub no cofre';
    return new;
  end if;
  perform net.http_post(
    url := 'https://api.github.com/repos/juniordsmates/Database-Cards-Ygo/actions/workflows/atualizar-base.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || token,
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'cartas-app'
    ),
    body := jsonb_build_object('ref', 'main', 'inputs', jsonb_build_object('tipo', new.tipo, 'forcar', new.forcar::text))
  );
  new.status := 'enviado ao GitHub';
  return new;
end;
$$;

create trigger recalculos_disparar before insert on public.recalculos
  for each row execute function public.disparar_recalculo();

-- ---------------------------------------------------------------- configuração de IA na conta

-- opcional (o usuário escolhe guardar): para usar a mesma IA em outros computadores
create table public.config_ia (
  usuario_id uuid primary key default auth.uid() references public.perfis (id) on delete cascade,
  provedor text not null check (char_length(provedor) <= 30),
  modelo text not null default '' check (char_length(modelo) <= 120),
  url text not null default '' check (char_length(url) <= 300),
  chave text not null default '' check (char_length(chave) <= 400),
  atualizado_em timestamptz not null default now()
);

alter table public.config_ia enable row level security;
create policy "config_ia: só o dono" on public.config_ia for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
revoke all on public.config_ia from anon;

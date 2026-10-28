-- Guarda o número da requisição ao GitHub de cada recálculo e expõe a resposta (status HTTP),
-- para o app mostrar se a Action foi mesmo iniciada (204) ou por que falhou.

alter table public.recalculos add column requisicao bigint;

create or replace function public.disparar_recalculo() returns trigger
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
  new.requisicao := net.http_post(
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

-- últimos pedidos com a resposta do GitHub (só administradores)
create function public.meus_recalculos()
returns table (id uuid, tipo text, forcar boolean, status text, criado_em timestamptz, http integer, resposta text)
language sql stable security definer set search_path = '' as $$
  select r.id, r.tipo, r.forcar, r.status, r.criado_em, h.status_code, left(coalesce(h.content::text, h.error_msg), 300)
  from public.recalculos r
  left join net._http_response h on h.id = r.requisicao
  where public.sou_admin()
  order by r.criado_em desc
  limit 5;
$$;
grant execute on function public.meus_recalculos() to authenticated;

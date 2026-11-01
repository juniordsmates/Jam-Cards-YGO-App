-- Camada de dados (combos calculados, metagame, respostas, tags revisadas) fora do repositório
-- público: fica num bucket privado do Storage. O app lê com a chave pública dele (não há link
-- aberto para robôs); só o administrador (pela tela Minha conta) e o pipeline (chave de serviço)
-- gravam. Arquivos: camada.json (completa) e versao.json ({ "geradoEm": … }, para o app só baixar
-- a camada quando ela muda).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('camada', 'camada', false, 52428800, array['application/json'])
on conflict (id) do update set public = false;

-- ler: o app (com ou sem login)
create policy "camada: o app lê" on storage.objects for select to anon, authenticated
  using (bucket_id = 'camada');
-- gravar e trocar: só o administrador (o pipeline usa a chave de serviço, que não passa pelas regras)
create policy "camada: administrador envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'camada' and public.sou_admin());
create policy "camada: administrador troca" on storage.objects for update to authenticated
  using (bucket_id = 'camada' and public.sou_admin())
  with check (bucket_id = 'camada' and public.sou_admin());
create policy "camada: administrador apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'camada' and public.sou_admin());

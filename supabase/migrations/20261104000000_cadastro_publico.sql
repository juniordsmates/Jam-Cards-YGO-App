-- Cadastro de novos usuários liberado de novo (pedido do dono do app em 2026-11-04): qualquer pessoa
-- cria a conta pelo app (nome de usuário, e-mail e senha). Desfaz o bloqueio da migração
-- 20261029010000; o administrador continua podendo criar contas já confirmadas (admin_criar_usuario).
-- O perfil (nome de usuário) segue criado pelo gatilho ao_criar_usuario, a partir do cadastro.

drop trigger if exists bloquear_cadastro_publico on auth.users;
drop function if exists public.bloquear_cadastro_publico();

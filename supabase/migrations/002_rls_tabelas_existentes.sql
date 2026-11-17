-- =============================================================================
-- 002_rls_tabelas_existentes.sql  —  Fechar acesso às tabelas nominais
-- -----------------------------------------------------------------------------
-- ⚠️  NÃO RODE AGORA.  Executar somente na FASE 7, depois que o código da V1/V2
--     estiver atualizado (o app atual ainda lê algumas tabelas sem login).
--
-- Hoje essas tabelas podem ser lidas por QUALQUER pessoa que tenha a chave
-- pública (anon) — que vai embutida no site. Este script restringe:
--   • tabelas nominais  → apenas usuários com acesso_v1 = true (logados)
--   • setores_unidades  → leitura para logados; alteração só Administrador
--   • usuarios_perfis   → cada um lê o próprio perfil; gestão lê todos
-- Pré-requisito: 001_rundown_v2.sql já executado.
-- =============================================================================
begin;

-- Tabelas nominais (V1)
do $$
declare t text;
begin
  foreach t in array array['colaboradores','escalas_mensais','planejamento_turnos','plantao_diario']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists v1_all on public.%I', t);
    execute format('create policy v1_all on public.%I for all to authenticated
                      using (public.tem_acesso_v1()) with check (public.tem_acesso_v1())', t);
  end loop;
end $$;

-- setores_unidades
alter table public.setores_unidades enable row level security;
drop policy if exists su_select on public.setores_unidades;
drop policy if exists su_write  on public.setores_unidades;
create policy su_select on public.setores_unidades for select to authenticated using (true);
create policy su_write  on public.setores_unidades for update to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

-- usuarios_perfis (escrita apenas pelo painel do Supabase / script admin)
alter table public.usuarios_perfis enable row level security;
drop policy if exists up_select on public.usuarios_perfis;
create policy up_select on public.usuarios_perfis for select to authenticated
  using (id = auth.uid() or public.eh_gestor_global());

commit;

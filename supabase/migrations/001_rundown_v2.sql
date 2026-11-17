-- =============================================================================
-- 001_rundown_v2.sql  —  Módulo Rundown (V2 · Quantitativo)
-- -----------------------------------------------------------------------------
-- SEGURO PARA RODAR AGORA: apenas ADICIONA colunas, tabelas, funções e políticas.
-- Nenhuma tabela/coluna existente é removida ou alterada em seu conteúdo
-- (exceto marcar os perfis atuais com acesso_v1 / acesso_v2).
-- Pode ser executado mais de uma vez (idempotente).
-- Onde rodar: Supabase → SQL Editor → New query → colar tudo → Run.
-- =============================================================================
begin;

-- -----------------------------------------------------------------------------
-- 1. Novas colunas em tabelas existentes
-- -----------------------------------------------------------------------------
alter table public.setores_unidades
  add column if not exists leitos_operacionais integer not null default 0,
  add column if not exists login_email        text unique;

alter table public.usuarios_perfis
  add column if not exists nome       text,
  add column if not exists unidade_id uuid references public.setores_unidades(id),
  add column if not exists acesso_v1  boolean not null default false,  -- V1 · Demo nominal
  add column if not exists acesso_v2  boolean not null default false;  -- V2 · Rundown

-- Perfis atuais (contas de teste) continuam entrando na V1
update public.usuarios_perfis set acesso_v1 = true where acesso_v1 = false;
-- Gestão e supervisão também entram na V2
update public.usuarios_perfis
   set acesso_v2 = true
 where role in ('Administrador','Diretor','Supervisão','Supervisão Plantonista');

-- -----------------------------------------------------------------------------
-- 2. Funções auxiliares para as políticas (RLS)
-- -----------------------------------------------------------------------------
-- Todas exigem acesso_v2 = true: a conta de demonstração (V1) não consegue
-- gravar nos dados reais do Rundown, mesmo sendo "Administrador" na demo.
create or replace function public.eh_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.usuarios_perfis
                  where id = auth.uid() and acesso_v2 and role in ('Administrador'));
$$;

create or replace function public.eh_gestor_global()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.usuarios_perfis
                  where id = auth.uid() and acesso_v2
                    and role in ('Administrador','Diretor','Supervisão','Supervisão Plantonista'));
$$;

create or replace function public.minha_unidade()
returns uuid language sql stable security definer set search_path = public as $$
  select unidade_id from public.usuarios_perfis where id = auth.uid() and acesso_v2;
$$;

create or replace function public.tem_acesso_v1()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select acesso_v1 from public.usuarios_perfis where id = auth.uid()), false);
$$;

create or replace function public.hoje_sp()
returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- -----------------------------------------------------------------------------
-- 3. Tabelas do Rundown
-- -----------------------------------------------------------------------------

-- 3.1 Registro por setor / data / turno (Manhã 6h, Tarde 6h, Noite 12h)
create table if not exists public.rundown_registro (
  id               bigint generated always as identity primary key,
  setor_id         uuid not null references public.setores_unidades(id),
  setor_nome       text not null,                       -- snapshot do nome
  data_plantao     date not null,
  turno            text not null check (turno in ('MANHA','TARDE','NOITE')),
  equipe_noite     text check (equipe_noite in ('PAR','IMPAR')),
  -- {"ENF":{"escalados":0,"faltas":{"fnj":0,"atestado":0,"outras":0},"recebidos":0,"cedidos":0},
  --  "TEC":{...}}   (somente profissionais de 6h; Diurno 12h fica em rundown_diurno12)
  quadro           jsonb not null default '{}'::jsonb,
  leitos_totais    integer not null default 0,
  ocupados         integer not null default 0 check (ocupados   >= 0),
  bloqueados       integer not null default 0 check (bloqueados >= 0),
  alertas          jsonb not null default '[]'::jsonb,  -- apenas número de leito
  responsavel_nome text not null,                       -- digitado pela unidade
  editado_por_nome text,
  origem           text not null default 'MANUAL' check (origem in ('MANUAL','NOMINAL')),
  criado_por       uuid default auth.uid(),
  created_at       timestamptz not null default now(),
  editado_em       timestamptz,
  unique (setor_id, data_plantao, turno)
);

-- 3.2 Diurno 12h: lançado uma vez por dia, soma em Manhã E Tarde
create table if not exists public.rundown_diurno12 (
  setor_id         uuid not null references public.setores_unidades(id),
  data_plantao     date not null,
  quadro           jsonb not null default '{}'::jsonb,  -- mesmo formato do quadro acima
  responsavel_nome text not null,
  editado_por_nome text,
  created_at       timestamptz not null default now(),
  editado_em       timestamptz,
  primary key (setor_id, data_plantao)
);

-- 3.3 Afastamentos previstos (projetam nos dias seguintes) — sem nomes
create table if not exists public.rundown_afastamentos (
  id               bigint generated always as identity primary key,
  setor_id         uuid not null references public.setores_unidades(id),
  categoria        text not null check (categoria in ('ENF','TEC')),
  turno            text not null check (turno in ('MANHA','TARDE','NOITE','DIURNO12')),
  tipo             text not null,   -- Atestado, Licença médica/INSS, Licença maternidade, Férias, RTC, Outros
  quantidade       integer not null check (quantidade > 0),
  inicio           date not null,
  retorno_previsto date not null,
  responsavel_nome text not null,
  created_at       timestamptz not null default now(),
  editado_em       timestamptz,
  check (retorno_previsto >= inicio)
);
create index if not exists idx_rundown_afast_periodo
  on public.rundown_afastamentos (setor_id, inicio, retorno_previsto);

-- 3.4 Necessários (quadro mínimo) — somente Administrador altera
create table if not exists public.dimensionamento_setor (
  setor_id   uuid not null references public.setores_unidades(id),
  turno      text not null check (turno in ('MANHA','TARDE','NOITE')),
  categoria  text not null check (categoria in ('ENF','TEC')),
  minimo     integer not null default 0 check (minimo >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (setor_id, turno, categoria)
);

-- -----------------------------------------------------------------------------
-- 4. Segurança (RLS) das tabelas NOVAS
--    Unidade: só lê/grava a própria unidade; edita apenas dias >= hoje.
--    Supervisão/Gestão: lê e grava todas.  Ninguém apaga pelo app.
-- -----------------------------------------------------------------------------
alter table public.rundown_registro      enable row level security;
alter table public.rundown_diurno12      enable row level security;
alter table public.rundown_afastamentos  enable row level security;
alter table public.dimensionamento_setor enable row level security;

-- rundown_registro
drop policy if exists rr_select on public.rundown_registro;
drop policy if exists rr_insert on public.rundown_registro;
drop policy if exists rr_update on public.rundown_registro;
create policy rr_select on public.rundown_registro for select to authenticated
  using (public.eh_gestor_global() or setor_id = public.minha_unidade());
create policy rr_insert on public.rundown_registro for insert to authenticated
  with check (public.eh_gestor_global()
              or (setor_id = public.minha_unidade() and data_plantao >= public.hoje_sp() - 1));
create policy rr_update on public.rundown_registro for update to authenticated
  using      (public.eh_gestor_global() or (setor_id = public.minha_unidade() and data_plantao >= public.hoje_sp() - 1))
  with check (public.eh_gestor_global() or (setor_id = public.minha_unidade() and data_plantao >= public.hoje_sp() - 1));
-- obs.: "hoje - 1" permite fechar o plantão noturno que vira a meia-noite.

-- rundown_diurno12
drop policy if exists rd_select on public.rundown_diurno12;
drop policy if exists rd_insert on public.rundown_diurno12;
drop policy if exists rd_update on public.rundown_diurno12;
create policy rd_select on public.rundown_diurno12 for select to authenticated
  using (public.eh_gestor_global() or setor_id = public.minha_unidade());
create policy rd_insert on public.rundown_diurno12 for insert to authenticated
  with check (public.eh_gestor_global() or (setor_id = public.minha_unidade() and data_plantao >= public.hoje_sp()));
create policy rd_update on public.rundown_diurno12 for update to authenticated
  using      (public.eh_gestor_global() or (setor_id = public.minha_unidade() and data_plantao >= public.hoje_sp()))
  with check (public.eh_gestor_global() or (setor_id = public.minha_unidade() and data_plantao >= public.hoje_sp()));

-- rundown_afastamentos (unidade pode corrigir retorno previsto)
drop policy if exists ra_select on public.rundown_afastamentos;
drop policy if exists ra_insert on public.rundown_afastamentos;
drop policy if exists ra_update on public.rundown_afastamentos;
create policy ra_select on public.rundown_afastamentos for select to authenticated
  using (public.eh_gestor_global() or setor_id = public.minha_unidade());
create policy ra_insert on public.rundown_afastamentos for insert to authenticated
  with check (public.eh_gestor_global() or setor_id = public.minha_unidade());
create policy ra_update on public.rundown_afastamentos for update to authenticated
  using      (public.eh_gestor_global() or setor_id = public.minha_unidade())
  with check (public.eh_gestor_global() or setor_id = public.minha_unidade());

-- dimensionamento_setor
drop policy if exists ds_select on public.dimensionamento_setor;
drop policy if exists ds_write  on public.dimensionamento_setor;
create policy ds_select on public.dimensionamento_setor for select to authenticated using (true);
create policy ds_write  on public.dimensionamento_setor for all    to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

-- -----------------------------------------------------------------------------
-- 5. Lista de unidades para a tela de login da V2 (antes de autenticar)
--    Expõe apenas nome e e-mail técnico de login (sem senha, sem dados pessoais).
-- -----------------------------------------------------------------------------
create or replace view public.unidades_login as
  select id, nome_oficial, login_email
    from public.setores_unidades
   where upper(coalesce(status,'')) = 'ATIVO'
     and login_email is not null;

grant select on public.unidades_login to anon, authenticated;

commit;

-- Conferência rápida (rode separado, se quiser):
-- select table_name from information_schema.tables where table_schema='public' and table_name like 'rundown%';

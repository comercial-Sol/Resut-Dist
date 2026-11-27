-- PORTAL RADIS SOLAR - SCHEMA CONSOLIDADO
-- Execute no Supabase SQL Editor. Seguro para reexecução em tabelas existentes.
create extension if not exists pgcrypto;

create table if not exists public.distribuidores (
  cnpj_raiz varchar(8) primary key,
  nome text not null,
  uf varchar(2),
  cod_sap varchar(20),
  possui_equipe_3_pessoas boolean not null default false,
  metas_mensais jsonb not null default '{}'::jsonb
);

create table if not exists public.usuarios_acesso (
  email text primary key,
  nome text,
  cargo text,
  perfil text not null check (perfil in ('admin','distribuidor')),
  cnpj_raiz varchar(8) references public.distribuidores(cnpj_raiz) on delete cascade,
  criado_em timestamptz not null default now(),
  constraint usuarios_acesso_perfil_cnpj_ck
    check ((perfil = 'admin' and cnpj_raiz is null) or (perfil = 'distribuidor' and cnpj_raiz is not null))
);

alter table public.usuarios_acesso add column if not exists cargo text;

create table if not exists public.projetos_pag_fat (
  codigo_projeto text primary key,
  cnpj_raiz varchar(8) references public.distribuidores(cnpj_raiz),
  cnpj_filial varchar(14),
  nome_distribuidor text,
  pedido_erp text,
  etapa_venda text,
  status_pagamento text,
  potencia_gerador numeric not null default 0,
  potencia_inversor numeric not null default 0,
  data_criacao timestamptz,
  data_pagamento date,
  data_emissao_nf date,
  numero_nf text,
  valor_produtos_desconto numeric not null default 0,
  valor_servico numeric not null default 0,
  valor_total numeric not null default 0,
  percentual_comissao numeric not null default 0,
  forma_pagamento text,
  parcelas integer not null default 1,
  pagamentos jsonb not null default '[]'::jsonb,
  componentes jsonb not null default '[]'::jsonb,
  kwp_produtos numeric not null default 0,
  kwp_servicos numeric not null default 0,
  kwp_projeto numeric not null default 0,
  fator_perdas numeric,
  tensao_local text,
  fase_local text,
  simultaneidade numeric,
  preco_kwh numeric,
  executivo_vendas text,
  cliente_nome text,
  cliente_cidade text,
  cliente_uf varchar(2),
  revenda_cnpj varchar(14),
  revenda_nome text,
  revenda_classificacao text,
  mes_referencia varchar(7),
  dados_origem jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.projetos_funil (
  codigo_projeto text primary key,
  cnpj_raiz varchar(8) references public.distribuidores(cnpj_raiz),
  cnpj_filial varchar(14),
  etapa_venda text,
  status_pagamento text,
  potencia_gerador numeric not null default 0,
  data_criacao timestamptz,
  data_expiracao timestamptz,
  valor_produtos_desconto numeric not null default 0,
  valor_total numeric not null default 0,
  executivo_vendas text,
  revenda_cnpj varchar(14),
  revenda_nome text,
  revenda_classificacao text,
  cliente_proposta text,
  email_proposta text,
  mes_criacao varchar(7),
  dados_origem jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

alter table public.projetos_funil add column if not exists status_pagamento text;
alter table public.projetos_funil add column if not exists dados_origem jsonb not null default '{}'::jsonb;
alter table public.projetos_pag_fat add column if not exists pagamentos jsonb not null default '[]'::jsonb;
alter table public.projetos_pag_fat add column if not exists componentes jsonb not null default '[]'::jsonb;
alter table public.projetos_pag_fat add column if not exists dados_origem jsonb not null default '{}'::jsonb;
alter table public.projetos_pag_fat add column if not exists potencia_inversor numeric not null default 0;
alter table public.projetos_pag_fat add column if not exists kwp_produtos numeric not null default 0;
alter table public.projetos_pag_fat add column if not exists kwp_servicos numeric not null default 0;
alter table public.projetos_pag_fat add column if not exists kwp_projeto numeric not null default 0;
alter table public.projetos_pag_fat add column if not exists fator_perdas numeric;
alter table public.projetos_pag_fat add column if not exists tensao_local text;
alter table public.projetos_pag_fat add column if not exists fase_local text;
alter table public.projetos_pag_fat add column if not exists simultaneidade numeric;
alter table public.projetos_pag_fat add column if not exists preco_kwh numeric;
alter table public.projetos_pag_fat add column if not exists atualizado_em timestamptz not null default now();
alter table public.projetos_funil add column if not exists atualizado_em timestamptz not null default now();

create table if not exists public.revendas_crm (
  id uuid primary key default gen_random_uuid(),
  cnpj_raiz varchar(8) references public.distribuidores(cnpj_raiz) on delete cascade,
  revenda_cnpj varchar(14) not null,
  data_ultimo_contato date,
  observacoes text,
  atualizado_por text,
  atualizado_em timestamptz not null default now(),
  unique(cnpj_raiz, revenda_cnpj)
);

create table if not exists public.importacoes_log (
  id uuid primary key default gen_random_uuid(),
  tipo_base text not null check (tipo_base in ('PAG_FAT','CRIADAS')),
  arquivo_nome text,
  total_registros integer,
  data_referencia date,
  importado_por text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_pag_fat_cnpj_raiz on public.projetos_pag_fat(cnpj_raiz);
create index if not exists idx_pag_fat_mes on public.projetos_pag_fat(mes_referencia);
create index if not exists idx_pag_fat_data_nf on public.projetos_pag_fat(data_emissao_nf);
create index if not exists idx_pag_fat_status on public.projetos_pag_fat(status_pagamento);
create index if not exists idx_funil_cnpj_raiz on public.projetos_funil(cnpj_raiz);
create index if not exists idx_funil_mes on public.projetos_funil(mes_criacao);
create index if not exists idx_funil_etapa on public.projetos_funil(etapa_venda);
create index if not exists idx_crm_cnpj_raiz on public.revendas_crm(cnpj_raiz);

-- RLS
alter table public.distribuidores enable row level security;
alter table public.usuarios_acesso enable row level security;
alter table public.projetos_pag_fat enable row level security;
alter table public.projetos_funil enable row level security;
alter table public.revendas_crm enable row level security;
alter table public.importacoes_log enable row level security;

-- SECURITY DEFINER evita recursão da política de usuarios_acesso.
-- search_path fixo evita resolução de objetos em schemas não confiáveis.
create or replace function public.get_user_access()
returns table(perfil text, cnpj_raiz varchar)
language sql
stable
security definer
set search_path = ''
as $$
  select ua.perfil, ua.cnpj_raiz
  from public.usuarios_acesso ua
  where lower(ua.email) = lower(auth.jwt() ->> 'email')
  limit 1;
$$;

revoke all on function public.get_user_access() from public;
grant execute on function public.get_user_access() to authenticated;

-- Remover políticas anteriores para que o script possa ser executado novamente.
drop policy if exists "Leitura usuarios_acesso" on public.usuarios_acesso;
drop policy if exists "Acesso distribuidores" on public.distribuidores;
drop policy if exists "Acesso pag_fat" on public.projetos_pag_fat;
drop policy if exists "Acesso funil" on public.projetos_funil;
drop policy if exists "Acesso crm" on public.revendas_crm;
drop policy if exists "Admin gerencia usuarios_acesso" on public.usuarios_acesso;
drop policy if exists "Permitir usuario ler proprio acesso" on public.usuarios_acesso;
drop policy if exists "Leitura distribuidores" on public.distribuidores;
drop policy if exists "Admin gerencia distribuidores" on public.distribuidores;
drop policy if exists "Leitura projetos_pag_fat" on public.projetos_pag_fat;
drop policy if exists "Admin gerencia projetos_pag_fat" on public.projetos_pag_fat;
drop policy if exists "Leitura projetos_funil" on public.projetos_funil;
drop policy if exists "Admin gerencia projetos_funil" on public.projetos_funil;
drop policy if exists "Acesso revendas_crm" on public.revendas_crm;
drop policy if exists "Leitura importacoes_log" on public.importacoes_log;
drop policy if exists "Admin insere importacoes_log" on public.importacoes_log;

create policy "Leitura usuarios_acesso" on public.usuarios_acesso
for select to authenticated
using (
  lower(email) = lower(auth.jwt() ->> 'email')
  or exists (select 1 from public.get_user_access() u where u.perfil = 'admin')
);
create policy "Admin gerencia usuarios_acesso" on public.usuarios_acesso
for all to authenticated
using (exists (select 1 from public.get_user_access() u where u.perfil = 'admin'))
with check (exists (select 1 from public.get_user_access() u where u.perfil = 'admin'));

create policy "Leitura distribuidores" on public.distribuidores
for select to authenticated
using (exists (select 1 from public.get_user_access() u where u.perfil = 'admin' or u.cnpj_raiz = distribuidores.cnpj_raiz));
create policy "Admin gerencia distribuidores" on public.distribuidores
for all to authenticated
using (exists (select 1 from public.get_user_access() u where u.perfil = 'admin'))
with check (exists (select 1 from public.get_user_access() u where u.perfil = 'admin'));

create policy "Leitura projetos_pag_fat" on public.projetos_pag_fat
for select to authenticated
using (exists (select 1 from public.get_user_access() u where u.perfil = 'admin' or u.cnpj_raiz = projetos_pag_fat.cnpj_raiz));
create policy "Admin gerencia projetos_pag_fat" on public.projetos_pag_fat
for all to authenticated
using (exists (select 1 from public.get_user_access() u where u.perfil = 'admin'))
with check (exists (select 1 from public.get_user_access() u where u.perfil = 'admin'));

create policy "Leitura projetos_funil" on public.projetos_funil
for select to authenticated
using (exists (select 1 from public.get_user_access() u where u.perfil = 'admin' or u.cnpj_raiz = projetos_funil.cnpj_raiz));
create policy "Admin gerencia projetos_funil" on public.projetos_funil
for all to authenticated
using (exists (select 1 from public.get_user_access() u where u.perfil = 'admin'))
with check (exists (select 1 from public.get_user_access() u where u.perfil = 'admin'));

create policy "Acesso revendas_crm" on public.revendas_crm
for all to authenticated
using (exists (select 1 from public.get_user_access() u where u.perfil = 'admin' or u.cnpj_raiz = revendas_crm.cnpj_raiz))
with check (exists (select 1 from public.get_user_access() u where u.perfil = 'admin' or u.cnpj_raiz = revendas_crm.cnpj_raiz));

create policy "Leitura importacoes_log" on public.importacoes_log
for select to authenticated
using (exists (select 1 from public.get_user_access() u where u.perfil = 'admin'));
create policy "Admin insere importacoes_log" on public.importacoes_log
for insert to authenticated
with check (exists (select 1 from public.get_user_access() u where u.perfil = 'admin'));

-- Permissões de API; RLS continua sendo a barreira de acesso às linhas.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.distribuidores to authenticated;
grant select, insert, update, delete on public.usuarios_acesso to authenticated;
grant select, insert, update, delete on public.projetos_pag_fat to authenticated;
grant select, insert, update, delete on public.projetos_funil to authenticated;
grant select, insert, update, delete on public.revendas_crm to authenticated;
grant select, insert on public.importacoes_log to authenticated;
grant all on all sequences in schema public to authenticated;


-- SECURITY HARDENING (mirrored in supabase/migrations; data-preserving).
-- RADIS Solar security hardening. Preserves all business rows.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE TABLE IF NOT EXISTS private.distribuidor_cnpj_links (
  cnpj_raiz_a varchar(8) NOT NULL REFERENCES public.distribuidores(cnpj_raiz),
  cnpj_raiz_b varchar(8) NOT NULL REFERENCES public.distribuidores(cnpj_raiz),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT distribuidor_cnpj_links_pk PRIMARY KEY (cnpj_raiz_a, cnpj_raiz_b),
  CONSTRAINT distribuidor_cnpj_links_order_ck CHECK (cnpj_raiz_a < cnpj_raiz_b)
);
ALTER TABLE private.distribuidor_cnpj_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.distribuidor_cnpj_links FROM PUBLIC, anon, authenticated;

-- Seed the explicitly approved CNPJ relationship after distributor roots exist.
CREATE OR REPLACE FUNCTION private.get_user_access()
RETURNS TABLE(perfil text, cnpj_raiz varchar)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT ua.perfil, ua.cnpj_raiz
  FROM public.usuarios_acesso ua
  WHERE lower(ua.email) = lower(auth.jwt() ->> 'email') AND ua.perfil = 'admin'
  UNION
  SELECT ua.perfil, ua.cnpj_raiz
  FROM public.usuarios_acesso ua
  WHERE lower(ua.email) = lower(auth.jwt() ->> 'email') AND ua.perfil = 'distribuidor'
  UNION
  SELECT ua.perfil,
         CASE WHEN ua.cnpj_raiz = links.cnpj_raiz_a
              THEN links.cnpj_raiz_b ELSE links.cnpj_raiz_a END::varchar
  FROM public.usuarios_acesso ua
  JOIN private.distribuidor_cnpj_links links
    ON links.ativo AND ua.cnpj_raiz IN (links.cnpj_raiz_a, links.cnpj_raiz_b)
  WHERE lower(ua.email) = lower(auth.jwt() ->> 'email') AND ua.perfil = 'distribuidor';
$function$;

REVOKE ALL ON FUNCTION private.get_user_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.get_user_access() TO authenticated;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('distribuidores','usuarios_acesso','projetos_pag_fat','projetos_funil','revendas_crm','importacoes_log','solicitacoes_acesso')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END
$$;

CREATE POLICY usuarios_acesso_select ON public.usuarios_acesso
FOR SELECT TO authenticated
USING (lower(email) = lower(auth.jwt() ->> 'email')
  OR EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));
CREATE POLICY usuarios_acesso_insert_admin ON public.usuarios_acesso
FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));
CREATE POLICY usuarios_acesso_update_admin ON public.usuarios_acesso
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));

CREATE POLICY distribuidores_select_scoped ON public.distribuidores
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM private.get_user_access() u
  WHERE u.perfil = 'admin' OR u.cnpj_raiz = distribuidores.cnpj_raiz));
CREATE POLICY distribuidores_insert_admin ON public.distribuidores
FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));
CREATE POLICY distribuidores_update_admin ON public.distribuidores
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));

CREATE POLICY projetos_pag_fat_select_scoped ON public.projetos_pag_fat
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM private.get_user_access() u
  WHERE u.perfil = 'admin' OR u.cnpj_raiz = projetos_pag_fat.cnpj_raiz));
CREATE POLICY projetos_pag_fat_insert_admin ON public.projetos_pag_fat
FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));
CREATE POLICY projetos_pag_fat_update_admin ON public.projetos_pag_fat
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));

CREATE POLICY projetos_funil_select_scoped ON public.projetos_funil
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM private.get_user_access() u
  WHERE u.perfil = 'admin' OR u.cnpj_raiz = projetos_funil.cnpj_raiz));
CREATE POLICY projetos_funil_insert_admin ON public.projetos_funil
FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));
CREATE POLICY projetos_funil_update_admin ON public.projetos_funil
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));

CREATE POLICY revendas_crm_select_scoped ON public.revendas_crm
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM private.get_user_access() u
  WHERE u.perfil = 'admin' OR u.cnpj_raiz = revendas_crm.cnpj_raiz));
CREATE POLICY revendas_crm_insert_scoped ON public.revendas_crm
FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM private.get_user_access() u
  WHERE u.perfil = 'admin' OR u.cnpj_raiz = revendas_crm.cnpj_raiz));
CREATE POLICY revendas_crm_update_scoped ON public.revendas_crm
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin' OR u.cnpj_raiz = revendas_crm.cnpj_raiz))
WITH CHECK (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin' OR u.cnpj_raiz = revendas_crm.cnpj_raiz));

CREATE POLICY importacoes_log_select_admin ON public.importacoes_log
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));
CREATE POLICY importacoes_log_insert_admin ON public.importacoes_log
FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));

CREATE POLICY solicitacoes_acesso_insert_public ON public.solicitacoes_acesso
FOR INSERT TO anon, authenticated
WITH CHECK (status = 'pendente' AND analisado_em IS NULL AND analisado_por IS NULL AND observacao_admin IS NULL);
CREATE POLICY solicitacoes_acesso_select_admin ON public.solicitacoes_acesso
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));
CREATE POLICY solicitacoes_acesso_update_admin ON public.solicitacoes_acesso
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin'));

ALTER TABLE public.distribuidores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribuidores FORCE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_acesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_acesso FORCE ROW LEVEL SECURITY;
ALTER TABLE public.projetos_pag_fat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos_pag_fat FORCE ROW LEVEL SECURITY;
ALTER TABLE public.projetos_funil ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos_funil FORCE ROW LEVEL SECURITY;
ALTER TABLE public.revendas_crm ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revendas_crm FORCE ROW LEVEL SECURITY;
ALTER TABLE public.importacoes_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacoes_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes_acesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes_acesso FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.distribuidores, public.usuarios_acesso, public.projetos_pag_fat,
 public.projetos_funil, public.revendas_crm, public.importacoes_log, public.solicitacoes_acesso
FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.distribuidores TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.usuarios_acesso TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.projetos_pag_fat TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.projetos_funil TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.revendas_crm TO authenticated;
GRANT SELECT, INSERT ON TABLE public.importacoes_log TO authenticated;
GRANT INSERT ON TABLE public.solicitacoes_acesso TO anon;
GRANT INSERT, SELECT, UPDATE ON TABLE public.solicitacoes_acesso TO authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_usuarios_acesso_cnpj_raiz ON public.usuarios_acesso(cnpj_raiz);

REVOKE ALL ON FUNCTION public.get_user_access() FROM PUBLIC, anon, authenticated;
DROP FUNCTION public.get_user_access();

-- Private schema and policy plan follow-up.
DROP POLICY IF EXISTS usuarios_acesso_select ON public.usuarios_acesso;
CREATE POLICY usuarios_acesso_select ON public.usuarios_acesso
FOR SELECT TO authenticated
USING (
  lower(email) = lower((SELECT auth.jwt() ->> 'email'))
  OR EXISTS (SELECT 1 FROM private.get_user_access() u WHERE u.perfil = 'admin')
);
CREATE INDEX IF NOT EXISTS idx_distribuidor_cnpj_links_b
  ON private.distribuidor_cnpj_links(cnpj_raiz_b);
DROP POLICY IF EXISTS deny_client_access ON private.distribuidor_cnpj_links;
CREATE POLICY deny_client_access ON private.distribuidor_cnpj_links
AS RESTRICTIVE FOR ALL TO anon, authenticated
USING (false) WITH CHECK (false);


-- Economic group used by admin team-bonus controls.
-- Persist a shared economic group for related distributor CNPJ roots.
-- Existing rows are preserved; ungrouped roots become their own economic group.
ALTER TABLE public.distribuidores
  ADD COLUMN IF NOT EXISTS grupo_economico_id text;

UPDATE public.distribuidores
SET grupo_economico_id = cnpj_raiz
WHERE grupo_economico_id IS NULL OR btrim(grupo_economico_id) = '';

UPDATE public.distribuidores
SET grupo_economico_id = '2M_CONNECTIONS'
WHERE cnpj_raiz IN ('41649269','76823327');

CREATE OR REPLACE FUNCTION private.assign_default_distributor_group()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.grupo_economico_id IS NULL OR btrim(NEW.grupo_economico_id) = '' THEN
    NEW.grupo_economico_id := NEW.cnpj_raiz;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_distributor_group ON public.distribuidores;
CREATE TRIGGER trg_assign_distributor_group
BEFORE INSERT OR UPDATE OF cnpj_raiz ON public.distribuidores
FOR EACH ROW EXECUTE FUNCTION private.assign_default_distributor_group();

ALTER TABLE public.distribuidores
  ALTER COLUMN grupo_economico_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_distribuidores_grupo_economico
  ON public.distribuidores(grupo_economico_id);

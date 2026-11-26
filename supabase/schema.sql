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

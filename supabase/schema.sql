-- =========================================================================
-- SCHEMA COMPLETO PORTAL RADIS SOLAR (SUPABASE / POSTGRESQL)
-- =========================================================================

-- 1. Tabela Mestre de Distribuidores (Consolidado por Raiz do CNPJ - 8 dígitos)
CREATE TABLE IF NOT EXISTS distribuidores (
  cnpj_raiz VARCHAR(8) PRIMARY KEY,
  nome TEXT NOT NULL,
  uf VARCHAR(2),
  cod_sap VARCHAR(20),
  possui_equipe_3_pessoas BOOLEAN DEFAULT FALSE, -- Bônus +1% RADIS (Vendedor, Engenheiro, Multiplicador)
  metas_mensais JSONB DEFAULT '{}'::jsonb -- Ex: {"2026-01": 1528489.38, "2026-02": 1401007.74}
);

-- 2. Usuários e Permissões (5 a 6 e-mails por distribuidor + Admins)
CREATE TABLE IF NOT EXISTS usuarios_acesso (
  email TEXT PRIMARY KEY,
  nome TEXT,
  cargo TEXT, -- Ex: Gerente, Vendedor, Diretor, Admin
  perfil TEXT NOT NULL CHECK (perfil IN ('admin', 'distribuidor')),
  cnpj_raiz VARCHAR(8) REFERENCES distribuidores(cnpj_raiz) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Projetos Faturados / Carteira (Base Qlik: Pagos / Pedidos)
CREATE TABLE IF NOT EXISTS projetos_pag_fat (
  codigo_projeto TEXT PRIMARY KEY,
  cnpj_raiz VARCHAR(8) REFERENCES distribuidores(cnpj_raiz),
  cnpj_filial VARCHAR(14),
  nome_distribuidor TEXT,
  pedido_erp TEXT,
  etapa_venda TEXT,
  status_pagamento TEXT,
  potencia_gerador NUMERIC DEFAULT 0,
  data_criacao TIMESTAMPTZ,
  data_pagamento DATE,
  data_emissao_nf DATE,
  numero_nf TEXT,
  valor_produtos_desconto NUMERIC DEFAULT 0,
  valor_servico NUMERIC DEFAULT 0,
  valor_total NUMERIC DEFAULT 0,
  percentual_comissao NUMERIC DEFAULT 0,
  forma_pagamento TEXT,
  parcelas INTEGER DEFAULT 1,
  executivo_vendas TEXT,
  cliente_nome TEXT,
  cliente_cidade TEXT,
  cliente_uf VARCHAR(2),
  revenda_cnpj VARCHAR(14),
  revenda_nome TEXT,
  revenda_classificacao TEXT,
  mes_referencia VARCHAR(7) -- Formato YYYY-MM
);

-- 4. Projetos Criados / Funil (Base Qlik: Criadas Campanha)
CREATE TABLE IF NOT EXISTS projetos_funil (
  codigo_projeto TEXT PRIMARY KEY,
  cnpj_raiz VARCHAR(8) REFERENCES distribuidores(cnpj_raiz),
  cnpj_filial VARCHAR(14),
  etapa_venda TEXT,
  potencia_gerador NUMERIC DEFAULT 0,
  data_criacao TIMESTAMPTZ,
  data_expiracao TIMESTAMPTZ,
  valor_produtos_desconto NUMERIC DEFAULT 0,
  valor_total NUMERIC DEFAULT 0,
  executivo_vendas TEXT,
  revenda_cnpj VARCHAR(14),
  revenda_nome TEXT,
  revenda_classificacao TEXT,
  cliente_proposta TEXT,
  email_proposta TEXT,
  mes_criacao VARCHAR(7) -- Formato YYYY-MM
);

-- 5. CRM de Revendas (Anotações editáveis pelo time do Distribuidor)
CREATE TABLE IF NOT EXISTS revendas_crm (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cnpj_raiz VARCHAR(8) REFERENCES distribuidores(cnpj_raiz) ON DELETE CASCADE,
  revenda_cnpj VARCHAR(14) NOT NULL,
  data_ultimo_contato DATE,
  observacoes TEXT,
  atualizado_por TEXT,
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cnpj_raiz, revenda_cnpj)
);

-- 6. Log de Importações Qlik
CREATE TABLE IF NOT EXISTS importacoes_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_base TEXT NOT NULL, -- 'PAG_FAT' ou 'CRIADAS'
  arquivo_nome TEXT,
  total_registros INTEGER,
  data_referencia DATE,
  importado_por TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance rápida
CREATE INDEX IF NOT EXISTS idx_pag_fat_cnpj_raiz ON projetos_pag_fat(cnpj_raiz);
CREATE INDEX IF NOT EXISTS idx_pag_fat_mes ON projetos_pag_fat(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_funil_cnpj_raiz ON projetos_funil(cnpj_raiz);
CREATE INDEX IF NOT EXISTS idx_funil_mes ON projetos_funil(mes_criacao);

-- =========================================================================
-- SEGURANÇA EM NÍVEL DE LINHA (RLS) - ISOLAMENTO TOTAL ENTRE CANAIS
-- =========================================================================
ALTER TABLE distribuidores ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_acesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE projetos_pag_fat ENABLE ROW LEVEL SECURITY;
ALTER TABLE projetos_funil ENABLE ROW LEVEL SECURITY;
ALTER TABLE revendas_crm ENABLE ROW LEVEL SECURITY;
ALTER TABLE importacoes_log ENABLE ROW LEVEL SECURITY;

-- Função segura que identifica o perfil e o cnpj_raiz do usuário logado
CREATE OR REPLACE FUNCTION get_user_access()
RETURNS TABLE(perfil TEXT, cnpj_raiz VARCHAR) AS $$
  SELECT perfil, cnpj_raiz
  FROM usuarios_acesso
  WHERE lower(email) = lower(auth.jwt() ->> 'email');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Políticas de Acesso
CREATE POLICY "Leitura usuarios_acesso" ON usuarios_acesso FOR SELECT
USING (
  lower(email) = lower(auth.jwt() ->> 'email')
  OR EXISTS (SELECT 1 FROM get_user_access() u WHERE u.perfil = 'admin')
);

CREATE POLICY "Admin gerencia usuarios_acesso" ON usuarios_acesso FOR ALL
USING (EXISTS (SELECT 1 FROM get_user_access() u WHERE u.perfil = 'admin'));

CREATE POLICY "Leitura distribuidores" ON distribuidores FOR SELECT
USING (
  EXISTS (SELECT 1 FROM get_user_access() u WHERE u.perfil = 'admin' OR u.cnpj_raiz = distribuidores.cnpj_raiz)
);

CREATE POLICY "Admin gerencia distribuidores" ON distribuidores FOR ALL
USING (EXISTS (SELECT 1 FROM get_user_access() u WHERE u.perfil = 'admin'));

CREATE POLICY "Leitura projetos_pag_fat" ON projetos_pag_fat FOR SELECT
USING (
  EXISTS (SELECT 1 FROM get_user_access() u WHERE u.perfil = 'admin' OR u.cnpj_raiz = projetos_pag_fat.cnpj_raiz)
);

CREATE POLICY "Admin gerencia projetos_pag_fat" ON projetos_pag_fat FOR ALL
USING (EXISTS (SELECT 1 FROM get_user_access() u WHERE u.perfil = 'admin'));

CREATE POLICY "Leitura projetos_funil" ON projetos_funil FOR SELECT
USING (
  EXISTS (SELECT 1 FROM get_user_access() u WHERE u.perfil = 'admin' OR u.cnpj_raiz = projetos_funil.cnpj_raiz)
);

CREATE POLICY "Admin gerencia projetos_funil" ON projetos_funil FOR ALL
USING (EXISTS (SELECT 1 FROM get_user_access() u WHERE u.perfil = 'admin'));

CREATE POLICY "Acesso revendas_crm" ON revendas_crm FOR ALL
USING (
  EXISTS (SELECT 1 FROM get_user_access() u WHERE u.perfil = 'admin' OR u.cnpj_raiz = revendas_crm.cnpj_raiz)
);

CREATE POLICY "Leitura importacoes_log" ON importacoes_log FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Admin insere importacoes_log" ON importacoes_log FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM get_user_access() u WHERE u.perfil = 'admin'));

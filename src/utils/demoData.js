// Dados de demonstração baseados na planilha modelo "2M CONNECTIONS LTDA"
// Utilizado automaticamente caso as variáveis de ambiente do Supabase ainda não estejam configuradas.

export const DEMO_DISTRIBUIDORES = [
  {
    cnpj_raiz: '76823327',
    nome: '2M CONNECTIONS LTDA (Matriz + Filiais)',
    uf: 'RS',
    cod_sap: '1044794',
    possui_equipe_3_pessoas: true,
    metas_mensais: {
      '2026-01': 1528489.38,
      '2026-02': 1401007.74,
      '2026-03': 1326428.40,
      '2026-04': 1262214.47,
      '2026-05': 1240752.48,
      '2026-06': 1226688.21,
      '2026-07': 1167247.31,
      '2026-08': 1162804.78,
      '2026-09': 1223263.52,
      '2026-10': 1258924.89,
      '2026-11': 1267082.98,
      '2026-12': 1268859.99,
    },
  },
  {
    cnpj_raiz: '01611372',
    nome: 'DISCFONE DISTRIBUIDORA LTDA',
    uf: 'SC',
    cod_sap: '1017910',
    possui_equipe_3_pessoas: true,
    metas_mensais: {
      '2026-01': 950000, '2026-02': 950000, '2026-03': 980000,
      '2026-04': 920000, '2026-05': 920000, '2026-06': 950000,
      '2026-07': 980000, '2026-08': 1020000, '2026-09': 1050000,
      '2026-10': 1100000, '2026-11': 1150000, '2026-12': 1200000,
    },
  },
  {
    cnpj_raiz: '11315435',
    nome: 'DIGITAL SAT DISTRIBUIDORA LTDA (RS + SC)',
    uf: 'RS',
    cod_sap: '1017315',
    possui_equipe_3_pessoas: false,
    metas_mensais: {
      '2026-01': 650000, '2026-02': 650000, '2026-03': 680000,
      '2026-04': 700000, '2026-05': 700000, '2026-06': 720000,
      '2026-07': 750000, '2026-08': 750000, '2026-09': 780000,
      '2026-10': 800000, '2026-11': 820000, '2026-12': 850000,
    },
  },
]

export const DEMO_PAG_FAT = [
  { codigo_projeto: 'PROJ26011478080', cnpj_raiz: '76823327', cnpj_filial: '76823327000125', pedido_erp: '1141355', etapa_venda: 'Produto Entregue', status_pagamento: 'Pago', potencia_gerador: 26.1, data_pagamento: '2026-01-07', data_emissao_nf: '2026-01-08', numero_nf: '369002', valor_total: 1041136.67, forma_pagamento: 'Boleto', executivo_vendas: 'GABRIELA GOULART EBERTZ', cliente_nome: 'VINICIUS DE MOURA', cliente_cidade: 'Passo Fundo', cliente_uf: 'RS', revenda_cnpj: '43739750000192', revenda_nome: 'ARTHUR CASSENOTE DESCONZI', revenda_classificacao: 'MID 2,00%', mes_referencia: '2026-01' },
  { codigo_projeto: 'PROJ26021489100', cnpj_raiz: '76823327', cnpj_filial: '76823327000125', pedido_erp: '1152011', etapa_venda: 'Produto Entregue', status_pagamento: 'Pago', potencia_gerador: 18.5, data_pagamento: '2026-02-12', data_emissao_nf: '2026-02-14', numero_nf: '375110', valor_total: 1060265.17, forma_pagamento: 'PIX', executivo_vendas: 'GABRIELA GOULART EBERTZ', cliente_nome: 'COOPERATIVA AGRICOLA SUL', cliente_cidade: 'Santa Maria', cliente_uf: 'RS', revenda_cnpj: '28856820000107', revenda_nome: 'JOAO LUIZ CONCATTO SOLAR', revenda_classificacao: 'MID 2,00%', mes_referencia: '2026-02' },
  { codigo_projeto: 'PROJ26031495220', cnpj_raiz: '76823327', cnpj_filial: '76823327000206', pedido_erp: '1169820', etapa_venda: 'Produto Entregue', status_pagamento: 'Pago', potencia_gerador: 32.0, data_pagamento: '2026-03-18', data_emissao_nf: '2026-03-19', numero_nf: '382901', valor_total: 1242930.89, forma_pagamento: 'Financiamento Indireto', executivo_vendas: 'GABRIELA GOULART EBERTZ', cliente_nome: 'INDUSTRIA METALURGICA RS', cliente_cidade: 'Caxias do Sul', cliente_uf: 'RS', revenda_cnpj: '03922795000183', revenda_nome: 'DEFEND SISTEMAS DE SEGURANCA LTDA', revenda_classificacao: 'MAX 3,00%', mes_referencia: '2026-03' },
  { codigo_projeto: 'PROJ26081591234', cnpj_raiz: '76823327', cnpj_filial: '76823327000125', pedido_erp: '1298120', etapa_venda: 'Produto Entregue', status_pagamento: 'Pago', potencia_gerador: 45.2, data_pagamento: '2026-08-20', data_emissao_nf: '2026-08-21', numero_nf: '412890', valor_total: 1173762.47, forma_pagamento: 'Financiamento Indireto', executivo_vendas: 'GABRIELA GOULART EBERTZ', cliente_nome: 'SUPERMERCADO CENTRAL', cliente_cidade: 'Passo Fundo', cliente_uf: 'RS', revenda_cnpj: '21686790000180', revenda_nome: 'ACL TELECOM LTDA', revenda_classificacao: 'LITE 1,00%', mes_referencia: '2026-08' },
  { codigo_projeto: 'PROJ26101625001', cnpj_raiz: '76823327', cnpj_filial: '76823327000125', pedido_erp: '1340112', etapa_venda: 'Produto Entregue', status_pagamento: 'Pago', potencia_gerador: 14.8, data_pagamento: '2026-10-15', data_emissao_nf: '2026-10-16', numero_nf: '439120', valor_total: 666317.21, forma_pagamento: 'Cartão de Crédito', executivo_vendas: 'GABRIELA GOULART EBERTZ', cliente_nome: 'FAZENDA BOA VISTA', cliente_cidade: 'Bagé', cliente_uf: 'RS', revenda_cnpj: '28856820000107', revenda_nome: 'JOAO LUIZ CONCATTO SOLAR', revenda_classificacao: 'MID 2,00%', mes_referencia: '2026-10' },
  { codigo_projeto: 'PROJ26111641002', cnpj_raiz: '76823327', cnpj_filial: '76823327000125', pedido_erp: '1358910', etapa_venda: 'Processando informações do pedido', status_pagamento: 'Aguardando_Emissao_Nf', potencia_gerador: 12.4, data_pagamento: '2026-11-24', data_emissao_nf: null, numero_nf: '', valor_total: 185400.00, forma_pagamento: 'PIX', executivo_vendas: 'GABRIELA GOULART EBERTZ', cliente_nome: 'TRANSPORTADORA GAUCHA', cliente_cidade: 'Santa Maria', cliente_uf: 'RS', revenda_cnpj: '03922795000183', revenda_nome: 'DEFEND SISTEMAS DE SEGURANCA LTDA', revenda_classificacao: 'MAX 3,00%', mes_referencia: '2026-11' },
  { codigo_projeto: 'PROJ26111641888', cnpj_raiz: '76823327', cnpj_filial: '76823327000125', pedido_erp: '1359201', etapa_venda: 'Produto Entregue', status_pagamento: 'Pago', potencia_gerador: 22.0, data_pagamento: '2026-11-18', data_emissao_nf: '2026-11-19', numero_nf: '451029', valor_total: 412890.50, forma_pagamento: 'Boleto', executivo_vendas: 'GABRIELA GOULART EBERTZ', cliente_nome: 'AGROPECUARIA PAMPA', cliente_cidade: 'Uruguaiana', cliente_uf: 'RS', revenda_cnpj: '28856820000107', revenda_nome: 'JOAO LUIZ CONCATTO SOLAR', revenda_classificacao: 'MID 2,00%', mes_referencia: '2026-11' },
  { codigo_projeto: 'PROJ26111647569', cnpj_raiz: '01611372', cnpj_filial: '01611372000206', pedido_erp: '2985715', etapa_venda: 'Produto Entregue', status_pagamento: 'Pago', potencia_gerador: 55.4, data_pagamento: '2026-11-25', data_emissao_nf: '2026-11-25', numero_nf: '452100', valor_total: 896961.54, forma_pagamento: 'Cartão de Crédito', executivo_vendas: 'MARIA GABRIELA ALVES DA ROSA', cliente_nome: 'CONDOMINIO PRAIA SUL', cliente_cidade: 'Garopaba', cliente_uf: 'SC', revenda_cnpj: '32591419000151', revenda_nome: 'ZE DO LELO MANUTENCOES', revenda_classificacao: 'MAX 3,00%', mes_referencia: '2026-11' },
  { codigo_projeto: 'PROJ26111649001', cnpj_raiz: '11315435', cnpj_filial: '11315435000507', pedido_erp: '2990122', etapa_venda: 'Produto Entregue', status_pagamento: 'Pago', potencia_gerador: 41.0, data_pagamento: '2026-11-21', data_emissao_nf: '2026-11-22', numero_nf: '451880', valor_total: 534200.00, forma_pagamento: 'PIX', executivo_vendas: 'CARLOS EDUARDO SILVA', cliente_nome: 'HOTEL SERRA', cliente_cidade: 'Gramado', cliente_uf: 'RS', revenda_cnpj: '14410764000160', revenda_nome: 'MAICON FLORES FAVERO SOLAR', revenda_classificacao: 'LITE 1,00%', mes_referencia: '2026-11' },
]

export const DEMO_FUNIL = [
  { codigo_projeto: 'PROV26111649910', cnpj_raiz: '76823327', etapa_venda: 'Pré-orçamento', potencia_gerador: 350, data_criacao: '2026-11-24T15:05:00Z', valor_total: 1258765.18, executivo_vendas: 'GABRIELA GOULART EBERTZ', revenda_cnpj: '43138974000149', revenda_nome: 'GIOVANI R HOFFMANN', cliente_proposta: 'Usina Solo 350kW', email_proposta: 'giovani@exemplo.com', mes_criacao: '2026-11' },
  { codigo_projeto: 'PROJ26111649922', cnpj_raiz: '76823327', etapa_venda: 'Proposta Final', potencia_gerador: 45, data_criacao: '2026-11-22T10:15:00Z', valor_total: 142500.00, executivo_vendas: 'GABRIELA GOULART EBERTZ', revenda_cnpj: '03922795000183', revenda_nome: 'DEFEND SISTEMAS DE SEGURANCA LTDA', cliente_proposta: 'Mercado Central', email_proposta: 'solar@defend.com', mes_criacao: '2026-11' },
  { codigo_projeto: 'PROJ26111649935', cnpj_raiz: '76823327', etapa_venda: 'Pré-orçamento', potencia_gerador: 18, data_criacao: '2026-11-20T09:00:00Z', valor_total: 58900.00, executivo_vendas: 'GABRIELA GOULART EBERTZ', revenda_cnpj: '21686790000180', revenda_nome: 'ACL TELECOM LTDA', cliente_proposta: 'Clínica Médica', email_proposta: 'contato@acltelecom.com.br', mes_criacao: '2026-11' },
  { codigo_projeto: 'PROV26111646533', cnpj_raiz: '01611372', etapa_venda: 'Pré-orçamento', potencia_gerador: 350, data_criacao: '2026-11-24T15:05:00Z', valor_total: 1165673.31, executivo_vendas: 'MARIA GABRIELA ALVES DA ROSA', revenda_cnpj: '12865973000172', revenda_nome: 'ELVIS LEMES NEIMAIER', cliente_proposta: 'Giovane Monteiro', email_proposta: 'contato.taletech@gmail.com', mes_criacao: '2026-11' },
]

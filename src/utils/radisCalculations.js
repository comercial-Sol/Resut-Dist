// =========================================================================
// MOTOR DE CÁLCULO DA POLÍTICA RADIS & CLASSIFICAÇÃO DE REVENDAS
// =========================================================================

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) || 0)
}

export function formatPercent(value) {
  return `${((Number(value) || 0) * 100).toFixed(2).replace('.', ',')}%`
}

export function formatCNPJ(cnpj) {
  const digits = String(cnpj || '').replace(/\D/g, '').padStart(14, '0')
  if (digits === '00000000000000') return '-'
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

/**
 * Regras de Faixa RADIS (Baseadas na Média Mensal do Trimestre):
 * Faixa 1: 0 a 199.999,99 -> 2% | Min Ativas: 25 | Min Recorrentes: 5
 * Faixa 2: 200.000 a 399.999,99 -> 3% | Min Ativas: 40 | Min Recorrentes: 6
 * Faixa 3: 400.000 a 599.999,99 -> 4% | Min Ativas: 50 | Min Recorrentes: 8
 * Faixa 4: Acima de 600.000 -> 5% | Min Ativas: 60 | Min Recorrentes: 10
 * Bônus Equipe (3 pessoas: Vendedor, Engenheiro, Multiplicador): +1%
 * Bônus Revendas Ativas: R$ 3.500,00 / mês
 * Bônus Revendas Recorrentes: R$ 3.500,00 / mês
 */
export function getRadisTier(mediaMensalTrimestre, possuiEquipe3Pessoas = false) {
  let faixa = 1
  let comissaoBase = 0.02
  let minAtivas = 25
  let minRecorrentes = 5
  let labelFaixa = 'Faixa 1 (0 a 199k)'

  if (mediaMensalTrimestre >= 600000) {
    faixa = 4
    comissaoBase = 0.05
    minAtivas = 60
    minRecorrentes = 10
    labelFaixa = 'Faixa 4 (Acima de 600k)'
  } else if (mediaMensalTrimestre >= 400000) {
    faixa = 3
    comissaoBase = 0.04
    minAtivas = 50
    minRecorrentes = 8
    labelFaixa = 'Faixa 3 (400k a 599k)'
  } else if (mediaMensalTrimestre >= 200000) {
    faixa = 2
    comissaoBase = 0.03
    minAtivas = 40
    minRecorrentes = 6
    labelFaixa = 'Faixa 2 (200k a 399k)'
  }

  const bonusEquipe = possuiEquipe3Pessoas ? 0.01 : 0
  const comissaoTotal = comissaoBase + bonusEquipe

  return {
    faixa,
    labelFaixa,
    comissaoBase,
    bonusEquipe,
    comissaoTotal,
    minAtivas,
    minRecorrentes,
  }
}

/**
 * Classifica as revendas do distribuidor conforme a regra da aba "Revendas":
 * - Recorrente: comprou consecutivamente nos últimos 6 meses (ou frequência mensal contínua)
 * - Ativa: comprou pelo menos 1 vez dentro dos últimos 3 meses
 * - Regular: comprou entre 3 e 6 meses atrás
 * - Inativa: não compra há mais de 6 meses
 */
export function buildRevendasConsolidado(projetosPagFat, projetosFunil, crmMap = {}, refYear = 2026, refMonth = 11) {
  const revendasMap = new Map()

  const getMonthIndex = (ym) => {
    if (!ym) return -1
    const [y, m] = ym.split('-').map(Number)
    return y * 12 + m
  }

  const currentIdx = refYear * 12 + refMonth

  // Processar projetos faturados/pagos
  projetosPagFat.forEach((p) => {
    if (p.status_pagamento === 'Cancelado') return
    const cnpj = String(p.revenda_cnpj || '').replace(/\D/g, '')
    if (!cnpj || cnpj === '00000000000000') return

    if (!revendasMap.has(cnpj)) {
      revendasMap.set(cnpj, {
        revenda_cnpj: cnpj,
        revenda_nome: p.revenda_nome || 'Revenda sem nome',
        classificacao_intelbras: p.revenda_classificacao || 'Cadastrada',
        uf: p.cliente_uf || '-',
        cidade: p.cliente_cidade || '-',
        executivo_vendas: p.executivo_vendas || '-',
        meses_compra: new Set(),
        faturamento_por_mes: {},
        total_faturado: 0,
        qtd_projetos_vendidos: 0,
        qtd_propostas_criadas: 0,
        ultima_compra: null,
      })
    }

    const rev = revendasMap.get(cnpj)
    const isFaturado = Boolean(p.numero_nf && p.numero_nf !== '-') || p.status_pagamento === 'Pago'
    if (isFaturado) {
      rev.total_faturado += Number(p.valor_total) || 0
      rev.qtd_projetos_vendidos += 1
      if (p.mes_referencia) {
        rev.meses_compra.add(p.mes_referencia)
        rev.faturamento_por_mes[p.mes_referencia] =
          (rev.faturamento_por_mes[p.mes_referencia] || 0) + (Number(p.valor_total) || 0)
      }
      const dt = p.data_emissao_nf || p.data_pagamento
      if (dt && (!rev.ultima_compra || dt > rev.ultima_compra)) {
        rev.ultima_compra = dt
      }
    }
  })

  // Contabilizar propostas criadas no funil
  projetosFunil.forEach((f) => {
    const cnpj = String(f.revenda_cnpj || '').replace(/\D/g, '')
    if (!cnpj || cnpj === '00000000000000') return
    if (!revendasMap.has(cnpj)) {
      revendasMap.set(cnpj, {
        revenda_cnpj: cnpj,
        revenda_nome: f.revenda_nome || 'Revenda sem nome',
        classificacao_intelbras: f.revenda_classificacao || 'Cadastrada',
        uf: '-',
        cidade: '-',
        executivo_vendas: f.executivo_vendas || '-',
        meses_compra: new Set(),
        faturamento_por_mes: {},
        total_faturado: 0,
        qtd_projetos_vendidos: 0,
        qtd_propostas_criadas: 0,
        ultima_compra: null,
      })
    }
    revendasMap.get(cnpj).qtd_propostas_criadas += 1
  })

  const list = []
  revendasMap.forEach((rev) => {
    // Verificar compras nos últimos 6 meses consecutivos (M-5 até M)
    let consecutivos6m = 0
    for (let i = 0; i < 6; i++) {
      const targetIdx = currentIdx - i
      const y = Math.floor((targetIdx - 1) / 12)
      const m = ((targetIdx - 1) % 12) + 1
      const ym = `${y}-${String(m).padStart(2, '0')}`
      if (rev.meses_compra.has(ym)) consecutivos6m++
    }

    // Verificar última compra em meses
    let minDiff = 999
    rev.meses_compra.forEach((ym) => {
      const diff = currentIdx - getMonthIndex(ym)
      if (diff >= 0 && diff < minDiff) minDiff = diff
    })

    let status = 'Inativa'
    if (consecutivos6m >= 6) {
      status = 'Recorrente'
    } else if (minDiff <= 2) {
      status = 'Ativa'
    } else if (minDiff <= 5) {
      status = 'Regular'
    }

    const crm = crmMap[rev.revenda_cnpj] || {}
    list.push({
      ...rev,
      status,
      data_ultimo_contato: crm.data_ultimo_contato || '',
      observacoes: crm.observacoes || '',
    })
  })

  return list.sort((a, b) => b.total_faturado - a.total_faturado)
}

/**
 * Simulador de Cartão de Crédito (Tabela de taxas idêntica à aba "Simulação Cartão de Credito")
 */
export const TAXAS_CARTAO = [
  { parcelas: 1, taxa: 0.0 },
  { parcelas: 2, taxa: 0.0 },
  { parcelas: 3, taxa: 0.0 },
  { parcelas: 4, taxa: 0.0 },
  { parcelas: 5, taxa: 0.0 },
  { parcelas: 6, taxa: 0.0 },
  { parcelas: 7, taxa: 0.0332 },
  { parcelas: 8, taxa: 0.0374 },
  { parcelas: 9, taxa: 0.0417 },
  { parcelas: 10, taxa: 0.0459 },
  { parcelas: 11, taxa: 0.0502 },
  { parcelas: 12, taxa: 0.0546 },
  { parcelas: 13, taxa: 0.1178 },
  { parcelas: 14, taxa: 0.1265 },
  { parcelas: 15, taxa: 0.1353 },
  { parcelas: 16, taxa: 0.1441 },
  { parcelas: 17, taxa: 0.153 },
  { parcelas: 18, taxa: 0.1619 },
  { parcelas: 19, taxa: 0.1709 },
  { parcelas: 20, taxa: 0.1799 },
  { parcelas: 21, taxa: 0.189 },
]

export function calcularSimulacaoCartao(valorOriginal, percDescontoIntegrador, valorServico = 0) {
  const desconto = valorOriginal * (percDescontoIntegrador / 100)
  const valorVistaComDesconto = Math.max(0, valorOriginal - desconto)
  const iss = valorServico * 0.091 // 9,10% ISS sobre serviço conforme planilha
  const servicoLiquido = Math.max(0, valorServico - iss)
  const baseTotal = valorVistaComDesconto + valorServico

  const opcoes = TAXAS_CARTAO.map(({ parcelas, taxa }) => {
    const valorTotalParcelado = baseTotal * (1 + taxa)
    const valorParcela = valorTotalParcelado / parcelas
    return {
      parcelas,
      taxa,
      valorParcela,
      valorTotal: valorTotalParcelado,
    }
  })

  return {
    desconto,
    valorVistaComDesconto,
    iss,
    servicoLiquido,
    baseTotal,
    opcoes,
  }
}

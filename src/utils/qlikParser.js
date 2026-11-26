import * as XLSX from 'xlsx'

/**
 * Normaliza CNPJ para 14 dígitos e extrai a raiz (8 primeiros dígitos)
 * para consolidar Matriz + Filiais sob o mesmo distribuidor.
 */
export function extractCnpjParts(rawCnpj) {
  const digits = String(rawCnpj || '').replace(/\D/g, '')
  if (!digits) return { full: '', raiz: '' }
  const full = digits.padStart(14, '0')
  return {
    full,
    raiz: full.slice(0, 8),
  }
}

export function cleanDigits(val) {
  const d = String(val || '').replace(/\D/g, '')
  return d ? d.padStart(14, '0') : ''
}

function parseExcelDate(val) {
  if (!val || val === '-') return null
  if (val instanceof Date && !isNaN(val)) {
    return val.toISOString()
  }
  if (typeof val === 'number') {
    const utcDays = Math.floor(val - 25569)
    const d = new Date(utcDays * 86400 * 1000)
    return isNaN(d) ? null : d.toISOString()
  }
  const str = String(val).trim()
  // Formato DD/MM/YYYY
  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (brMatch) {
    return new Date(`${brMatch[3]}-${brMatch[2]}-${brMatch[1]}T00:00:00Z`).toISOString()
  }
  const d = new Date(str)
  return isNaN(d) ? null : d.toISOString()
}

function getYearMonth(isoStr) {
  if (!isoStr) return null
  return isoStr.slice(0, 7) // YYYY-MM
}

/**
 * Lê e deduplica a planilha Qlik de Projetos Pagos / Faturados ("Sem título...xlsx")
 */
export async function parseQlikPagFatFile(file) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  const dedupMap = new Map()
  const distribuidoresEncontrados = new Map()

  rows.forEach((row) => {
    const codigo = String(row['Código Venda Projeto Solar'] || '').trim()
    if (!codigo || codigo === '-') return

    const { full: cnpjFilial, raiz: cnpjRaiz } = extractCnpjParts(row['CNPJ CPF Distribuidor'])
    if (!cnpjRaiz || cnpjRaiz === '00000000') return

    const nomeDist = String(row['Nome Distribuidor'] || '').trim()
    if (!distribuidoresEncontrados.has(cnpjRaiz)) {
      distribuidoresEncontrados.set(cnpjRaiz, {
        cnpj_raiz: cnpjRaiz,
        nome: nomeDist || `Distribuidor ${cnpjRaiz}`,
        uf: String(row['UF Endereço Clientes Solar'] || '').trim().slice(0, 2),
      })
    }

    // Deduplicação: O Qlik repete linhas quando há múltiplos componentes ou 2 formas de pagamento.
    // Mantemos 1 registro único por Código Venda Projeto Solar.
    if (!dedupMap.has(codigo)) {
      const dtCriacao = parseExcelDate(row['Data Criação Projeto Solar'])
      const dtPag = parseExcelDate(row['Data Pagamento Projeto Solar'])
      const dtNf = parseExcelDate(row['Data Emissão Nota Fiscal Projeto Solar'])
      const numNf = String(row['Número Nota Fiscal Projeto Solar'] || '').trim()
      const refIso = dtNf || dtPag || dtCriacao

      dedupMap.set(codigo, {
        codigo_projeto: codigo,
        cnpj_raiz: cnpjRaiz,
        cnpj_filial: cnpjFilial,
        nome_distribuidor: nomeDist,
        pedido_erp: String(row['Número Pedido ERP Projeto Solar'] || '').trim(),
        etapa_venda: String(row['Etapa Venda Desc Projeto Solar'] || '').trim(),
        status_pagamento: String(row['Status Projeto Pagamento Projeto Solar'] || '').trim(),
        potencia_gerador: Number(row['Potência Gerador Projeto Solar']) || 0,
        data_criacao: dtCriacao,
        data_pagamento: dtPag ? dtPag.slice(0, 10) : null,
        data_emissao_nf: dtNf ? dtNf.slice(0, 10) : null,
        numero_nf: numNf === '-' ? '' : numNf,
        valor_produtos_desconto: Number(row['Valor Produtos com Desconto']) || 0,
        valor_servico: Number(row['Valor Serviço PIS/COFINS']) || 0,
        valor_total: Number(row['Valor Total']) || 0,
        percentual_comissao: Number(row['Percentual Comissão Distribuidor']) || 0,
        forma_pagamento: String(row['Forma Pagamento Desc Projeto Solar'] || '').trim(),
        parcelas: parseInt(row['Parcelas 1 Projeto Solar'], 10) || 1,
        executivo_vendas: String(row['Nome Executivo Vendas'] || '').trim(),
        cliente_nome: String(row['Nome Clientes Solar'] || '').trim(),
        cliente_cidade: String(row['Cidade Endereço Clientes Solar'] || '').trim(),
        cliente_uf: String(row['UF Endereço Clientes Solar'] || '').trim().slice(0, 2),
        revenda_cnpj: cleanDigits(row['CNPJ CPF Revenda']),
        revenda_nome: String(row['Nome Revenda'] || '').trim(),
        revenda_classificacao: String(row['Classificação Revenda Desc Projeto Solar'] || '').trim(),
        mes_referencia: getYearMonth(refIso),
      })
    }
  })

  return {
    projetos: Array.from(dedupMap.values()),
    distribuidores: Array.from(distribuidoresEncontrados.values()),
    linhasBrutas: rows.length,
  }
}

/**
 * Lê e deduplica a planilha Qlik de Projetos Criados ("Criadas Campanha...xlsx")
 */
export async function parseQlikCriadasFile(file) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  const dedupMap = new Map()
  const distribuidoresEncontrados = new Map()

  rows.forEach((row) => {
    const codigo = String(row['Código Venda Projeto Solar'] || '').trim()
    if (!codigo || codigo === '-') return

    const { full: cnpjFilial, raiz: cnpjRaiz } = extractCnpjParts(row['CNPJ CPF Distribuidor'])
    if (!cnpjRaiz || cnpjRaiz === '00000000') return

    const nomeDist = String(row['Nome Distribuidor'] || '').trim()
    if (!distribuidoresEncontrados.has(cnpjRaiz)) {
      distribuidoresEncontrados.set(cnpjRaiz, {
        cnpj_raiz: cnpjRaiz,
        nome: nomeDist || `Distribuidor ${cnpjRaiz}`,
        uf: String(row['UF Endereço Clientes Solar'] || '').trim().slice(0, 2),
      })
    }

    if (!dedupMap.has(codigo)) {
      const dtCriacao = parseExcelDate(row['Data Criação Projeto Solar'])
      const dtExp = parseExcelDate(row['Data Expiração Projeto Solar'])
      const valorProd = Number(row['Valor Produtos com Desconto']) || 0
      const valorTot = Number(row['Valor Total']) || valorProd

      dedupMap.set(codigo, {
        codigo_projeto: codigo,
        cnpj_raiz: cnpjRaiz,
        cnpj_filial: cnpjFilial,
        etapa_venda: String(row['Etapa Venda Desc Projeto Solar'] || '').trim(),
        potencia_gerador: Number(row['Potência Gerador Projeto Solar']) || 0,
        data_criacao: dtCriacao,
        data_expiracao: dtExp,
        valor_produtos_desconto: valorProd,
        valor_total: valorTot,
        executivo_vendas: String(row['Nome Executivo Vendas'] || '').trim(),
        revenda_cnpj: cleanDigits(row['CNPJ CPF Revenda']),
        revenda_nome: String(row['Nome Revenda'] || '').trim(),
        revenda_classificacao: String(row['Classificação Revenda Desc Projeto Solar'] || '').trim(),
        cliente_proposta: String(row['Cliente Proposta Projeto Solar'] || '').trim(),
        email_proposta: String(row['Email Proposta Projeto Solar'] || '').trim(),
        mes_criacao: getYearMonth(dtCriacao),
      })
    }
  })

  return {
    projetos: Array.from(dedupMap.values()),
    distribuidores: Array.from(distribuidoresEncontrados.values()),
    linhasBrutas: rows.length,
  }
}

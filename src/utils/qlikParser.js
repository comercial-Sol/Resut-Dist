import * as XLSX from 'xlsx'

const COL = {
  codigo: 'Código Venda Projeto Solar',
  cnpjDist: 'CNPJ CPF Distribuidor',
  cnpjRev: 'CNPJ CPF Revenda',
  nomeDist: 'Nome Distribuidor',
  nomeRev: 'Nome Revenda',
  uf: 'UF Endereço Clientes Solar',
}

const text = (v) => {
  if (v === null || v === undefined) return ''
  const s = String(v).trim()
  return s === '-' || s.toLowerCase() === 'nan' ? '' : s
}

function numberValue(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const s = text(v).replace(/\s/g, '')
  if (!s) return 0
  // Qlik exports may use Brazilian decimal comma or standard decimal point.
  if (s.includes(',') && s.includes('.')) {
    return Number(s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '')) || 0
  }
  if (s.includes(',')) return Number(s.replace(',', '.')) || 0
  return Number(s) || 0
}

export function extractCnpjParts(rawCnpj) {
  const digits = text(rawCnpj).replace(/\D/g, '')
  if (!digits || digits.length > 14) return { full: '', raiz: '' }
  const full = digits.padStart(14, '0')
  if (full === '00000000000000') return { full: '', raiz: '' }
  return { full, raiz: full.slice(0, 8) }
}

export function cleanDigits(rawCnpj) {
  const digits = text(rawCnpj).replace(/\D/g, '')
  // A origem mistura CNPJ e CPF em "CNPJ CPF Revenda"; CPF não deve virar CNPJ artificial.
  if (digits.length === 11) return ''
  return extractCnpjParts(rawCnpj).full
}

function parseExcelDate(value) {
  if (value === null || value === undefined || value === '' || value === '-') return null
  let date
  if (value instanceof Date) date = value
  else if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return null
    date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, parsed.S || 0))
  } else {
    const s = String(value).trim()
    const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/)
    if (br) date = new Date(Date.UTC(+br[3], +br[2] - 1, +br[1], +(br[4] || 0), +(br[5] || 0), +(br[6] || 0)))
    else {
      const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?/)
      if (iso) date = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3], +(iso[4] || 0), +(iso[5] || 0), +(iso[6] || 0)))
      else date = new Date(s)
    }
  }
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const ym = (date) => date ? date.slice(0, 7) : null
const first = (...values) => values.find((value) => {
  if (value === null || value === undefined || value === '') return false
  if (typeof value === 'string') return value.trim() !== '' && value.trim() !== '-'
  return true
}) ?? ''

function normalizeHeader(value) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function readRows(file, requiredColumns = []) {
  return file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false, dense: false })
    if (!workbook.SheetNames.length) throw new Error('A planilha não contém abas.')

    const requiredByNormalized = new Map(requiredColumns.map((column) => [normalizeHeader(column), column]))
    let best = null

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true, blankrows: false })
      const scanLimit = Math.min(matrix.length, 50)

      for (let rowIndex = 0; rowIndex < scanLimit; rowIndex++) {
        const headerRow = matrix[rowIndex] || []
        const normalizedHeaders = headerRow.map(normalizeHeader)
        const found = new Set(normalizedHeaders.filter((key) => requiredByNormalized.has(key)))
        const score = found.size
        if (!best || score > best.score) {
          best = { sheetName, matrix, rowIndex, headerRow, score, found }
        }
        if (score === requiredColumns.length) break
      }
      if (best?.score === requiredColumns.length) break
    }

    const missing = requiredColumns.filter((column) => !best?.found.has(normalizeHeader(column)))
    if (!best || best.score === 0) {
      throw new Error('Não foi possível localizar a linha de cabeçalho. Verifique se o arquivo é uma exportação Qlik válida.')
    }
    if (missing.length) {
      throw new Error(`Aba "${best.sheetName}": colunas obrigatórias não localizadas (${best.score}/${requiredColumns.length}): ${missing.join('; ')}. Confira os títulos da exportação Qlik.`)
    }

    const headers = best.headerRow.map((header) => {
      const raw = String(header ?? '').replace(/^\uFEFF/, '').trim()
      return requiredByNormalized.get(normalizeHeader(raw)) || raw
    })
    const rows = []
    for (const cells of best.matrix.slice(best.rowIndex + 1)) {
      if (!cells || cells.every((cell) => cell === null || cell === undefined || String(cell).trim() === '')) continue
      const row = {}
      headers.forEach((header, index) => {
        if (header) row[header] = cells[index] ?? ''
      })
      rows.push(row)
    }
    if (!rows.length) throw new Error(`A aba "${best.sheetName}" contém o cabeçalho, mas não possui linhas de dados.`)
    return rows
  })
}

function mergeRowsByProject(rows, mapper) {
  const grouped = new Map()
  rows.forEach((row) => {
    const code = text(row[COL.codigo])
    if (!code) return
    if (!grouped.has(code)) grouped.set(code, [])
    grouped.get(code).push(row)
  })
  const projects = []
  const invalid = []
  grouped.forEach((group, code) => {
    const base = group[0]
    const dist = extractCnpjParts(first(...group.map(r => r[COL.cnpjDist])))
    if (!dist.raiz) {
      invalid.push(code)
      return
    }
    // Repeated Qlik rows are component/payment expansions. Keep one financial
    // project row; do not sum repeated project totals. Merge complementary text.
    const merged = {}
    const keys = new Set(group.flatMap(Object.keys))
    keys.forEach((key) => { merged[key] = first(...group.map(r => r[key])) })
    projects.push(mapper(merged, dist, group))
  })
  return { projects, invalidCodes: invalid, duplicateGroups: [...grouped.values()].filter(g => g.length > 1).length }
}

function distributorRows(rows) {
  const map = new Map()
  rows.forEach((r) => {
    const { raiz } = extractCnpjParts(r[COL.cnpjDist])
    if (!raiz || map.has(raiz)) return
    map.set(raiz, {
      cnpj_raiz: raiz,
      nome: text(r[COL.nomeDist]) || `Distribuidor ${raiz}`,
      // A exportação Qlik não fornece UF do distribuidor; não usar UF do cliente como substituta.
      uf: '',
    })
  })
  return [...map.values()]
}

export async function parseQlikPagFatFile(file) {
  const rows = await readRows(file, [
    COL.codigo, COL.cnpjDist, COL.cnpjRev, COL.nomeDist, COL.nomeRev,
    'Etapa Venda Desc Projeto Solar', 'Status Projeto Pagamento Projeto Solar',
    'Potência Gerador Projeto Solar', 'Data Criação Projeto Solar',
    'Valor Produtos com Desconto', 'Valor Total',
    'Data Pagamento Projeto Solar', 'Data Emissão Nota Fiscal Projeto Solar',
    'Número Nota Fiscal Projeto Solar', 'Percentual Comissão Distribuidor',
  ])
  const result = mergeRowsByProject(rows, (r, dist, sourceRows) => {
    const created = parseExcelDate(r['Data Criação Projeto Solar'])
    const paid = parseExcelDate(r['Data Pagamento Projeto Solar'])
    const nfDate = parseExcelDate(r['Data Emissão Nota Fiscal Projeto Solar'])
    const status = text(r['Status Projeto Pagamento Projeto Solar'])
    const numNf = text(r['Número Nota Fiscal Projeto Solar'])
    const referenceDate = nfDate || (status === 'Pago' ? paid : null) || created
    return {
      codigo_projeto: text(r[COL.codigo]),
      dados_origem: r,
      cnpj_raiz: dist.raiz,
      cnpj_filial: dist.full,
      nome_distribuidor: text(r[COL.nomeDist]),
      pedido_erp: text(r['Número Pedido ERP Projeto Solar']),
      etapa_venda: text(r['Etapa Venda Desc Projeto Solar']),
      status_pagamento: status,
      potencia_gerador: numberValue(r['Potência Gerador Projeto Solar']),
      data_criacao: created,
      data_pagamento: paid ? paid.slice(0, 10) : null,
      data_emissao_nf: nfDate ? nfDate.slice(0, 10) : null,
      numero_nf: numNf,
      valor_produtos_desconto: numberValue(r['Valor Produtos com Desconto']),
      valor_servico: numberValue(r['Valor Serviço PIS/COFINS']),
      valor_total: numberValue(r['Valor Total']),
      percentual_comissao: numberValue(r['Percentual Comissão Distribuidor']),
      forma_pagamento: text(r['Forma Pagamento Desc Projeto Solar']),
      parcelas: Math.max(1, parseInt(r['Parcelas 1 Projeto Solar'], 10) || 1),
      pagamentos: sourceRows.map((row) => ({
        descricao: text(row['Descrição Forma Pagamento 1 Projeto Solar']) || text(row['Forma Pagamento Desc Projeto Solar']),
        valor: numberValue(row['Valor Pagamento 1']),
        data: parseExcelDate(row['Data Pagamento Projeto Solar']),
        parcelas: parseInt(row['Parcelas 1 Projeto Solar'], 10) || 1,
        bandeira: text(row['Cartão Bandeira 1 Projeto Solar']),
        financeira: text(row['Financeira 1 Projeto Solar']),
        descricao2: text(row['Descrição Forma Pagamento 2 Projeto Solar']),
        valor2: numberValue(row['Valor Pagamento 2']),
        data2: parseExcelDate(row['Data Pagamento 2 Projeto Solar']),
        parcelas2: parseInt(row['Parcelas 2 Projeto Solar'], 10) || 0,
        bandeira2: text(row['Cartão Bandeira 2 Projeto Solar']),
        financeira2: text(row['Financeira 2 Projeto Solar']),
      })).filter((payment, index, list) => list.findIndex((item) => JSON.stringify(item) === JSON.stringify(payment)) === index),
      componentes: sourceRows.map((row) => ({
        id: text(row['Componentes ID Projetos Componentes Solar']),
        modelo: text(row['Modelo Projetos Componentes Solar']),
        quantidade: numberValue(row['Quantidade Projetos Componentes Solar']),
      })).filter((component, index, list) => component.id || component.modelo
        ? list.findIndex((item) => JSON.stringify(item) === JSON.stringify(component)) === index
        : false),
      potencia_inversor: numberValue(r['Potência Inversor Projeto Solar']),
      kwp_produtos: numberValue(r['Kwp Produtos']),
      kwp_servicos: numberValue(r['Kwp Serviços']),
      kwp_projeto: numberValue(r['Kwp Projeto']),
      fator_perdas: numberValue(r['Fator Perdas Projeto Solar']),
      tensao_local: text(r['Tensão Local Desc Projeto Solar']),
      fase_local: text(r['Fase Local Desc Projeto Solar']),
      simultaneidade: numberValue(r['Simultaneidade Projeto Solar']),
      preco_kwh: numberValue(r['Preço KWH Projeto Solar']),
      executivo_vendas: text(r['Nome Executivo Vendas']),
      cliente_nome: text(r['Nome Clientes Solar']),
      cliente_cidade: text(r['Cidade Endereço Clientes Solar']),
      cliente_uf: text(r['UF Endereço Clientes Solar']).slice(0, 2),
      revenda_cnpj: cleanDigits(r[COL.cnpjRev]),
      revenda_nome: text(r[COL.nomeRev]),
      revenda_classificacao: text(r['Classificação Revenda Desc Projeto Solar']),
      mes_referencia: ym(referenceDate),
    }
  })
  return {
    ...result,
    distribuidores: distributorRows(rows),
    linhasBrutas: rows.length,
    projetosUnicos: result.projects.length,
  }
}

export async function parseQlikCriadasFile(file) {
  const rows = await readRows(file, [
    COL.codigo, COL.cnpjDist, COL.cnpjRev, COL.nomeDist, COL.nomeRev,
    'Etapa Venda Desc Projeto Solar', 'Status Projeto Pagamento Projeto Solar',
    'Potência Gerador Projeto Solar', 'Data Criação Projeto Solar',
    'Valor Produtos com Desconto', 'Valor Total',
  ])
  const result = mergeRowsByProject(rows, (r, dist, sourceRows) => {
    const created = parseExcelDate(r['Data Criação Projeto Solar'])
    const expires = parseExcelDate(r['Data Expiração Projeto Solar'])
    return {
      codigo_projeto: text(r[COL.codigo]),
      dados_origem: r,
      cnpj_raiz: dist.raiz,
      cnpj_filial: dist.full,
      etapa_venda: text(r['Etapa Venda Desc Projeto Solar']),
      status_pagamento: text(r['Status Projeto Pagamento Projeto Solar']),
      potencia_gerador: numberValue(r['Potência Gerador Projeto Solar']),
      data_criacao: created,
      data_expiracao: expires,
      valor_produtos_desconto: numberValue(r['Valor Produtos com Desconto']),
      // No Qlik, linhas em Pré-orçamento trazem Valor Total zerado; usar produtos com desconto como valor estimado.
      valor_total: numberValue(r['Valor Total']) || numberValue(r['Valor Produtos com Desconto']),
      executivo_vendas: text(r['Nome Executivo Vendas']),
      revenda_cnpj: cleanDigits(r[COL.cnpjRev]),
      revenda_nome: text(r[COL.nomeRev]),
      revenda_classificacao: text(r['Classificação Revenda Desc Projeto Solar']),
      cliente_proposta: text(r['Cliente Proposta Projeto Solar']),
      email_proposta: text(r['Email Proposta Projeto Solar']),
      mes_criacao: ym(created),
    }
  })
  return {
    ...result,
    distribuidores: distributorRows(rows),
    linhasBrutas: rows.length,
    projetosUnicos: result.projects.length,
  }
}

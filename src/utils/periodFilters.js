export function monthKey(value) {
  const raw = String(value || '').trim()
  const match = raw.match(/^(\d{4})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}` : ''
}

export function rowMonth(row, source = 'pag') {
  if (!row) return ''
  if (source === 'funil') return monthKey(row.mes_criacao || row.data_criacao)
  return monthKey(row.mes_referencia || row.data_faturamento || row.data_emissao_nf || row.data_pagamento || row.data_criacao)
}

export function inSelectedPeriod(row, years, months, source = 'pag') {
  const key = rowMonth(row, source)
  if (!key) return false
  const [year, month] = key.split('-')
  return years.includes(year) && months.includes(month)
}

export function getLatestSelectedMonth(years, months) {
  if (!years.length || !months.length) return ''
  return years.flatMap((year) => months.map((month) => `${year}-${month}`)).sort().at(-1) || ''
}

export function countSelectedMonths(years, months) {
  return years.length * months.length
}

export function periodLabel(years, months) {
  if (years.length === 1 && months.length === 1) return `${months[0]}/${years[0]}`
  if (years.length === 1) return `${months.length} meses de ${years[0]}`
  return `${years.length} anos · ${months.length} meses selecionados`
}

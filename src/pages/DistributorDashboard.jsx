import React, { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  LayoutDashboard, Filter, Receipt, Users, Calculator, BookOpen,
  TrendingUp, Award, CheckCircle2, AlertCircle, Search, Save
} from 'lucide-react'
import {
  formatCurrency, formatPercent, formatCNPJ, getRadisTier, buildRevendasConsolidado
} from '../utils/radisCalculations'
import CartaoSimulator from '../components/CartaoSimulator'
import PoliticaRadisTab from '../components/PoliticaRadisTab'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import PeriodFilter from '../components/PeriodFilter'
import { inSelectedPeriod, rowMonth, getLatestSelectedMonth, countSelectedMonths, periodLabel } from '../utils/periodFilters'

const MESES_LABELS = [
  { num: '01', nome: 'Jan' }, { num: '02', nome: 'Fev' }, { num: '03', nome: 'Mar' },
  { num: '04', nome: 'Abr' }, { num: '05', nome: 'Mai' }, { num: '06', nome: 'Jun' },
  { num: '07', nome: 'Jul' }, { num: '08', nome: 'Ago' }, { num: '09', nome: 'Set' },
  { num: '10', nome: 'Out' }, { num: '11', nome: 'Nov' }, { num: '12', nome: 'Dez' },
]

export default function DistributorDashboard({
  distribuidor,
  projetosPagFat,
  projetosFunil,
  crmRecords = [],
  userEmail,
  onCrmUpdated,
  initialSelectedYears,
  initialSelectedMonths,
  initialPeriodMode,
}) {
  const now = new Date()
  const currentYear = String(now.getFullYear())
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0')
  const [activeTab, setActiveTab] = useState('geral')
  const [selectedYears, setSelectedYears] = useState(initialSelectedYears?.length ? initialSelectedYears : [currentYear])
  const [selectedMonths, setSelectedMonths] = useState(initialSelectedMonths?.length ? initialSelectedMonths : [currentMonth])
  const [periodMode, setPeriodMode] = useState(initialPeriodMode || 'current')
  const [searchRevenda, setSearchRevenda] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('TODOS')
  const [sortRevendas, setSortRevendas] = useState('faturamento_desc')
  const [searchFunil, setSearchFunil] = useState('')
  const [sortFunil, setSortFunil] = useState('valor_desc')
  const [etapaFiltroFunil, setEtapaFiltroFunil] = useState('TODAS')
  const [searchPagFat, setSearchPagFat] = useState('')
  const [sortPagFat, setSortPagFat] = useState('valor_desc')
  const [statusPagFat, setStatusPagFat] = useState('TODOS')
  const [editingCrm, setEditingCrm] = useState({})
  const [savingCnpj, setSavingCnpj] = useState(null)

  const crmMap = useMemo(() => {
    const m = {}
    crmRecords.forEach((r) => { m[r.revenda_cnpj] = r })
    return m
  }, [crmRecords])

  const anosDisponiveis = useMemo(() => {
    const years = new Set([currentYear])
    projetosPagFat.forEach((p) => {
      const year = rowMonth(p, 'pag').slice(0, 4)
      if (year) years.add(year)
    })
    projetosFunil.forEach((f) => {
      const year = rowMonth(f, 'funil').slice(0, 4)
      if (year) years.add(year)
    })
    return [...years].sort((a, b) => Number(b) - Number(a))
  }, [projetosPagFat, projetosFunil, currentYear])

  const periodCaption = periodLabel(selectedYears, selectedMonths)
  const latestSelected = getLatestSelectedMonth(selectedYears, selectedMonths)
  const latestParts = latestSelected.split('-').map(Number)
  const refYear = latestParts[0] || Number(currentYear)
  const refMonth = latestParts[1] || Number(currentMonth)
  const selectedMonthCount = Math.max(1, countSelectedMonths(selectedYears, selectedMonths))

  const projetosPagFatPeriodo = useMemo(
    () => projetosPagFat.filter((p) => inSelectedPeriod(p, selectedYears, selectedMonths, 'pag')),
    [projetosPagFat, selectedYears, selectedMonths]
  )
  const projetosFunilPeriodo = useMemo(
    () => projetosFunil.filter((f) => inSelectedPeriod(f, selectedYears, selectedMonths, 'funil')),
    [projetosFunil, selectedYears, selectedMonths]
  )

  const projetosValidos = useMemo(
    () => projetosPagFatPeriodo.filter((p) => p.status_pagamento !== 'Cancelado'),
    [projetosPagFatPeriodo]
  )
  const projetosFaturados = useMemo(
    () => projetosValidos.filter((p) => Boolean(p.numero_nf) || p.status_pagamento === 'Pago'),
    [projetosValidos]
  )
  const faturamentoPeriodo = projetosFaturados.reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0)
  const ticketMedio = projetosFaturados.length ? faturamentoPeriodo / projetosFaturados.length : 0
  const tierPeriodo = getRadisTier(faturamentoPeriodo / selectedMonthCount, distribuidor?.possui_equipe_3_pessoas)
  const comissaoPeriodo = faturamentoPeriodo * tierPeriodo.comissaoTotal

  const mesesSelecionados = useMemo(
    () => selectedYears.flatMap((year) => selectedMonths.map((month) => `${year}-${month}`)).sort(),
    [selectedYears, selectedMonths]
  )
  const dadosMensais = useMemo(() => mesesSelecionados.map((ym) => {
    const [year, month] = ym.split('-')
    const monthName = MESES_LABELS.find((m) => m.num === month)?.nome || month
    const realizado = projetosPagFat.filter((p) =>
      rowMonth(p, 'pag') === ym &&
      p.status_pagamento !== 'Cancelado' &&
      (Boolean(p.numero_nf) || p.status_pagamento === 'Pago')
    ).reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0)
    const meta = Number(distribuidor?.metas_mensais?.[ym]) || 0
    return { mes: `${monthName}/${year}`, ym, Realizado: realizado, Meta: meta }
  }), [mesesSelecionados, projetosPagFat, distribuidor])

  // Status da revenda usa histórico completo até o último mês selecionado.
  // Valores e quantidades exibidos respeitam o período escolhido.
  const revendasHistorico = useMemo(() => buildRevendasConsolidado(
    projetosPagFat, projetosFunil, crmMap, refYear, refMonth
  ), [projetosPagFat, projetosFunil, crmMap, refYear, refMonth])

  const revendas = useMemo(() => {
    const pagMap = new Map()
    projetosFaturados.forEach((p) => {
      const cnpj = String(p.revenda_cnpj || '').replace(/\\D/g, '')
      if (!cnpj) return
      const item = pagMap.get(cnpj) || { total_faturado: 0, qtd_projetos_vendidos: 0 }
      item.total_faturado += Number(p.valor_total) || 0
      item.qtd_projetos_vendidos += 1
      pagMap.set(cnpj, item)
    })
    const funilMap = new Map()
    projetosFunilPeriodo.forEach((f) => {
      const cnpj = String(f.revenda_cnpj || '').replace(/\\D/g, '')
      if (cnpj) funilMap.set(cnpj, (funilMap.get(cnpj) || 0) + 1)
    })
    return revendasHistorico.map((r) => ({
      ...r,
      total_faturado: pagMap.get(r.revenda_cnpj)?.total_faturado || 0,
      qtd_projetos_vendidos: pagMap.get(r.revenda_cnpj)?.qtd_projetos_vendidos || 0,
      qtd_propostas_criadas: funilMap.get(r.revenda_cnpj) || 0,
    }))
  }, [revendasHistorico, projetosFaturados, projetosFunilPeriodo])

  const qtdAtivas = revendas.filter((r) => r.status === 'Ativa' || r.status === 'Recorrente').length
  const qtdRecorrentes = revendas.filter((r) => r.status === 'Recorrente').length
  const bateuBonusAtivas = qtdAtivas >= tierPeriodo.minAtivas
  const bateuBonusRecorrentes = qtdRecorrentes >= tierPeriodo.minRecorrentes

  const projetosFunilAbertos = useMemo(() => projetosFunilPeriodo.filter((f) => {
    const status = String(f.status_pagamento || '').trim().toLowerCase()
    const etapa = String(f.etapa_venda || '').trim().toLowerCase()
    return !['pago', 'cancelado', 'recusado'].includes(status) && etapa !== 'projeto cancelado'
  }), [projetosFunilPeriodo])

  const preOrcamentoMes = projetosFunilAbertos
    .filter((f) => f.etapa_venda?.toLowerCase() === 'pré-orçamento')
    .reduce((acc, f) => acc + (Number(f.valor_total) || 0), 0)
  const carteiraNaoFaturada = projetosValidos
    .filter((p) => !p.numero_nf && p.status_pagamento !== 'Pago')
    .reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0)
  const jaConvertidoMes = faturamentoPeriodo
  const possibilidadeConversao = preOrcamentoMes * 0.1
  const projetosPorRevendaAtiva = qtdAtivas > 0 ? projetosValidos.length / qtdAtivas : 0

  const funilFiltrado = useMemo(() => {
    const search = searchFunil.trim().toLowerCase()
    const rows = projetosFunilAbertos.filter((f) => {
      const matchesText = !search || [
        f.codigo_projeto, f.revenda_nome, f.revenda_cnpj, f.cliente_proposta, f.executivo_vendas, f.etapa_venda
      ].some((value) => String(value || '').toLowerCase().includes(search))
      const matchesStage = etapaFiltroFunil === 'TODAS' || f.etapa_venda === etapaFiltroFunil
      return matchesText && matchesStage
    })
    return rows.sort((a, b) => {
      if (sortFunil === 'valor_asc') return (Number(a.valor_total) || 0) - (Number(b.valor_total) || 0)
      if (sortFunil === 'data_desc') return String(b.data_criacao || '').localeCompare(String(a.data_criacao || ''))
      if (sortFunil === 'data_asc') return String(a.data_criacao || '').localeCompare(String(b.data_criacao || ''))
      return (Number(b.valor_total) || 0) - (Number(a.valor_total) || 0)
    })
  }, [projetosFunilAbertos, searchFunil, etapaFiltroFunil, sortFunil])

  const pagFatFiltrado = useMemo(() => {
    const search = searchPagFat.trim().toLowerCase()
    const rows = projetosValidos.filter((p) => {
      const matchesText = !search || [
        p.codigo_projeto, p.pedido_erp, p.revenda_nome, p.revenda_cnpj, p.cliente_nome, p.numero_nf, p.status_pagamento
      ].some((value) => String(value || '').toLowerCase().includes(search))
      const matchesStatus = statusPagFat === 'TODOS' ||
        (statusPagFat === 'FATURADO' ? Boolean(p.numero_nf) :
          statusPagFat === 'CARTEIRA' ? !p.numero_nf && p.status_pagamento !== 'Pago' :
            String(p.status_pagamento || '').toUpperCase() === statusPagFat)
      return matchesText && matchesStatus
    })
    return rows.sort((a, b) => {
      if (sortPagFat === 'valor_asc') return (Number(a.valor_total) || 0) - (Number(b.valor_total) || 0)
      if (sortPagFat === 'data_desc') return String(b.data_emissao_nf || b.data_pagamento || b.data_criacao || '').localeCompare(String(a.data_emissao_nf || a.data_pagamento || a.data_criacao || ''))
      if (sortPagFat === 'data_asc') return String(a.data_emissao_nf || a.data_pagamento || a.data_criacao || '').localeCompare(String(b.data_emissao_nf || b.data_pagamento || b.data_criacao || ''))
      return (Number(b.valor_total) || 0) - (Number(a.valor_total) || 0)
    })
  }, [projetosValidos, searchPagFat, statusPagFat, sortPagFat])

  const handleSaveCrm = async (revendaCnpj) => {
    const draft = editingCrm[revendaCnpj]
    if (!draft) return
    setSavingCnpj(revendaCnpj)
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('revendas_crm').upsert({
          cnpj_raiz: distribuidor.cnpj_raiz,
          revenda_cnpj: revendaCnpj,
          data_ultimo_contato: draft.data_ultimo_contato || null,
          observacoes: draft.observacoes || '',
          atualizado_por: userEmail,
          atualizado_em: new Date().toISOString(),
        }, { onConflict: 'cnpj_raiz,revenda_cnpj' })
        if (error) throw error
        if (onCrmUpdated) onCrmUpdated()
      }
      alert('Registro de contato salvo com sucesso!')
    } catch (err) {
      alert('Erro ao salvar contato: ' + err.message)
    } finally {
      setSavingCnpj(null)
    }
  }

  const revendasFiltradas = revendas.filter((r) => {
    const matchText =
      r.revenda_nome.toLowerCase().includes(searchRevenda.toLowerCase()) ||
      r.revenda_cnpj.includes(searchRevenda)
    const matchStatus = statusFiltro === 'TODOS' || r.status === statusFiltro
    return matchText && matchStatus
  }).sort((a, b) => {
    if (sortRevendas === 'status') return a.status.localeCompare(b.status) || b.total_faturado - a.total_faturado
    if (sortRevendas === 'projetos') return (b.qtd_projetos_vendidos + b.qtd_propostas_criadas) - (a.qtd_projetos_vendidos + a.qtd_propostas_criadas)
    if (sortRevendas === 'faturamento_asc') return a.total_faturado - b.total_faturado
    return b.total_faturado - a.total_faturado
  })

  const tabs = [
    { id: 'geral', label: 'Painel Geral', icon: LayoutDashboard },
    { id: 'funil', label: `Funil de Vendas (${projetosFunilAbertos.length})`, icon: Filter },
    { id: 'pagfat', label: `PAG & FAT (${projetosValidos.length})`, icon: Receipt },
    { id: 'revendas', label: `Revendas (${revendas.length})`, icon: Users },
    { id: 'simulador', label: 'Simulador Cartão', icon: Calculator },
    { id: 'politica', label: 'Política RADIS', icon: BookOpen },
  ]

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Distribuidor */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-bold">
              SAP {distribuidor?.cod_sap || '-'}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Raiz CNPJ: {distribuidor?.cnpj_raiz} (Matriz + Filiais Consolidadas)
            </span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 mt-1">{distribuidor?.nome}</h1>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase text-slate-500">Filtros aplicados em todas as abas</p>
            <PeriodFilter
              yearsAvailable={anosDisponiveis}
              selectedYears={selectedYears}
              selectedMonths={selectedMonths}
              periodMode={periodMode}
              onChange={({ selectedYears: years, selectedMonths: months, periodMode: mode }) => {
                setSelectedYears(years)
                setSelectedMonths(months)
                setPeriodMode(mode)
              }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-500">{periodCaption}</span>
        </div>
      </div>

      {/* Navegação por Abas (Espelho da Planilha) */}
      <div className="flex overflow-x-auto gap-2 border-b border-slate-200 pb-2">
        {tabs.map((t) => {
          const Icon = t.icon
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition ${
                active
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ABA 1: PAINEL GERAL */}
      {activeTab === 'geral' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase text-slate-500">Comissão RADIS · {periodCaption}</span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900">{formatPercent(tierPeriodo.comissaoTotal)}</span>
                  <span className="text-xs text-slate-500">({formatPercent(tierPeriodo.comissaoBase)} base + {formatPercent(tierPeriodo.bonusEquipe)} equipe)</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Faturamento reconhecido no período: <strong className="text-slate-800">{formatCurrency(faturamentoPeriodo)}</strong> · média mensal: {formatCurrency(faturamentoPeriodo / selectedMonthCount)}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500">Comissão estimada</span>
                <div className="text-2xl font-extrabold text-emerald-700">{formatCurrency(comissaoPeriodo)}</div>
              </div>
            </div>
          </div>

          {/* Cards de Gatilhos de Bônus RADIS (Revendas Ativas & Recorrentes) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`rounded-xl border p-5 shadow-sm ${bateuBonusAtivas ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase text-slate-500">Gatilho Revendas Ativas (Últimos 3 meses)</span>
                  <div className="flex items-baseline gap-3 mt-1">
                    <span className="text-3xl font-extrabold text-slate-900">{qtdAtivas}</span>
                    <span className="text-sm text-slate-600">/ mínimo {tierPeriodo.minAtivas} ({tierPeriodo.labelFaixa})</span>
                  </div>
                </div>
                <div className="text-right">
                  {bateuBonusAtivas ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white">
                      <CheckCircle2 className="w-4 h-4" /> Bônus R$ 3.500 Conquistado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                      <AlertCircle className="w-4 h-4" /> Faltam {tierPeriodo.minAtivas - qtdAtivas} revendas
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className={`rounded-xl border p-5 shadow-sm ${bateuBonusRecorrentes ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase text-slate-500">Gatilho Revendas Recorrentes (6 meses seguidos)</span>
                  <div className="flex items-baseline gap-3 mt-1">
                    <span className="text-3xl font-extrabold text-slate-900">{qtdRecorrentes}</span>
                    <span className="text-sm text-slate-600">/ mínimo {tierPeriodo.minRecorrentes} ({tierPeriodo.labelFaixa})</span>
                  </div>
                </div>
                <div className="text-right">
                  {bateuBonusRecorrentes ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white">
                      <CheckCircle2 className="w-4 h-4" /> Bônus R$ 3.500 Conquistado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                      <AlertCircle className="w-4 h-4" /> Faltam {tierPeriodo.minRecorrentes - qtdRecorrentes} revendas
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* KPIs Operacionais (Pré-Orçamento, Carteira, Possibilidade de Conversão, Ticket Médio) */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 block">Pré-Orçamento ({periodCaption})</span>
              <span className="text-lg font-extrabold text-slate-900 mt-1 block">{formatCurrency(preOrcamentoMes)}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 block">Carteira (Aguardando NF)</span>
              <span className="text-lg font-extrabold text-amber-600 mt-1 block">{formatCurrency(carteiraNaoFaturada)}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 block">Já Convertido (Período)</span>
              <span className="text-lg font-extrabold text-emerald-600 mt-1 block">{formatCurrency(jaConvertidoMes)}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 block">Possibilidade Conversão (10%)</span>
              <span className={`text-lg font-extrabold mt-1 block ${possibilidadeConversao >= 0 ? 'text-blue-600' : 'text-slate-600'}`}>
                {formatCurrency(possibilidadeConversao)}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 block">Ticket Médio</span>
              <span className="text-lg font-extrabold text-slate-900 mt-1 block">{formatCurrency(ticketMedio)}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 block">Projetos / Revenda Ativa</span>
              <span className="text-lg font-extrabold text-slate-900 mt-1 block">{projetosPorRevendaAtiva.toFixed(1)}</span>
            </div>
          </div>

          {/* Gráfico Faturamento Realizado vs Meta */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900">Evolução de Faturamento: Realizado vs. Meta ({periodCaption})</h3>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosMensais}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="Meta" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Realizado" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: FUNIL DE VENDAS */}
      {activeTab === 'funil' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-amber-50/60">
            <h3 className="font-bold text-slate-900">Funil de Vendas — Projetos Criados em Aberto</h3>
            <p className="text-xs text-slate-600 mt-1">
              Dica comercial: Foque nos projetos de maior valor e agrupe propostas da mesma revenda para negociação em lote.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
            <input value={searchFunil} onChange={(e) => setSearchFunil(e.target.value)} placeholder="Buscar código, revenda, cliente ou executivo" className="min-w-56 rounded-lg border border-slate-300 px-3 py-2 text-xs" />
            <select value={etapaFiltroFunil} onChange={(e) => setEtapaFiltroFunil(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs"><option value="TODAS">Todas as etapas</option>{[...new Set(projetosFunilAbertos.map((f) => f.etapa_venda).filter(Boolean))].sort().map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select>
            <select value={sortFunil} onChange={(e) => setSortFunil(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs"><option value="valor_desc">Maior proposta</option><option value="valor_asc">Menor proposta</option><option value="data_desc">Mais recentes</option><option value="data_asc">Mais antigas</option></select>
            <span className="text-xs text-slate-500">{funilFiltrado.length} projetos no período</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-800 text-white text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">Código Projeto</th>
                  <th className="px-4 py-3">Data Criação</th>
                  <th className="px-4 py-3">Etapa</th>
                  <th className="px-4 py-3">Potência (kWp)</th>
                  <th className="px-4 py-3">Valor Total</th>
                  <th className="px-4 py-3">Revenda</th>
                  <th className="px-4 py-3">Cliente Proposta</th>
                  <th className="px-4 py-3">Executivo (EV)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {funilFiltrado.slice(0, 150).map((f) => (
                  <tr key={f.codigo_projeto} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-800">{f.codigo_projeto}</td>
                    <td className="px-4 py-3 text-slate-600">{f.data_criacao ? f.data_criacao.slice(0, 10) : '-'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        {f.etapa_venda}
                      </span>
                    </td>
                    <td className="px-4 py-3">{Number(f.potencia_gerador).toFixed(2)} kWp</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{formatCurrency(f.valor_total)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{f.revenda_nome || '-'}</div>
                      <div className="text-xs text-slate-500">{formatCNPJ(f.revenda_cnpj)}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{f.cliente_proposta || '-'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{f.executivo_vendas || '-'}</td>
                  </tr>
                ))}
                {projetosFunilAbertos.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                      Nenhum projeto no funil encontrado para este distribuidor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 3: PAG & FAT */}
      {activeTab === 'pagfat' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h3 className="font-bold text-slate-900">PAG & FAT — Projetos Pagos e Faturados (Matriz + Filiais)</h3>
            <p className="text-xs text-slate-500 mt-1">
              Projetos financiados têm a comissão liberada após emissão da NF e saída da mercadoria.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
            <input value={searchPagFat} onChange={(e) => setSearchPagFat(e.target.value)} placeholder="Buscar projeto, NF, revenda ou cliente" className="min-w-56 rounded-lg border border-slate-300 px-3 py-2 text-xs" />
            <select value={statusPagFat} onChange={(e) => setStatusPagFat(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs"><option value="TODOS">Todos os status</option><option value="FATURADO">Faturado</option><option value="CARTEIRA">Aguardando NF</option><option value="PAGO">Pago</option><option value="PENDENTE">Pendente</option><option value="CANCELADO">Cancelado</option></select>
            <select value={sortPagFat} onChange={(e) => setSortPagFat(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs"><option value="valor_desc">Maior valor</option><option value="valor_asc">Menor valor</option><option value="data_desc">Data mais recente</option><option value="data_asc">Data mais antiga</option></select>
            <span className="text-xs text-slate-500">{pagFatFiltrado.length} projetos no período</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-800 text-white text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">Faturado?</th>
                  <th className="px-4 py-3">CNPJ Filial</th>
                  <th className="px-4 py-3">Projeto / Pedido</th>
                  <th className="px-4 py-3">Potência</th>
                  <th className="px-4 py-3">Valor Total</th>
                  <th className="px-4 py-3">Revenda</th>
                  <th className="px-4 py-3">Cliente Pagador</th>
                  <th className="px-4 py-3">Pagamento</th>
                  <th className="px-4 py-3">NF / Emissão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagFatFiltrado.slice(0, 200).map((p) => {
                  const faturado = Boolean(p.numero_nf)
                  return (
                    <tr key={p.codigo_projeto} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${faturado ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {faturado ? 'SIM' : 'CARTEIRA'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{formatCNPJ(p.cnpj_filial)}</td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs font-bold text-slate-900">{p.codigo_projeto}</div>
                        <div className="text-xs text-slate-500">ERP: {p.pedido_erp || '-'}</div>
                      </td>
                      <td className="px-4 py-3">{Number(p.potencia_gerador).toFixed(2)} kWp</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{formatCurrency(p.valor_total)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{p.revenda_nome}</div>
                        <div className="text-xs text-slate-500">{p.revenda_classificacao}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-800">{p.cliente_nome}</div>
                        <div className="text-xs text-slate-500">{p.cliente_cidade}/{p.cliente_uf}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-semibold text-slate-800">{p.status_pagamento}</div>
                        <div className="text-slate-500">{p.forma_pagamento}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-bold text-slate-800">{p.numero_nf ? `NF ${p.numero_nf}` : 'Aguardando NF'}</div>
                        <div className="text-slate-500">{p.data_emissao_nf || p.data_pagamento || '-'}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 4: GESTÃO DE REVENDAS + CRM */}
      {activeTab === 'revendas' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900">Gestão da Carteira de Revendas</h3>
              <p className="text-xs text-slate-500">
                Recorrente (6 meses seguidos) • Ativa (últimos 3 meses) • Regular (3 a 6 meses) • Inativa (+6 meses)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar revenda ou CNPJ..."
                  value={searchRevenda}
                  onChange={(e) => setSearchRevenda(e.target.value)}
                  className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <select value={sortRevendas} onChange={(e) => setSortRevendas(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium"><option value="faturamento_desc">Maior faturamento</option><option value="faturamento_asc">Menor faturamento</option><option value="status">Status</option><option value="projetos">Mais projetos/propostas</option></select>
              <select
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium"
              >
                <option value="TODOS">Todos os Status</option>
                <option value="Recorrente">Recorrente</option>
                <option value="Ativa">Ativa</option>
                <option value="Regular">Regular</option>
                <option value="Inativa">Inativa</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-800 text-white text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">Revenda / CNPJ</th>
                  <th className="px-4 py-3">Status RADIS</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Projetos / Propostas</th>
                  <th className="px-4 py-3">Total Comprado</th>
                  <th className="px-4 py-3">Data Contato (CRM)</th>
                  <th className="px-4 py-3">Observações</th>
                  <th className="px-4 py-3">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {revendasFiltradas.map((r) => {
                  const draft = editingCrm[r.revenda_cnpj] || {
                    data_ultimo_contato: r.data_ultimo_contato,
                    observacoes: r.observacoes,
                  }
                  const badgeColor = {
                    Recorrente: 'bg-emerald-100 text-emerald-800',
                    Ativa: 'bg-blue-100 text-blue-800',
                    Regular: 'bg-amber-100 text-amber-800',
                    Inativa: 'bg-slate-200 text-slate-700',
                  }[r.status]

                  return (
                    <tr key={r.revenda_cnpj} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{r.revenda_nome}</div>
                        <div className="text-xs text-slate-500">{formatCNPJ(r.revenda_cnpj)} • {r.cidade}/{r.uf}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${badgeColor}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-700">{r.classificacao_intelbras}</td>
                      <td className="px-4 py-3 text-xs">
                        <div><strong>{r.qtd_projetos_vendidos}</strong> fechados</div>
                        <div className="text-slate-500">{r.qtd_propostas_criadas} propostas</div>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">{formatCurrency(r.total_faturado)}</td>
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          value={draft.data_ultimo_contato || ''}
                          onChange={(e) =>
                            setEditingCrm({
                              ...editingCrm,
                              [r.revenda_cnpj]: { ...draft, data_ultimo_contato: e.target.value },
                            })
                          }
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          placeholder="Anotar negociação..."
                          value={draft.observacoes || ''}
                          onChange={(e) =>
                            setEditingCrm({
                              ...editingCrm,
                              [r.revenda_cnpj]: { ...draft, observacoes: e.target.value },
                            })
                          }
                          className="w-48 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleSaveCrm(r.revenda_cnpj)}
                          disabled={savingCnpj === r.revenda_cnpj}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                        >
                          <Save className="w-3.5 h-3.5" />
                          Salvar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 5: SIMULADOR DE CARTÃO */}
      {activeTab === 'simulador' && <CartaoSimulator />}

      {/* ABA 6: POLÍTICA RADIS */}
      {activeTab === 'politica' && <PoliticaRadisTab possuiEquipe={distribuidor?.possui_equipe_3_pessoas} />}
    </div>
  )
}

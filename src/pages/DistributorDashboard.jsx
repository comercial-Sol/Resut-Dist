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
}) {
  const [activeTab, setActiveTab] = useState('geral')
  const [anoSelecionado, setAnoSelecionado] = useState('2026')
  const [mesVigente, setMesVigente] = useState('11')
  const [searchRevenda, setSearchRevenda] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('TODOS')
  const [editingCrm, setEditingCrm] = useState({})
  const [savingCnpj, setSavingCnpj] = useState(null)

  const crmMap = useMemo(() => {
    const m = {}
    crmRecords.forEach((r) => { m[r.revenda_cnpj] = r })
    return m
  }, [crmRecords])

  // Faturamento mensal Realizado vs Meta
  const dadosMensais = useMemo(() => {
    return MESES_LABELS.map((m) => {
      const ym = `${anoSelecionado}-${m.num}`
      const realizado = projetosPagFat
        .filter((p) => p.mes_referencia === ym && p.status_pagamento !== 'Cancelado' && (p.numero_nf || p.status_pagamento === 'Pago'))
        .reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0)
      const meta = Number(distribuidor?.metas_mensais?.[ym]) || 0
      return {
        mes: `${m.nome}/${anoSelecionado.slice(2)}`,
        ym,
        Realizado: realizado,
        Meta: meta,
      }
    })
  }, [projetosPagFat, distribuidor, anoSelecionado])

  // Cálculos dos 4 Trimestres (Comissão RADIS)
  const trimestres = useMemo(() => {
    const qDefs = [
      { id: 1, nome: '1º Trimestre', meses: ['01', '02', '03'] },
      { id: 2, nome: '2º Trimestre', meses: ['04', '05', '06'] },
      { id: 3, nome: '3º Trimestre', meses: ['07', '08', '09'] },
      { id: 4, nome: '4º Trimestre', meses: ['10', '11', '12'] },
    ]
    return qDefs.map((q) => {
      const soma = q.meses.reduce((acc, mNum) => {
        const found = dadosMensais.find((d) => d.ym === `${anoSelecionado}-${mNum}`)
        return acc + (found ? found.Realizado : 0)
      }, 0)
      const mediaMensal = soma / 3
      const tier = getRadisTier(mediaMensal, distribuidor?.possui_equipe_3_pessoas)
      return {
        ...q,
        soma,
        mediaMensal,
        ...tier,
        valorComissaoEstimada: soma * tier.comissaoTotal,
      }
    })
  }, [dadosMensais, anoSelecionado, distribuidor])

  // Trimestre atual baseado no mês selecionado
  const trimestreAtual = useMemo(() => {
    const mInt = parseInt(mesVigente, 10)
    const qIdx = Math.floor((mInt - 1) / 3)
    return trimestres[qIdx] || trimestres[0]
  }, [mesVigente, trimestres])

  // Revendas consolidadas
  const revendas = useMemo(() => {
    return buildRevendasConsolidado(
      projetosPagFat,
      projetosFunil,
      crmMap,
      parseInt(anoSelecionado, 10),
      parseInt(mesVigente, 10)
    )
  }, [projetosPagFat, projetosFunil, crmMap, anoSelecionado, mesVigente])

  const qtdAtivas = revendas.filter((r) => r.status === 'Ativa' || r.status === 'Recorrente').length
  const qtdRecorrentes = revendas.filter((r) => r.status === 'Recorrente').length

  const bateuBonusAtivas = qtdAtivas >= trimestreAtual.minAtivas
  const bateuBonusRecorrentes = qtdRecorrentes >= trimestreAtual.minRecorrentes

  // Indicadores do Painel Geral (Funil, Carteira, Possibilidade de Conversão, Ticket Médio)
  const ymVigente = `${anoSelecionado}-${mesVigente}`
  const preOrcamentoMes = projetosFunil
    .filter((f) => f.mes_criacao === ymVigente)
    .reduce((acc, f) => acc + (Number(f.valor_total) || 0), 0)

  const carteiraNaoFaturada = projetosPagFat
    .filter((p) => p.status_pagamento !== 'Cancelado' && !p.numero_nf && p.status_pagamento !== 'Pago')
    .reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0)

  const jaConvertidoMes = dadosMensais.find((d) => d.ym === ymVigente)?.Realizado || 0
  const possibilidadeConversao = preOrcamentoMes * 0.1 - (jaConvertidoMes + carteiraNaoFaturada)

  const projetosValidos = projetosPagFat.filter((p) => p.status_pagamento !== 'Cancelado')
  const totalFaturadoGeral = projetosValidos.reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0)
  const ticketMedio = projetosValidos.length > 0 ? totalFaturadoGeral / projetosValidos.length : 0
  const projetosPorRevendaAtiva = qtdAtivas > 0 ? projetosValidos.length / qtdAtivas : 0

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
  })

  const tabs = [
    { id: 'geral', label: 'Painel Geral', icon: LayoutDashboard },
    { id: 'funil', label: `Funil de Vendas (${projetosFunil.length})`, icon: Filter },
    { id: 'pagfat', label: `PAG & FAT (${projetosValidos.length})`, icon: Receipt },
    { id: 'revendas', label: `Revendas (${revendas.length})`, icon: Users },
    { id: 'simulador', label: 'Simulador Cartão', icon: Calculator },
    { id: 'politica', label: 'Política RADIS', icon: BookOpen },
  ]

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Distribuidor */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
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

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase">Ano</label>
            <select
              value={anoSelecionado}
              onChange={(e) => setAnoSelecionado(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold bg-white"
            >
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase">Mês Referência</label>
            <select
              value={mesVigente}
              onChange={(e) => setMesVigente(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold bg-white"
            >
              {MESES_LABELS.map((m) => (
                <option key={m.num} value={m.num}>{m.nome}/{anoSelecionado}</option>
              ))}
            </select>
          </div>
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
          {/* Cards dos 4 Trimestres (Comissão RADIS) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {trimestres.map((q) => (
              <div key={q.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase text-slate-500">{q.nome}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                    {q.labelFaixa}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-slate-900">
                    {formatPercent(q.comissaoTotal)}
                  </span>
                  <span className="text-xs text-slate-500">
                    ({formatPercent(q.comissaoBase)} + {formatPercent(q.bonusEquipe)} eq.)
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Faturado Tri: <strong className="text-slate-700">{formatCurrency(q.soma)}</strong>
                </p>
                <p className="text-xs text-emerald-700 font-semibold mt-0.5">
                  Comissão Est.: {formatCurrency(q.valorComissaoEstimada)}
                </p>
              </div>
            ))}
          </div>

          {/* Cards de Gatilhos de Bônus RADIS (Revendas Ativas & Recorrentes) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`rounded-xl border p-5 shadow-sm ${bateuBonusAtivas ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase text-slate-500">Gatilho Revendas Ativas (Últimos 3 meses)</span>
                  <div className="flex items-baseline gap-3 mt-1">
                    <span className="text-3xl font-extrabold text-slate-900">{qtdAtivas}</span>
                    <span className="text-sm text-slate-600">/ mínimo {trimestreAtual.minAtivas} ({trimestreAtual.labelFaixa})</span>
                  </div>
                </div>
                <div className="text-right">
                  {bateuBonusAtivas ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white">
                      <CheckCircle2 className="w-4 h-4" /> Bônus R$ 3.500 Conquistado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                      <AlertCircle className="w-4 h-4" /> Faltam {trimestreAtual.minAtivas - qtdAtivas} revendas
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
                    <span className="text-sm text-slate-600">/ mínimo {trimestreAtual.minRecorrentes} ({trimestreAtual.labelFaixa})</span>
                  </div>
                </div>
                <div className="text-right">
                  {bateuBonusRecorrentes ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white">
                      <CheckCircle2 className="w-4 h-4" /> Bônus R$ 3.500 Conquistado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                      <AlertCircle className="w-4 h-4" /> Faltam {trimestreAtual.minRecorrentes - qtdRecorrentes} revendas
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* KPIs Operacionais (Pré-Orçamento, Carteira, Possibilidade de Conversão, Ticket Médio) */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 block">Pré-Orçamento ({mesVigente}/{anoSelecionado})</span>
              <span className="text-lg font-extrabold text-slate-900 mt-1 block">{formatCurrency(preOrcamentoMes)}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 block">Carteira (Aguardando NF)</span>
              <span className="text-lg font-extrabold text-amber-600 mt-1 block">{formatCurrency(carteiraNaoFaturada)}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 block">Já Convertido (Mês)</span>
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
              <h3 className="font-bold text-slate-900">Evolução de Faturamento: Realizado vs. Meta ({anoSelecionado})</h3>
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
                {projetosFunil.slice(0, 150).map((f) => (
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
                {projetosFunil.length === 0 && (
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
                {projetosValidos.slice(0, 200).map((p) => {
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

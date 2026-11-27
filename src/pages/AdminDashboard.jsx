import React, { useState, useMemo, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import {
  Building2, Upload, UserPlus, Eye, CheckCircle2, ShieldCheck, DollarSign, Users
} from 'lucide-react'
import {
  formatCurrency, formatPercent, getRadisTier, buildRevendasConsolidado
} from '../utils/radisCalculations'
import { parseQlikPagFatFile, parseQlikCriadasFile } from '../utils/qlikParser'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import DistributorDashboard from './DistributorDashboard'

export default function AdminDashboard({
  distribuidores,
  projetosPagFat,
  projetosFunil,
  usuariosAcesso = [],
  userEmail,
  onDataRefresh,
}) {
  const [adminTab, setAdminTab] = useState('consolidado')
  const [previewDistCnpj, setPreviewDistCnpj] = useState(null)
  const [anoRef, setAnoRef] = useState(String(new Date().getFullYear()))
  const [mesRef, setMesRef] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))

  // Upload states
  const [uploadingPag, setUploadingPag] = useState(false)
  const [uploadingCri, setUploadingCri] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')

  // Novo usuário state
  const [novoEmail, setNovoEmail] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [novoCargo, setNovoCargo] = useState('Vendedor')
  const [novoPerfil, setNovoPerfil] = useState('distribuidor')
  const [novoCnpjRaiz, setNovoCnpjRaiz] = useState(distribuidores[0]?.cnpj_raiz || '')
  const [solicitacoes, setSolicitacoes] = useState([])
  const [loadingSolicitacoes, setLoadingSolicitacoes] = useState(false)
  const [solicitacaoStatus, setSolicitacaoStatus] = useState('')
  const [solicitacaoCnpj, setSolicitacaoCnpj] = useState({})
  const [solicitacaoCargo, setSolicitacaoCargo] = useState({})
  const [solicitacaoSenha, setSolicitacaoSenha] = useState({})
  const [processingRequest, setProcessingRequest] = useState('')


  // Tratamento e Filtragem de Dados com as Regras Solicitadas
  const projetosProcessados = useMemo(() => {
    if (!projetosPagFat) return []
    // Remove códigos de projetos duplicados baseados no código da venda
    const unicos = Array.from(
      new Map(projetosPagFat.map(item => [item.codigo_projeto, item])).values()
    )
    return unicos.map(p => {
      // Garante os 8 dígitos da raiz do CNPJ
      const cnpjLimpo = p.cnpj_raiz ? String(p.cnpj_raiz).replace(/\D/g, '') : ''
      const cnpjRaiz8 = cnpjLimpo.substring(0, 8)

      // Comissão = % Comissão * Valor Produtos com Desconto
      const percComissao = Number(p.percentual_comissao) || 0
      const valProdDesc = Number(p.valor_produtos_com_desconto) || Number(p.valor_produtos) || 0
      const comissaoCalculada = percComissao * valProdDesc

      return {
        ...p,
        cnpj_raiz: cnpjRaiz8,
        valor_total: Number(p.valor_total) || 0,
        comissao_calculada: comissaoCalculada,
        // Data de faturamento considerada pela data de emissão da nota fiscal
        data_faturamento: p.data_emissao_nf || p.data_pagamento || p.data_criacao
      }
    })
  }, [projetosPagFat])

  const anosDisponiveis = useMemo(() => {
    const years = new Set([String(new Date().getFullYear())])
    projetosProcessados.forEach((p) => {
      const year = p.data_faturamento?.slice(0, 4)
      if (year && /^\d{4}$/.test(year)) years.add(year)
    })
    return [...years].sort((a, b) => Number(b) - Number(a))
  }, [projetosProcessados])

  // Consolidação de métricas por distribuidor
  const resumoCanais = useMemo(() => {
    const mInt = parseInt(mesRef, 10)
    const latestYear = projetosProcessados.reduce((max, p) => {
      const year = Number(p.data_faturamento?.slice(0, 4)) || 0
      return Math.max(max, year)
    }, new Date().getFullYear())
    const anoCalculo = anoRef === 'TODOS' ? latestYear : Number(anoRef)
    const qStart = Math.floor((mInt - 1) / 3) * 3 + 1
    const qMeses = [qStart, qStart + 1, qStart + 2].map((m) => `${anoCalculo}-${String(m).padStart(2, '0')}`)

    return distribuidores.map((dist) => {
      const pags = projetosProcessados.filter((p) => p.cnpj_raiz === dist.cnpj_raiz && p.status_pagamento !== 'Cancelado')
      const funis = projetosFunil.filter((f) => {
        const fCnpj = f.cnpj_raiz ? String(f.cnpj_raiz).replace(/\D/g, '').substring(0, 8) : ''
        return fCnpj === dist.cnpj_raiz
      })

  // Faturamento Ano (considera o filtro selecionado ou soma tudo se for 'TODOS')
      const fatAno = pags
        .filter((p) => {
          const temValidacaoPagto = (p.numero_nf || p.status_pagamento === 'Pago');
          if (anoRef === 'TODOS') return temValidacaoPagto;
          return p.data_faturamento?.startsWith(anoRef) && temValidacaoPagto;
        })
        .reduce((acc, p) => acc + p.valor_total, 0)

      // Faturamento Trimestre Atual
      const fatTri = pags
        .filter((p) => qMeses.some(m => p.data_faturamento?.startsWith(m)) && (p.numero_nf || p.status_pagamento === 'Pago'))
        .reduce((acc, p) => acc + p.valor_total, 0)

      const mediaTri = fatTri / 3
      const tier = getRadisTier(mediaTri, dist.possui_equipe_3_pessoas)

      // Apuração de comissão utilizando a comissão calculada (% comissao * valor produto com desconto)
      const comissaoQlikTri = pags
        .filter((p) => qMeses.some(m => p.data_faturamento?.startsWith(m)) && (p.numero_nf || p.status_pagamento === 'Pago'))
        .reduce((acc, p) => acc + p.comissao_calculada, 0)
      // Comissão RADIS é calculada pela faixa sobre faturamento do trimestre.
      // Comissão percentual do Qlik permanece separada para não misturar conceitos.
      const comissaoRadisTri = fatTri * tier.comissaoTotal

      const revendas = buildRevendasConsolidado(
        pags,
        funis,
        {},
        anoCalculo,
        mInt
      )

      const ativas = revendas.filter((r) => r.status === 'Ativa' || r.status === 'Recorrente').length
      const recorrentes = revendas.filter((r) => r.status === 'Recorrente').length

      const bonusAtivas = ativas >= tier.minAtivas ? 3500 : 0
      const bonusRecorrentes = recorrentes >= tier.minRecorrentes ? 3500 : 0

      return {
        ...dist,
        fatAno,
        fatTri,
        mediaTri,
        tier,
        ativas,
        recorrentes,
        totalRevendas: revendas.length,
        bonusAtivas,
        bonusRecorrentes,
        comissaoQlikTri,
        comissaoRadisTri,
        totalReceberTri: comissaoRadisTri + bonusAtivas + bonusRecorrentes,
        qtdPedidos: pags.length,
      }
    }).sort((a, b) => b.fatAno - a.fatAno)
  }, [distribuidores, projetosProcessados, projetosFunil, anoRef, mesRef])

  const totaisGlobais = useMemo(() => {
    return resumoCanais.reduce(
      (acc, c) => ({
        faturamentoAno: acc.faturamentoAno + c.fatAno,
        faturamentoTri: acc.faturamentoTri + c.fatTri,
        revendasAtivas: acc.revendasAtivas + c.ativas,
        revendasRecorrentes: acc.revendasRecorrentes + c.recorrentes,
        comissoesEBonus: acc.comissoesEBonus + c.totalReceberTri,
      }),
      { faturamentoAno: 0, faturamentoTri: 0, revendasAtivas: 0, revendasRecorrentes: 0, comissoesEBonus: 0 }
    )
  }, [resumoCanais])

  const handleUploadPagFat = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPag(true)
    setUploadStatus('Lendo e deduplicando planilha de Projetos Pagos/Faturados do Qlik...')
    try {
      const { projetos, distribuidores: distsFile, linhasBrutas, invalidCodes, duplicateGroups } = await parseQlikPagFatFile(file)
      if (!projetos.length) throw new Error(`Nenhum projeto válido foi identificado em ${linhasBrutas} linhas. Verifique código de venda e CNPJ do distribuidor.`)
      if (!isSupabaseConfigured || !supabase) {
        setUploadStatus(`Modo Demo: ${projetos.length} projetos únicos processados; ${duplicateGroups} grupos duplicados consolidados; ${invalidCodes.length} projetos sem CNPJ válido ignorados (de ${linhasBrutas} linhas). Configure o Supabase para gravar no banco.`)
        return
      }
      const { error: distError } = await supabase.from('distribuidores').upsert(distsFile, { onConflict: 'cnpj_raiz', ignoreDuplicates: true })
      if (distError) throw distError
      for (let i = 0; i < projetos.length; i += 500) {
        const batch = projetos.slice(i, i + 500)
        const { error } = await supabase.from('projetos_pag_fat').upsert(batch, { onConflict: 'codigo_projeto' })
        if (error) throw error
      }
      const { error: logError } = await supabase.from('importacoes_log').insert({
        tipo_base: 'PAG_FAT',
        arquivo_nome: file.name,
        total_registros: projetos.length,
        importado_por: userEmail,
      })
      if (logError) throw logError
      setUploadStatus(`Sucesso! ${projetos.length} projetos únicos importados de ${linhasBrutas} linhas; ${duplicateGroups} grupos duplicados consolidados; ${invalidCodes.length} projetos sem CNPJ válido ignorados; ${distsFile.length} raízes de CNPJ.`)
      if (onDataRefresh) await onDataRefresh()
    } catch (err) {
      setUploadStatus('Erro na importação: ' + err.message)
    } finally {
      e.target.value = ''
      setUploadingPag(false)
    }
  }

  const handleUploadCriadas = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingCri(true)
    setUploadStatus('Lendo planilha de Projetos Criados (Funil) do Qlik...')
    try {
      const { projetos, distribuidores: distsFile, linhasBrutas, invalidCodes, duplicateGroups } = await parseQlikCriadasFile(file)
      if (!projetos.length) throw new Error(`Nenhum projeto válido foi identificado em ${linhasBrutas} linhas. Verifique código de venda e CNPJ do distribuidor.`)
      if (!isSupabaseConfigured || !supabase) {
        setUploadStatus(`Modo Demo: ${projetos.length} projetos únicos processados; ${duplicateGroups} grupos duplicados consolidados; ${invalidCodes.length} projetos sem CNPJ válido ignorados (de ${linhasBrutas} linhas).`)
        return
      }
      const { error: distError } = await supabase.from('distribuidores').upsert(distsFile, { onConflict: 'cnpj_raiz', ignoreDuplicates: true })
      if (distError) throw distError
      for (let i = 0; i < projetos.length; i += 500) {
        const batch = projetos.slice(i, i + 500)
        const { error } = await supabase.from('projetos_funil').upsert(batch, { onConflict: 'codigo_projeto' })
        if (error) throw error
      }
      const { error: logError } = await supabase.from('importacoes_log').insert({
        tipo_base: 'CRIADAS',
        arquivo_nome: file.name,
        total_registros: projetos.length,
        importado_por: userEmail,
      })
      if (logError) throw logError
      setUploadStatus(`Sucesso! ${projetos.length} projetos únicos do funil importados de ${linhasBrutas} linhas; ${duplicateGroups} grupos duplicados consolidados; ${invalidCodes.length} projetos sem CNPJ válido ignorados; ${distsFile.length} raízes de CNPJ.`)
      if (onDataRefresh) await onDataRefresh()
    } catch (err) {
      setUploadStatus('Erro na importação: ' + err.message)
    } finally {
      e.target.value = ''
      setUploadingCri(false)
    }
  }


  const loadSolicitacoes = async () => {
    if (!supabase || !isSupabaseConfigured) return
    setLoadingSolicitacoes(true)
    const { data, error } = await supabase.from('solicitacoes_acesso')
      .select('*').order('criado_em', { ascending: false }).limit(200)
    if (error) setSolicitacaoStatus('Erro ao carregar solicitações: ' + error.message)
    else {
      setSolicitacoes(data || [])
      setSolicitacaoStatus('')
    }
    setLoadingSolicitacoes(false)
  }

  useEffect(() => {
    if (adminTab === 'acessos') loadSolicitacoes()
  }, [adminTab])

  const handleApproveRequest = async (request) => {
    const cnpjRaiz = solicitacaoCnpj[request.id] || ''
    if (!cnpjRaiz) { setSolicitacaoStatus('Selecione o distribuidor para aprovar a solicitação.'); return }
    setProcessingRequest(request.id)
    setSolicitacaoStatus('')
    try {
      const { data, error } = await supabase.functions.invoke('approve-access-request', {
        body: {
          requestId: request.id,
          cnpjRaiz,
          cargo: solicitacaoCargo[request.id] || 'Vendedor',
          tempPassword: solicitacaoSenha[request.id] || '',
        },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setSolicitacaoStatus(data?.invitationSent
        ? 'Acesso aprovado e convite enviado para ' + request.email
        : 'Acesso aprovado e vínculo atualizado para ' + request.email)
      await loadSolicitacoes()
      if (onDataRefresh) await onDataRefresh()
    } catch (err) {
      setSolicitacaoStatus('Não foi possível aprovar: ' + (err.message || 'Erro inesperado'))
    } finally {
      setProcessingRequest('')
    }
  }

  const handleSendPasswordReset = async (email) => {
    setSolicitacaoStatus('')
    const redirectTo = window.location.origin + window.location.pathname
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) setSolicitacaoStatus('Erro ao enviar recuperação para ' + email + ': ' + error.message)
    else setSolicitacaoStatus('Solicitação de redefinição enviada para ' + email + '. O usuário receberá um link seguro por e-mail.')
  }

  const handleRejectRequest = async (request) => {
    if (!window.confirm('Recusar a solicitação de ' + request.email + '?')) return
    setProcessingRequest(request.id)
    const { error } = await supabase.from('solicitacoes_acesso')
      .update({ status: 'recusada', analisado_em: new Date().toISOString(), analisado_por: userEmail })
      .eq('id', request.id).eq('status', 'pendente')
    if (error) setSolicitacaoStatus('Erro ao recusar: ' + error.message)
    else { setSolicitacaoStatus('Solicitação recusada.'); await loadSolicitacoes() }
    setProcessingRequest('')
  }

  const handleAddUsuario = async (e) => {
    e.preventDefault()
    if (!novoEmail) return
    if (!isSupabaseConfigured || !supabase) {
      alert('Configure o Supabase (.env) para salvar usuários no banco.')
      return
    }
    try {
      const { error } = await supabase.from('usuarios_acesso').upsert({
        email: novoEmail.trim().toLowerCase(),
        nome: novoNome.trim(),
        cargo: novoCargo,
        perfil: novoPerfil,
        cnpj_raiz: novoPerfil === 'admin' ? null : novoCnpjRaiz,
      })
      if (error) throw error
      setNovoEmail('')
      setNovoNome('')
      alert('Acesso liberado!')
      if (onDataRefresh) onDataRefresh()
    } catch (err) {
      alert('Erro ao cadastrar e-mail: ' + err.message)
    }
  }

  const handleToggleEquipe = async (dist) => {
    if (!isSupabaseConfigured || !supabase) return
    await supabase
      .from('distribuidores')
      .update({ possui_equipe_3_pessoas: !dist.possui_equipe_3_pessoas })
      .eq('cnpj_raiz', dist.cnpj_raiz)
    if (onDataRefresh) onDataRefresh()
  }

  if (previewDistCnpj) {
    const distObj = distribuidores.find((d) => d.cnpj_raiz === previewDistCnpj)
    return (
      <div className="space-y-4">
        <div className="bg-slate-900 text-white px-4 py-3 rounded-xl flex items-center justify-between">
          <span className="text-sm font-medium">
            Modo Visualização de Canal: <strong>{distObj?.nome}</strong>
          </span>
          <button
            onClick={() => setPreviewDistCnpj(null)}
            className="px-3 py-1.5 bg-white text-slate-900 rounded-lg text-xs font-bold hover:bg-slate-100"
          >
            Voltar para Visão Geral Admin
          </button>
        </div>
        <DistributorDashboard
          distribuidor={distObj}
          projetosPagFat={projetosProcessados.filter((p) => p.cnpj_raiz === previewDistCnpj)}
          projetosFunil={projetosFunil.filter((f) => {
            const fCnpj = f.cnpj_raiz ? String(f.cnpj_raiz).replace(/\D/g, '').substring(0, 8) : ''
            return fCnpj === previewDistCnpj
          })}
          userEmail={userEmail}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Admin */}
      <div className="bg-slate-900 text-white rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Painel Executivo Nacional</span>
          <h1 className="text-2xl font-extrabold mt-1">Consolidado de Canais & Distribuidores RADIS</h1>
          <p className="text-sm text-slate-300 mt-1">Visão unificada de faturamento, revendas ativas/recorrentes e apuração de bônus</p>
        </div>
        <div className="flex items-center gap-3">
      <select
            value={anoRef}
            onChange={(e) => setAnoRef(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold"
          >
            <option value="TODOS">Total Geral (Todos os Anos)</option>
            {anosDisponiveis.map((ano) => <option key={ano} value={ano}>Ano {ano}</option>)}
          </select>
          <select
            value={mesRef}
            onChange={(e) => setMesRef(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold"
          >
            <option value="01">Jan</option><option value="02">Fev</option><option value="03">Mar</option>
            <option value="04">Abr</option><option value="05">Mai</option><option value="06">Jun</option>
            <option value="07">Jul</option><option value="08">Ago</option><option value="09">Set</option>
            <option value="10">Out</option><option value="11">Nov</option><option value="12">Dez</option>
          </select>
        </div>
      </div>

      {/* Sub-menu Admin */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setAdminTab('consolidado')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold ${
            adminTab === 'consolidado' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          <Building2 className="w-4 h-4" /> Visão Consolidada ({distribuidores.length} Canais)
        </button>
        <button
          onClick={() => setAdminTab('upload')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold ${
            adminTab === 'upload' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          <Upload className="w-4 h-4" /> Importar Base Qlik
        </button>
        <button
          onClick={() => setAdminTab('acessos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold ${
            adminTab === 'acessos' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          <UserPlus className="w-4 h-4" /> Acessos por Distribuidor
        </button>
      </div>

      {/* TAB 1: CONSOLIDADO NACIONAL */}
      {adminTab === 'consolidado' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
                <span>Faturamento Total {anoRef === 'TODOS' ? '(Geral)' : `(${anoRef})`}</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-2">
                {formatCurrency(totaisGlobais.faturamentoAno)}
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
                <span>Faturamento Trimestre Atual</span>
                <Building2 className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-2">
                {formatCurrency(totaisGlobais.faturamentoTri)}
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
                <span>Revendas Ativas / Recorrentes</span>
                <Users className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-2">
                {totaisGlobais.revendasAtivas} <span className="text-sm font-normal text-slate-500">ativas</span> / {totaisGlobais.revendasRecorrentes} <span className="text-sm font-normal text-emerald-600">rec.</span>
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
                <span>Comissão + Bônus RADIS (Tri)</span>
                <ShieldCheck className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-extrabold text-emerald-700 mt-2">
                {formatCurrency(totaisGlobais.comissoesEBonus)}
              </div>
            </div>
          </div>

          {/* Gráfico Top 10 Distribuidores */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4">Top 10 Distribuidores por Faturamento ({anoRef})</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={resumoCanais.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="nome" width={180} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="fatAno" name="Faturamento" fill="#059669" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabela Ranking Completo */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h3 className="font-bold text-slate-900">Desempenho Individual por Distribuidor (Consolidado Raiz CNPJ)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-800 text-white text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3">Distribuidor (Raiz CNPJ)</th>
                    <th className="px-4 py-3">Faturamento Ano</th>
                    <th className="px-4 py-3">Média Tri</th>
                    <th className="px-4 py-3">Faixa / %</th>
                    <th className="px-4 py-3">Equipe 3P (+1%)</th>
                    <th className="px-4 py-3">Revendas Ativas</th>
                    <th className="px-4 py-3">Recorrentes</th>
                    <th className="px-4 py-3">Comissão Qlik (Tri)</th>
                    <th className="px-4 py-3">Total RADIS (Tri)</th>
                    <th className="px-4 py-3">Painel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {resumoCanais.map((c) => (
                    <tr key={c.cnpj_raiz} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{c.nome}</div>
                        <div className="text-xs text-slate-500">Raiz: {c.cnpj_raiz} • SAP: {c.cod_sap || '-'} ({c.uf})</div>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">{formatCurrency(c.fatAno)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatCurrency(c.mediaTri)}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-xs">
                          Faixa {c.tier.faixa} ({formatPercent(c.tier.comissaoTotal)})
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleEquipe(c)}
                          className={`px-2 py-1 rounded text-xs font-bold ${
                            c.possui_equipe_3_pessoas ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {c.possui_equipe_3_pessoas ? 'SIM (+1%)' : 'NÃO'}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {c.ativas} <span className="text-xs text-slate-400">/ {c.tier.minAtivas}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {c.recorrentes} <span className="text-xs text-slate-400">/ {c.tier.minRecorrentes}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{formatCurrency(c.comissaoQlikTri)}</td>
                      <td className="px-4 py-3 font-bold text-emerald-700">{formatCurrency(c.totalReceberTri)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setPreviewDistCnpj(c.cnpj_raiz)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-900 text-white text-xs font-semibold hover:bg-slate-700"
                        >
                          <Eye className="w-3.5 h-3.5" /> Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: UPLOAD QLIK */}
      {adminTab === 'upload' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Importação Automática das Planilhas do Qlik</h2>
            <p className="text-sm text-slate-500 mt-1">
              O importador remove automaticamente linhas duplicadas de múltiplos componentes/pagamentos e extrai a raiz do CNPJ (8 dígitos).
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-emerald-500 transition">
              <Upload className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
              <h3 className="font-bold text-slate-900">1. Planilha de Projetos Pagos / Faturados</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Arquivo Qlik com status de pagamento e emissão de NF
              </p>
              <label className="inline-block px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg cursor-pointer hover:bg-emerald-700">
                {uploadingPag ? 'Processando...' : 'Selecionar Arquivo Pagos (.xlsx)'}
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleUploadPagFat} disabled={uploadingPag} className="hidden" />
              </label>
            </div>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-blue-500 transition">
              <Upload className="w-10 h-10 text-blue-600 mx-auto mb-3" />
              <h3 className="font-bold text-slate-900">2. Planilha de Projetos Criados (Funil)</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Arquivo Qlik de propostas criadas no mês
              </p>
              <label className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg cursor-pointer hover:bg-blue-700">
                {uploadingCri ? 'Processando...' : 'Selecionar Arquivo Criadas (.xlsx)'}
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleUploadCriadas} disabled={uploadingCri} className="hidden" />
              </label>
            </div>
          </div>
          {uploadStatus && (
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{uploadStatus}</span>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: GESTÃO DE ACESSOS */}
      {adminTab === 'acessos' && (
        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Solicitações de cadastro</h2>
                <p className="text-sm text-slate-500">Analise os pedidos enviados pela tela de login. A aprovação cria ou vincula a conta e envia convite seguro.</p>
              </div>
              <button onClick={loadSolicitacoes} className="px-3 py-2 border rounded-lg text-sm font-semibold">Atualizar lista</button>
            </div>
            {solicitacaoStatus && <div role="status" className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">{solicitacaoStatus}</div>}
            {loadingSolicitacoes ? <p className="text-sm text-slate-500">Carregando solicitações...</p> :
              solicitacoes.filter(x => x.status === 'pendente').length === 0 ?
                <p className="text-sm text-slate-500 py-4">Não há solicitações pendentes.</p> :
                <div className="space-y-4">
                  {solicitacoes.filter(x => x.status === 'pendente').map(request => (
                    <article key={request.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="flex flex-wrap justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-slate-900">{request.nome}</h3>
                          <p className="text-sm text-slate-600">{request.email}</p>
                          <p className="text-xs text-slate-500">{request.empresa || 'Empresa não informada'} · {request.telefone || 'Telefone não informado'}</p>
                          <p className="text-xs text-slate-500">CNPJ informado: {request.cnpj || 'Não informado'} · {new Date(request.criado_em).toLocaleString('pt-BR')}</p>
                          {request.mensagem && <p className="text-sm text-slate-700 mt-2">{request.mensagem}</p>}
                        </div>
                        <span className="h-fit px-2 py-1 rounded bg-amber-100 text-amber-800 text-xs font-bold">PENDENTE</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <select value={solicitacaoCnpj[request.id] || ''} onChange={e=>setSolicitacaoCnpj(v=>({...v,[request.id]:e.target.value}))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                          <option value="">Vincular distribuidor...</option>
                          {distribuidores.map(d=><option key={d.cnpj_raiz} value={d.cnpj_raiz}>{d.nome} ({d.cnpj_raiz})</option>)}
                        </select>
                        <select value={solicitacaoCargo[request.id] || 'Vendedor'} onChange={e=>setSolicitacaoCargo(v=>({...v,[request.id]:e.target.value}))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                          <option>Vendedor</option><option>Gerente</option><option>Diretor</option>
                        </select>
                        <input type="password" autoComplete="new-password" placeholder="Senha temporária opcional" value={solicitacaoSenha[request.id] || ''} onChange={e=>setSolicitacaoSenha(v=>({...v,[request.id]:e.target.value}))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                      </div>
                      <p className="text-xs text-slate-500">Sem senha temporária: será enviado convite por e-mail para o usuário criar a senha. Se a conta já existir, informe uma senha temporária de pelo menos 12 caracteres.</p>
                      <div className="flex gap-2">
                        <button disabled={processingRequest===request.id} onClick={()=>handleApproveRequest(request)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold disabled:opacity-50">{processingRequest===request.id?'Processando...':'Aprovar e enviar convite'}</button>
                        <button disabled={processingRequest===request.id} onClick={()=>handleRejectRequest(request)} className="px-4 py-2 border border-rose-200 text-rose-700 rounded-lg text-sm font-bold disabled:opacity-50">Recusar</button>
                      </div>
                    </article>
                  ))}
                </div>
            }
          </section>
          <form onSubmit={handleAddUsuario} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Liberar E-mail de Acesso</h2>
            <p className="text-sm text-slate-500">Cadastro manual de permissão. O usuário ainda precisará receber convite/criar sua senha no Supabase Auth.</p>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <input type="email" required placeholder="email@distribuidor.com.br" value={novoEmail} onChange={e=>setNovoEmail(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="text" placeholder="Nome do usuário" value={novoNome} onChange={e=>setNovoNome(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <select value={novoCargo} onChange={e=>setNovoCargo(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option>Vendedor</option><option>Gerente</option><option>Diretor</option><option>Admin</option></select>
              <select value={novoPerfil} onChange={e=>setNovoPerfil(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="distribuidor">Perfil Distribuidor</option><option value="admin">Perfil Admin Global</option></select>
              {novoPerfil==='distribuidor' && <select value={novoCnpjRaiz} onChange={e=>setNovoCnpjRaiz(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">{distribuidores.map(d=><option key={d.cnpj_raiz} value={d.cnpj_raiz}>{d.nome} ({d.cnpj_raiz})</option>)}</select>}
            </div>
            <button type="submit" className="px-5 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg">Cadastrar Permissão</button>
          </form>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 font-bold text-slate-900">Contas com acesso liberado</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-800 text-white text-xs uppercase"><tr><th className="px-4 py-3">E-mail</th><th className="px-4 py-3">Nome / Cargo</th><th className="px-4 py-3">Perfil</th><th className="px-4 py-3">Distribuidor Vinculado</th><th className="px-4 py-3">Ações de senha</th></tr></thead>
                <tbody className="divide-y divide-slate-200">
                  {usuariosAcesso.map(u=>{const dist=distribuidores.find(d=>d.cnpj_raiz===u.cnpj_raiz);return <tr key={u.email}><td className="px-4 py-3 font-medium text-slate-900">{u.email}</td><td className="px-4 py-3 text-slate-600">{u.nome||'-'} ({u.cargo||'-'})</td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-bold ${u.perfil==='admin'?'bg-purple-100 text-purple-800':'bg-emerald-100 text-emerald-800'}`}>{u.perfil.toUpperCase()}</span></td><td className="px-4 py-3 text-slate-700">{u.perfil==='admin'?'TODOS OS CANAIS':(dist?.nome||u.cnpj_raiz)}</td><td className="px-4 py-3"><button onClick={()=>handleSendPasswordReset(u.email)} className="text-xs font-semibold text-emerald-700 hover:underline">Enviar link para redefinir senha</button></td></tr>})}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

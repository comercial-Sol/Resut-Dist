import React, { useState, useEffect } from 'react'
import { Sun, LogOut, Shield, Building2, Lock, Mail, RefreshCw } from 'lucide-react'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { DEMO_DISTRIBUIDORES, DEMO_PAG_FAT, DEMO_FUNIL } from './utils/demoData'
import DistributorDashboard from './pages/DistributorDashboard'
import AdminDashboard from './pages/AdminDashboard'

// Supabase/PostgREST limita cada resposta; buscar páginas até esgotar a tabela.
const TABLE_ORDER_COLUMNS = {
  distribuidores: 'cnpj_raiz',
  projetos_pag_fat: 'codigo_projeto',
  projetos_funil: 'codigo_projeto',
  revendas_crm: 'revenda_cnpj',
  usuarios_acesso: 'email',
}

// Paginação determinística: sem ORDER BY, páginas sucessivas podem repetir ou
// pular registros em tabelas grandes enquanto o conjunto muda.
async function fetchAllRows(table, select = '*') {
  const pageSize = 1000
  const orderColumn = TABLE_ORDER_COLUMNS[table]
  if (!orderColumn) throw new Error(`Tabela sem coluna de ordenação configurada: ${table}`)
  const all = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(orderColumn, { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`Falha ao ler ${table} (registros ${from + 1} a ${from + pageSize}): ${error.message}`)
    all.push(...(data || []))
    if (!data || data.length < pageSize) break
  }
  return all
}

export default function App() {
  const [session, setSession] = useState(null)
  const [userAccess, setUserAccess] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastDataRefresh, setLastDataRefresh] = useState(null)

  // Login form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [recoveryPassword, setRecoveryPassword] = useState('')
  const [requestName, setRequestName] = useState('')
  const [requestEmail, setRequestEmail] = useState('')
  const [requestCompany, setRequestCompany] = useState('')
  const [requestCnpj, setRequestCnpj] = useState('')
  const [requestPhone, setRequestPhone] = useState('')
  const [requestMessage, setRequestMessage] = useState('')
  const [authNotice, setAuthNotice] = useState('')

  // Dados carregados
  const [distribuidores, setDistribuidores] = useState(DEMO_DISTRIBUIDORES)
  const [projetosPagFat, setProjetosPagFat] = useState(DEMO_PAG_FAT)
  const [projetosFunil, setProjetosFunil] = useState(DEMO_FUNIL)
  const [crmRecords, setCrmRecords] = useState([])
  const [usuariosAcesso, setUsuariosAcesso] = useState([])

  // Modo Demo (quando sem Supabase configurado)
  const [demoRole, setDemoRole] = useState('distribuidor') // 'distribuidor' | 'admin'
  const [demoCnpjRaiz, setDemoCnpjRaiz] = useState('76823327')

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadUserAndData(session.user.email)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setAuthMode('recovery')
      setSession(session)
      if (session) loadUserAndData(session.user.email)
      else {
        setUserAccess(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadUserAndData = async (userEmail, options = {}) => {
    const silent = options.silent === true
    if (!silent) setLoading(true)
    setAuthError('')
    try {
      const { data: accessData, error: accessErr } = await supabase
        .from('usuarios_acesso')
        .select('*')
        .ilike('email', userEmail)
        .single()

      if (accessErr || !accessData) {
        setUserAccess(null)
        setDistribuidores([])
        setProjetosPagFat([])
        setProjetosFunil([])
        setCrmRecords([])
        setAuthError('Seu e-mail não está vinculado a nenhum distribuidor ou administrador. Contate o suporte.')
        setLoading(false)
        return
      }

      setUserAccess(accessData)

      // Não manter dados demonstrativos quando o banco real estiver conectado.
      setDistribuidores([])
      setProjetosPagFat([])
      setProjetosFunil([])
      setCrmRecords([])
      setUsuariosAcesso([])

      const [distData, pagData, funilData, crmData] = await Promise.all([
        fetchAllRows('distribuidores'),
        fetchAllRows('projetos_pag_fat'),
        fetchAllRows('projetos_funil'),
        fetchAllRows('revendas_crm'),
      ])

      setDistribuidores(distData)
      setProjetosPagFat(pagData)
      setProjetosFunil(funilData)
      setCrmRecords(crmData)
      setLastDataRefresh(new Date())

      if (accessData.perfil === 'admin') {
        setUsuariosAcesso(await fetchAllRows('usuarios_acesso'))
      }

    } catch (err) {
      console.error('Falha ao carregar dados do Supabase:', err)
      setAuthError(`Falha ao carregar os dados do Supabase: ${err.message}. Verifique o schema, as permissões e as políticas RLS.`)
      setDistribuidores([])
      setProjetosPagFat([])
      setProjetosFunil([])
      setCrmRecords([])
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setAuthError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthError('E-mail ou senha inválidos.')
  }

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut()
  }

  const handleManualRefresh = async () => {
    if (!activeEmail || refreshing) return
    setRefreshing(true)
    try { await loadUserAndData(activeEmail, { silent: true }) }
    finally { setRefreshing(false) }
  }

  // Production must fail closed: demo/admin preview is for local development only.
  if (!isSupabaseConfigured && !import.meta.env.DEV) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
        <section className="max-w-lg rounded-2xl bg-white p-8 shadow-xl text-center space-y-3">
          <Shield className="w-10 h-10 text-rose-600 mx-auto" />
          <h1 className="text-xl font-extrabold text-slate-900">Portal temporariamente indisponível</h1>
          <p className="text-sm text-slate-600">A configuração segura de conexão não foi carregada. O modo de demonstração está bloqueado em produção. Contate o administrador do portal.</p>
        </section>
      </main>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-2">
          <Sun className="w-10 h-10 text-emerald-600 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Carregando Portal RADIS Solar...</p>
        </div>
      </div>
    )
  }


  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setAuthError('')
    setAuthNotice('')
    const targetEmail = email.trim().toLowerCase()
    if (!targetEmail) { setAuthError('Informe o e-mail da conta para receber o link.'); return }
    const redirectTo = 'https://comercial-sol.github.io/Resut-Dist/'
    const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, { redirectTo })
    if (error?.status === 429 || error?.code === 'over_email_send_rate_limit') setAuthError('O serviço de e-mail atingiu o limite temporário de envios. Aguarde a liberação ou solicite ao administrador uma senha temporária pelo painel.')
    else if (error) setAuthError('Não foi possível enviar o e-mail de recuperação: ' + error.message)
    else setAuthNotice('Se o endereço estiver cadastrado, você receberá um e-mail com o link para redefinir a senha.')
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    setAuthError('')
    if (recoveryPassword.length < 12) { setAuthError('A nova senha deve ter pelo menos 12 caracteres.'); return }
    const { error } = await supabase.auth.updateUser({ password: recoveryPassword })
    if (error) setAuthError('Não foi possível atualizar a senha: ' + error.message)
    else { setAuthMode('login'); setRecoveryPassword(''); setPassword(''); setAuthNotice('Senha alterada com sucesso. Entre com a nova senha.'); await supabase.auth.signOut() }
  }

  const handleAccessRequest = async (e) => {
    e.preventDefault()
    setAuthError('')
    setAuthNotice('')
    const { error } = await supabase.from('solicitacoes_acesso').insert({
      nome: requestName.trim(), email: requestEmail.trim().toLowerCase(),
      empresa: requestCompany.trim() || null, cnpj: requestCnpj.replace(/\\D/g, '') || null,
      telefone: requestPhone.trim() || null, mensagem: requestMessage.trim() || null,
    })
    if (error) setAuthError(error.code === '23505' ? 'Já existe uma solicitação pendente para este e-mail.' : 'Não foi possível enviar a solicitação: ' + error.message)
    else {
      setAuthNotice('Solicitação enviada! A equipe RADIS analisará seus dados e entrará em contato.')
      setRequestName(''); setRequestEmail(''); setRequestCompany(''); setRequestCnpj(''); setRequestPhone(''); setRequestMessage('')
      setAuthMode('login')
    }
  }

  // Tela pública de autenticação e solicitação de acesso.
  if (isSupabaseConfigured && (!session || authMode === 'recovery')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-8">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-xl space-y-5">
          <div className="text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center mx-auto mb-3"><Sun className="w-7 h-7" /></div>
            <h1 className="text-2xl font-extrabold text-slate-900">Portal RADIS Solar</h1>
            <p className="text-sm text-slate-500 mt-1">Acesso exclusivo para Distribuidores e Gestão Comercial</p>
          </div>
          {authError && <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">{authError}</div>}
          {authNotice && <div role="status" className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">{authNotice}</div>}

          {authMode === 'recovery' ? (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <h2 className="font-bold text-slate-900">Criar nova senha</h2>
              <label className="block text-xs font-bold uppercase text-slate-600">Nova senha</label>
              <input type="password" required minLength={12} autoComplete="new-password" value={recoveryPassword} onChange={e=>setRecoveryPassword(e.target.value)} placeholder="Mínimo de 12 caracteres" className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm" />
              <button className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-lg">Salvar nova senha</button>
            </form>
          ) : authMode === 'forgot' ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <h2 className="font-bold text-slate-900">Recuperar senha</h2>
              <p className="text-xs text-slate-500">Enviaremos um link seguro para o e-mail cadastrado.</p>
              <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-mail corporativo" className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm" />
              <button className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-lg">Enviar link de recuperação</button>
              <button type="button" onClick={()=>{setAuthMode('login');setAuthError('');setAuthNotice('')}} className="w-full text-sm text-slate-600">Voltar ao login</button>
            </form>
          ) : authMode === 'request' ? (
            <form onSubmit={handleAccessRequest} className="space-y-3">
              <h2 className="font-bold text-slate-900">Solicitar cadastro</h2>
              <input required minLength={2} value={requestName} onChange={e=>setRequestName(e.target.value)} placeholder="Nome completo" className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm" />
              <input required type="email" value={requestEmail} onChange={e=>setRequestEmail(e.target.value)} placeholder="E-mail corporativo" className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm" />
              <input value={requestCompany} onChange={e=>setRequestCompany(e.target.value)} placeholder="Empresa / Distribuidor" className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm" />
              <input value={requestCnpj} onChange={e=>setRequestCnpj(e.target.value)} placeholder="CNPJ (opcional)" className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm" />
              <input value={requestPhone} onChange={e=>setRequestPhone(e.target.value)} placeholder="Telefone / WhatsApp (opcional)" className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm" />
              <textarea value={requestMessage} onChange={e=>setRequestMessage(e.target.value)} placeholder="Informações adicionais (opcional)" rows={2} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm" />
              <button className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-lg">Enviar solicitação</button>
              <button type="button" onClick={()=>{setAuthMode('login');setAuthError('');setAuthNotice('')}} className="w-full text-sm text-slate-600">Voltar ao login</button>
            </form>
          ) : (
            <>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">E-mail corporativo</label>
                  <input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seuemail@distribuidor.com.br" className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Senha</label>
                  <input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Sua senha" className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm" />
                  <button type="button" onClick={()=>{setAuthMode('forgot');setAuthError('');setAuthNotice('')}} className="mt-2 text-xs font-semibold text-emerald-700 hover:underline">Esqueceu a senha?</button>
                </div>
                <button type="submit" className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700">Entrar no Painel</button>
              </form>
              <div className="border-t border-slate-200 pt-4 text-center">
                <p className="text-sm text-slate-600 mb-2">Ainda não tem acesso ao portal?</p>
                <button onClick={()=>{setAuthMode('request');setAuthError('');setAuthNotice('')}} className="w-full py-2.5 border border-emerald-600 text-emerald-700 font-bold rounded-lg hover:bg-emerald-50">Solicitar cadastro</button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  const activePerfil = isSupabaseConfigured ? userAccess?.perfil : demoRole
  const activeCnpj = isSupabaseConfigured ? userAccess?.cnpj_raiz : demoCnpjRaiz
  const activeEmail = isSupabaseConfigured ? session?.user?.email : 'demo@radis.com.br'
  const currentDistribuidor = distribuidores.find((d) => d.cnpj_raiz === activeCnpj) || distribuidores[0]
  // Supabase RLS returns only roots explicitly linked to this user; never infer access from company names.
  const currentDistribuidorRoots = new Set(
    isSupabaseConfigured ? distribuidores.map((d) => String(d.cnpj_raiz)) : [String(activeCnpj)]
  )

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Barra Superior */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600 text-white rounded-lg">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 tracking-tight">RADIS SOLAR</span>
              <span className="hidden sm:inline-block ml-2 text-xs text-slate-400">| Portal de Performance</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Seletor de Modo Demonstração (aparece apenas antes de conectar o Supabase) */}
            {!isSupabaseConfigured && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg">
                <span className="text-[11px] font-bold text-amber-800 uppercase">Modo Preview:</span>
                <button
                  onClick={() => setDemoRole('distribuidor')}
                  className={`px-2 py-0.5 rounded text-xs font-bold ${demoRole === 'distribuidor' ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}
                >
                  <Building2 className="w-3 h-3 inline mr-1" />Distribuidor
                </button>
                <button
                  onClick={() => setDemoRole('admin')}
                  className={`px-2 py-0.5 rounded text-xs font-bold ${demoRole === 'admin' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                >
                  <Shield className="w-3 h-3 inline mr-1" />Admin
                </button>
                {demoRole === 'distribuidor' && (
                  <select
                    value={demoCnpjRaiz}
                    onChange={(e) => setDemoCnpjRaiz(e.target.value)}
                    className="text-xs border border-amber-300 rounded px-1.5 py-0.5 bg-white font-semibold"
                  >
                    {distribuidores.map((d) => (
                      <option key={d.cnpj_raiz} value={d.cnpj_raiz}>{d.nome.slice(0, 22)}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {isSupabaseConfigured && <button onClick={handleManualRefresh} disabled={refreshing || loading} title={lastDataRefresh ? 'Última atualização: ' + lastDataRefresh.toLocaleTimeString('pt-BR') : 'Atualizar dados do Supabase'} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"><RefreshCw className={'w-3.5 h-3.5 ' + (refreshing ? 'animate-spin' : '')} />{refreshing ? 'Atualizando...' : 'Atualizar'}</button>}
            <span className="hidden md:inline text-xs text-slate-500 font-medium">{activeEmail}</span>

            {isSupabaseConfigured && (
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                <LogOut className="w-3.5 h-3.5" /> Sair
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {authError && isSupabaseConfigured && (
          <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {authError}
          </div>
        )}
        {isSupabaseConfigured && !userAccess ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
            O acesso deste usuário ainda não foi configurado na tabela <strong>usuarios_acesso</strong>. Solicite ao administrador o vínculo do e-mail ao perfil e ao CNPJ-raiz corretos.
          </div>
        ) : activePerfil === 'admin' ? (
          <AdminDashboard
            distribuidores={distribuidores}
            projetosPagFat={projetosPagFat}
            projetosFunil={projetosFunil}
            usuariosAcesso={usuariosAcesso}
            userEmail={activeEmail}
            onDataRefresh={() => loadUserAndData(activeEmail, { silent: true })}
          />
        ) : (
          <DistributorDashboard
            distribuidor={currentDistribuidor}
            projetosPagFat={projetosPagFat.filter((p) => currentDistribuidorRoots.has(String(p.cnpj_raiz)))}
            projetosFunil={projetosFunil.filter((f) => currentDistribuidorRoots.has(String(f.cnpj_raiz)))}
            crmRecords={crmRecords.filter((r) => currentDistribuidorRoots.has(String(r.cnpj_raiz)))}
            userEmail={activeEmail}
            onCrmUpdated={() => loadUserAndData(activeEmail)}
          />
        )}
      </main>
    </div>
  )
}

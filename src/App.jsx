import React, { useState, useEffect } from 'react'
import { Sun, LogOut, Shield, Building2, Lock, Mail } from 'lucide-react'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { DEMO_DISTRIBUIDORES, DEMO_PAG_FAT, DEMO_FUNIL } from './utils/demoData'
import DistributorDashboard from './pages/DistributorDashboard'
import AdminDashboard from './pages/AdminDashboard'

export default function App() {
  const [session, setSession] = useState(null)
  const [userAccess, setUserAccess] = useState(null)
  const [loading, setLoading] = useState(true)

  // Login form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadUserAndData(session.user.email)
      else {
        setUserAccess(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadUserAndData = async (userEmail) => {
    setLoading(true)
    try {
      const { data: accessData, error: accessErr } = await supabase
        .from('usuarios_acesso')
        .select('*')
        .ilike('email', userEmail)
        .single()

      if (accessErr || !accessData) {
        setAuthError('Seu e-mail não está vinculado a nenhum distribuidor ou administrador. Contate o suporte.')
        setLoading(false)
        return
      }

      setUserAccess(accessData)

      // O RLS do Supabase já filtra automaticamente os registros permitidos para este usuário!
      const [distRes, pagRes, funilRes, crmRes] = await Promise.all([
        supabase.from('distribuidores').select('*'),
        supabase.from('projetos_pag_fat').select('*'),
        supabase.from('projetos_funil').select('*'),
        supabase.from('revendas_crm').select('*'),
      ])

      if (distRes.data) setDistribuidores(distRes.data)
      if (pagRes.data) setProjetosPagFat(pagRes.data)
      if (funilRes.data) setProjetosFunil(funilRes.data)
      if (crmRes.data) setCrmRecords(crmRes.data)

      if (accessData.perfil === 'admin') {
        const { data: usersData } = await supabase.from('usuarios_acesso').select('*')
        if (usersData) setUsuariosAcesso(usersData)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
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

  // Tela de Login (quando Supabase está ativo e usuário não está logado)
  if (isSupabaseConfigured && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-xl space-y-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Sun className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">Portal RADIS Solar</h1>
            <p className="text-sm text-slate-500 mt-1">Acesso exclusivo para Distribuidores e Gestão Comercial</p>
          </div>

          {authError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">E-mail Corporativo</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@distribuidor.com.br"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition"
            >
              Entrar no Painel
            </button>
          </form>
        </div>
      </div>
    )
  }

  const activePerfil = isSupabaseConfigured ? userAccess?.perfil : demoRole
  const activeCnpj = isSupabaseConfigured ? userAccess?.cnpj_raiz : demoCnpjRaiz
  const activeEmail = isSupabaseConfigured ? session?.user?.email : 'demo@radis.com.br'
  const currentDistribuidor = distribuidores.find((d) => d.cnpj_raiz === activeCnpj) || distribuidores[0]

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
        {activePerfil === 'admin' ? (
          <AdminDashboard
            distribuidores={distribuidores}
            projetosPagFat={projetosPagFat}
            projetosFunil={projetosFunil}
            usuariosAcesso={usuariosAcesso}
            userEmail={activeEmail}
            onDataRefresh={() => loadUserAndData(activeEmail)}
          />
        ) : (
          <DistributorDashboard
            distribuidor={currentDistribuidor}
            projetosPagFat={projetosPagFat.filter((p) => p.cnpj_raiz === currentDistribuidor?.cnpj_raiz)}
            projetosFunil={projetosFunil.filter((f) => f.cnpj_raiz === currentDistribuidor?.cnpj_raiz)}
            crmRecords={crmRecords}
            userEmail={activeEmail}
            onCrmUpdated={() => loadUserAndData(activeEmail)}
          />
        )}
      </main>
    </div>
  )
}

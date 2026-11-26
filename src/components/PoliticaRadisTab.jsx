import React from 'react'
import { Award, Users, Store, RefreshCw, Info } from 'lucide-react'

export default function PoliticaRadisTab({ possuiEquipe }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Política Comercial RADIS — Regras & Faixas de Comissionamento</h2>
            <p className="text-sm text-slate-500">Consolidação automática por Raiz do CNPJ (Matriz + Filiais do Distribuidor)</p>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${possuiEquipe ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
            {possuiEquipe ? 'Bônus Estrutura 3 Pessoas ATIVO (+1%)' : 'Sem Bônus Estrutura (+0%)'}
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm text-center">
            <thead className="bg-slate-900 text-white">
              <tr>
                <th className="px-4 py-3 text-left">Critério de Apuração</th>
                <th className="px-4 py-3">Faixa 1<br /><span className="text-xs font-normal text-slate-300">Média Trim. 0 a 199k</span></th>
                <th className="px-4 py-3">Faixa 2<br /><span className="text-xs font-normal text-slate-300">Média Trim. 200k a 399k</span></th>
                <th className="px-4 py-3">Faixa 3<br /><span className="text-xs font-normal text-slate-300">Média Trim. 400k a 599k</span></th>
                <th className="px-4 py-3">Faixa 4<br /><span className="text-xs font-normal text-slate-300">Média Trim. Acima de 600k</span></th>
                <th className="px-4 py-3 bg-emerald-700">Bônus Máximo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr className="bg-white font-semibold">
                <td className="px-4 py-3 text-left text-slate-900">Comissão Base sobre Faturamento</td>
                <td className="px-4 py-3 text-emerald-700">2,00%</td>
                <td className="px-4 py-3 text-emerald-700">3,00%</td>
                <td className="px-4 py-3 text-emerald-700">4,00%</td>
                <td className="px-4 py-3 text-emerald-700">5,00%</td>
                <td className="px-4 py-3 font-bold text-emerald-800 bg-emerald-50">Até 5%</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="px-4 py-3 text-left font-medium text-slate-800">Estrutura Dedicada (Vendedor + Engenheiro + Multiplicador)</td>
                <td className="px-4 py-3">+1,00%</td>
                <td className="px-4 py-3">+1,00%</td>
                <td className="px-4 py-3">+1,00%</td>
                <td className="px-4 py-3">+1,00%</td>
                <td className="px-4 py-3 font-bold text-emerald-800 bg-emerald-50">Até +1%</td>
              </tr>
              <tr className="bg-white">
                <td className="px-4 py-3 text-left font-medium text-slate-800">Nº Mínimo de Revendas Ativas (Compra nos últimos 3 meses)</td>
                <td className="px-4 py-3 font-bold">25 revendas</td>
                <td className="px-4 py-3 font-bold">40 revendas</td>
                <td className="px-4 py-3 font-bold">50 revendas</td>
                <td className="px-4 py-3 font-bold">60 revendas</td>
                <td className="px-4 py-3 font-bold text-emerald-800 bg-emerald-50">R$ 3.500,00 / mês</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="px-4 py-3 text-left font-medium text-slate-800">Nº Mínimo de Revendas Recorrentes (Compras nos últimos 6 meses)</td>
                <td className="px-4 py-3 font-bold">5 revendas</td>
                <td className="px-4 py-3 font-bold">6 revendas</td>
                <td className="px-4 py-3 font-bold">8 revendas</td>
                <td className="px-4 py-3 font-bold">10 revendas</td>
                <td className="px-4 py-3 font-bold text-emerald-800 bg-emerald-50">R$ 3.500,00 / mês</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-emerald-700 font-bold">
            <Award className="w-5 h-5" />
            <h3>1. Faturamento e Consolidação de CNPJs</h3>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            A meta de faturamento é apurada com base na média mensal do trimestre de referência, somando todos os CNPJs (Matriz e Filiais) pertencentes à mesma raiz de CNPJ do distribuidor.
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-emerald-700 font-bold">
            <Users className="w-5 h-5" />
            <h3>2. Bônus por Estrutura de Equipe (+1%)</h3>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Distribuidores que mantiverem equipe mínima comprovada de <strong>1 vendedor dedicado, 1 engenheiro e 1 multiplicador</strong> recebem +1% cumulativo sobre o percentual da faixa.
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-emerald-700 font-bold">
            <Store className="w-5 h-5" />
            <h3>3. Bônus de Revendas Ativas (R$ 3.500,00)</h3>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Apurado mensalmente considerando revendas vinculadas a todos os CNPJs do distribuidor que compraram em pelo menos 1 dos últimos 3 meses. Reconhecido uma única vez por grupo econômico.
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-emerald-700 font-bold">
            <RefreshCw className="w-5 h-5" />
            <h3>4. Bônus de Revendas Recorrentes (R$ 3.500,00)</h3>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Avaliado mensalmente para revendas com compras consecutivas nos últimos 6 meses. Ao atingir o mínimo da faixa, garante bônus adicional de R$ 3.500,00 pago no mês subsequente.
          </p>
        </div>
      </div>

      <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-600">
        <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
        <p>
          <strong>Cláusula de Alteração:</strong> A empresa reserva-se o direito de alterar, suspender ou encerrar, total ou parcialmente, as regras, critérios, faixas, percentuais e valores previstos nesta política mediante comunicação formal com antecedência mínima de 30 dias.
        </p>
      </div>
    </div>
  )
}

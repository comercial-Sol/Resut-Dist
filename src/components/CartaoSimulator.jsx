import React, { useState } from 'react'
import { CreditCard, Percent, Calculator } from 'lucide-react'
import { calcularSimulacaoCartao, formatCurrency, formatPercent } from '../utils/radisCalculations'

export default function CartaoSimulator() {
  const [valorOriginal, setValorOriginal] = useState(9494.36)
  const [descontoIntegrador, setDescontoIntegrador] = useState(6)
  const [valorServico, setValorServico] = useState(0)
  const [numProposta, setNumProposta] = useState('PROJ26111647569')

  const resultado = calcularSimulacaoCartao(valorOriginal, descontoIntegrador, valorServico)

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Simulador de Desconto & Parcelamento no Cartão</h2>
            <p className="text-sm text-slate-500">Cálculo oficial com ISS (9,10%) sobre serviço e tabela de taxas de 1x a 21x</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Nº da Proposta</label>
            <input
              type="text"
              value={numProposta}
              onChange={(e) => setNumProposta(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Valor Original à Vista (Portal)</label>
            <input
              type="number"
              step="0.01"
              value={valorOriginal}
              onChange={(e) => setValorOriginal(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">% Desconto do Integrador</label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                value={descontoIntegrador}
                onChange={(e) => setDescontoIntegrador(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <Percent className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Valor Serviço Credenciado (R$)</label>
            <input
              type="number"
              step="0.01"
              value={valorServico}
              onChange={(e) => setValorServico(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <span className="text-xs text-slate-500 block">Valor do Desconto</span>
            <span className="text-base font-bold text-rose-600">- {formatCurrency(resultado.desconto)}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Equipamento c/ Desconto</span>
            <span className="text-base font-bold text-slate-900">{formatCurrency(resultado.valorVistaComDesconto)}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">ISS sobre Serviço (9,10%)</span>
            <span className="text-base font-bold text-amber-600">{formatCurrency(resultado.iss)}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Serviço Líquido</span>
            <span className="text-base font-bold text-slate-900">{formatCurrency(resultado.servicoLiquido)}</span>
          </div>
          <div className="bg-emerald-600 text-white p-2.5 rounded-lg">
            <span className="text-xs text-emerald-100 block">À Vista (PIX / Boleto / Financ.)</span>
            <span className="text-lg font-extrabold">{formatCurrency(resultado.baseTotal)}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-800">Tabela de Parcelamento no Cartão de Crédito — Proposta {numProposta}</h3>
          </div>
          <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 rounded-full">
            1x a 6x Sem Juros
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-800 text-white text-xs uppercase">
              <tr>
                <th className="px-6 py-3">Condição</th>
                <th className="px-6 py-3">Taxa Cartão</th>
                <th className="px-6 py-3">Valor da Parcela</th>
                <th className="px-6 py-3">Valor Total Final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {resultado.opcoes.map((op) => (
                <tr key={op.parcelas} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-semibold text-slate-900">Cartão de Crédito {op.parcelas}x</td>
                  <td className="px-6 py-3 text-slate-600">{formatPercent(op.taxa)}</td>
                  <td className="px-6 py-3 font-bold text-emerald-700">{formatCurrency(op.valorParcela)}</td>
                  <td className="px-6 py-3 font-medium text-slate-900">{formatCurrency(op.valorTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

import React from 'react'

const MONTHS = [
  ['01', 'Jan'], ['02', 'Fev'], ['03', 'Mar'], ['04', 'Abr'],
  ['05', 'Mai'], ['06', 'Jun'], ['07', 'Jul'], ['08', 'Ago'],
  ['09', 'Set'], ['10', 'Out'], ['11', 'Nov'], ['12', 'Dez'],
]

export default function PeriodFilter({
  yearsAvailable = [],
  selectedYears = [],
  selectedMonths = [],
  periodMode = 'current',
  onChange,
  dark = false,
}) {
  const now = new Date()
  const currentYear = String(now.getFullYear())
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0')
  const rootClass = dark
    ? 'rounded-lg border border-slate-700 bg-slate-800 text-white'
    : 'rounded-lg border border-slate-200 bg-white text-slate-800'
  const mutedClass = dark ? 'text-slate-300' : 'text-slate-500'
  const update = (next) => onChange?.({ selectedYears, selectedMonths, periodMode, ...next })

  const applyPreset = (mode) => {
    if (mode === 'current') {
      update({ periodMode: mode, selectedYears: [currentYear], selectedMonths: [currentMonth] })
    } else if (mode === 'accumulated') {
      update({ periodMode: mode, selectedYears: [currentYear], selectedMonths: MONTHS.filter(([m]) => m <= currentMonth).map(([m]) => m) })
    } else if (mode === 'all') {
      update({ periodMode: mode, selectedYears: yearsAvailable, selectedMonths: MONTHS.map(([m]) => m) })
    } else {
      update({ periodMode: mode })
    }
  }

  const toggle = (list, value, setter) => {
    const next = list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
    if (!next.length) return
    update({ periodMode: 'custom', [setter]: next.sort() })
  }

  const yearLabel = selectedYears.length === yearsAvailable.length
    ? 'Todos'
    : selectedYears.length === 1 ? selectedYears[0] : `${selectedYears.length} anos`
  const monthLabel = selectedMonths.length === 12
    ? 'Todos'
    : selectedMonths.length === 1
      ? (MONTHS.find(([m]) => m === selectedMonths[0])?.[1] || selectedMonths[0])
      : `${selectedMonths.length} meses`

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className={`mb-1 block text-[10px] font-bold uppercase ${mutedClass}`}>Período</label>
        <select value={periodMode} onChange={(e) => applyPreset(e.target.value)} className={`${rootClass} px-2.5 py-2 text-xs font-semibold`}>
          <option value="current">Mês vigente</option>
          <option value="accumulated">Acumulado no ano</option>
          <option value="custom">Personalizado</option>
          <option value="all">Todo o histórico</option>
        </select>
      </div>
      <details className="relative">
        <summary className={`list-none cursor-pointer ${rootClass} px-3 py-2 text-xs font-semibold`}>Anos: {yearLabel} ▾</summary>
        <div className="absolute right-0 z-40 mt-1 max-h-64 min-w-44 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-slate-800 shadow-xl">
          <div className="mb-2 flex justify-between gap-2 border-b pb-2">
            <button type="button" className="text-xs font-semibold text-emerald-700" onClick={() => update({ periodMode: 'custom', selectedYears: yearsAvailable })}>Todos</button>
            <button type="button" className="text-xs font-semibold text-slate-500" onClick={() => update({ periodMode: 'custom', selectedYears: [currentYear] })}>Ano atual</button>
          </div>
          {yearsAvailable.map((year) => (
            <label key={year} className="flex cursor-pointer items-center gap-2 py-1 text-xs">
              <input type="checkbox" checked={selectedYears.includes(year)} onChange={() => toggle(selectedYears, year, 'selectedYears')} />
              {year}
            </label>
          ))}
        </div>
      </details>
      <details className="relative">
        <summary className={`list-none cursor-pointer ${rootClass} px-3 py-2 text-xs font-semibold`}>Meses: {monthLabel} ▾</summary>
        <div className="absolute right-0 z-40 mt-1 grid min-w-48 grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-white p-3 text-slate-800 shadow-xl">
          <div className="col-span-3 mb-1 flex justify-between border-b pb-2">
            <button type="button" className="text-xs font-semibold text-emerald-700" onClick={() => update({ periodMode: 'custom', selectedMonths: MONTHS.map(([m]) => m) })}>Todos</button>
            <button type="button" className="text-xs font-semibold text-slate-500" onClick={() => update({ periodMode: 'custom', selectedMonths: [currentMonth] })}>Mês atual</button>
          </div>
          {MONTHS.map(([month, label]) => (
            <label key={month} className="flex cursor-pointer items-center gap-1 text-xs">
              <input type="checkbox" checked={selectedMonths.includes(month)} onChange={() => toggle(selectedMonths, month, 'selectedMonths')} />
              {label}
            </label>
          ))}
        </div>
      </details>
    </div>
  )
}

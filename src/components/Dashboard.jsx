import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, RefreshCw, Package, CalendarDays, X, Upload, Plus } from 'lucide-react'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { getMonthlyTotals, getCategoryTotals, getProjectTotals, getCategoryColor, getProjectColor, filterExpenses, convertToDisplay, fmtCurrency } from '../data/store'

const QUICK_RANGES = [
  { label: 'This month',  getRange: () => ({ from: format(startOfMonth(new Date()),'yyyy-MM-dd'), to: format(endOfMonth(new Date()),'yyyy-MM-dd') }) },
  { label: 'Last 3 mo',   getRange: () => ({ from: format(startOfMonth(subMonths(new Date(),2)),'yyyy-MM-dd'), to: format(endOfMonth(new Date()),'yyyy-MM-dd') }) },
  { label: 'Last 6 mo',   getRange: () => ({ from: format(startOfMonth(subMonths(new Date(),5)),'yyyy-MM-dd'), to: format(endOfMonth(new Date()),'yyyy-MM-dd') }) },
  { label: 'Last 12 mo',  getRange: () => ({ from: format(startOfMonth(subMonths(new Date(),11)),'yyyy-MM-dd'), to: format(endOfMonth(new Date()),'yyyy-MM-dd') }) },
  { label: 'All time',    getRange: () => ({ from: '', to: '' }) },
]

const CustomTooltip = ({ active, payload, label, display }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-4 py-3 text-sm shadow-xl" style={{ background:'var(--surface)', border:'1px solid var(--border)' }}>
      <p className="text-xs font-semibold mb-1" style={{ color:'var(--text-3)' }}>{label}</p>
      <p className="font-bold" style={{ color:'var(--text-1)' }}>{fmtCurrency(payload[0].value, display)}</p>
    </div>
  )
}

const PieTooltip = ({ active, payload, display }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-4 py-3 text-sm shadow-xl" style={{ background:'var(--surface)', border:'1px solid var(--border)' }}>
      <p className="text-xs font-semibold mb-1" style={{ color:'var(--text-3)' }}>{payload[0].name}</p>
      <p className="font-bold" style={{ color:'var(--text-1)' }}>{fmtCurrency(payload[0].value, display)}</p>
      <p className="text-xs mt-0.5" style={{ color:'var(--text-3)' }}>{payload[0].payload.percent}%</p>
    </div>
  )
}

function StatCard({ label, value, sub, icon: Icon, trend, iconColor }) {
  return (
    <div className="card fade-in">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg" style={{ background: iconColor + '18' }}>
          <Icon size={16} style={{ color: iconColor }} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${trend >= 0 ? 'text-red-500' : 'text-green-500'}`}
            style={{ background: trend >= 0 ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)' }}>
            {trend >= 0 ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <p className="section-label mb-1">{label}</p>
      <p className="text-2xl font-bold gradient-text leading-tight">{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color:'var(--text-3)' }}>{sub}</p>}
    </div>
  )
}

function ChartEmpty({ title, onImport, onAdd }) {
  return (
    <div className="h-52 flex flex-col items-center justify-center text-center px-4 gap-3">
      <p className="text-sm" style={{ color: 'var(--text-2)' }}>{title}</p>
      <p className="text-xs max-w-xs" style={{ color: 'var(--text-3)' }}>
        {onImport || onAdd
          ? 'Get started by importing your mastersheet or adding an expense.'
          : <>Import via <strong style={{ color: 'var(--text-2)' }}>Expenses → Import</strong> or add an expense from the header.</>}
      </p>
      {(onImport || onAdd) && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {onImport && (
            <button type="button" className="btn-primary text-xs gap-1.5" onClick={onImport}>
              <Upload size={12} /> Import
            </button>
          )}
          {onAdd && (
            <button type="button" className="btn-ghost text-xs gap-1.5" onClick={onAdd}>
              <Plus size={12} /> Add Expense
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function Dashboard({ expenses, recurring, categories, projects, currencySettings, onImport, onAdd }) {
  const { display } = currencySettings
  const defaultFrom = format(startOfMonth(subMonths(new Date(),5)),'yyyy-MM-dd')
  const defaultTo   = format(endOfMonth(new Date()),'yyyy-MM-dd')
  const [dateFrom, setDateFrom] = useState(defaultFrom)
  const [dateTo,   setDateTo]   = useState(defaultTo)

  function applyRange(r) { const rng=r.getRange(); setDateFrom(rng.from); setDateTo(rng.to) }
  function isRangeActive(r) { const rng=r.getRange(); return rng.from===dateFrom && rng.to===dateTo }

  const filteredExpenses = useMemo(() => filterExpenses(expenses, { dateFrom, dateTo }), [expenses, dateFrom, dateTo])
  const monthlyTotals    = useMemo(() => getMonthlyTotals(filteredExpenses, dateFrom, dateTo, currencySettings), [filteredExpenses, dateFrom, dateTo, currencySettings])
  const categoryTotals   = useMemo(() => {
    const cats  = getCategoryTotals(filteredExpenses, currencySettings)
    const total = cats.reduce((s,c) => s+c.value, 0)
    return cats.map(c => ({ ...c, percent: total ? +((c.value/total)*100).toFixed(1) : 0 }))
  }, [filteredExpenses, currencySettings])

  const projectTotals = useMemo(() => {
    // Include Company-wide + every project that has spend in the selected period
    const projs = getProjectTotals(filteredExpenses, currencySettings)
    const total = projs.reduce((s, p) => s + p.value, 0)
    return projs.map(p => ({ ...p, percent: total ? +((p.value / total) * 100).toFixed(1) : 0 }))
  }, [filteredExpenses, currencySettings])

  const periodTotal = filteredExpenses.reduce((s,e) => s + convertToDisplay(e.amount, e.currency, currencySettings), 0)

  const thisMonthStr   = format(new Date(),'yyyy-MM')
  const lastMonthStr   = format(subMonths(new Date(),1),'yyyy-MM')
  const currentMonthTotal = expenses.filter(e=>e.date?.startsWith(thisMonthStr)).reduce((s,e)=>s+convertToDisplay(e.amount,e.currency,currencySettings),0)
  const lastMonthTotal    = expenses.filter(e=>e.date?.startsWith(lastMonthStr)).reduce((s,e)=>s+convertToDisplay(e.amount,e.currency,currencySettings),0)
  const trend = lastMonthTotal ? ((currentMonthTotal-lastMonthTotal)/lastMonthTotal)*100 : 0

  const activeRecurring        = recurring.filter(r=>r.active)
  const activeMonthly          = activeRecurring.filter(r=>(r.frequency||'monthly')==='monthly')
  const monthlyRecurringTotal  = activeMonthly.reduce((s,r)=>s+convertToDisplay(r.amount,r.currency,currencySettings),0)
  const topCategory = categoryTotals[0]

  return (
    <div className="space-y-5 fade-in">
      {/* Date filter */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {QUICK_RANGES.map(r => (
            <button key={r.label} className={`pill ${isRangeActive(r)?'active':''}`} onClick={()=>applyRange(r)}>{r.label}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays size={14} style={{color:'var(--text-3)'}}/>
          <input type="date" className="input w-auto text-xs" value={dateFrom} max={dateTo||undefined} onChange={e=>setDateFrom(e.target.value)}/>
          <span className="text-xs" style={{color:'var(--text-3)'}}>→</span>
          <input type="date" className="input w-auto text-xs" value={dateTo} min={dateFrom||undefined} onChange={e=>setDateTo(e.target.value)}/>
          {(dateFrom||dateTo) && (
            <button className="text-xs flex items-center gap-1" style={{color:'var(--text-3)'}} onClick={()=>{setDateFrom('');setDateTo('')}}>
              <X size={11}/> Clear
            </button>
          )}
          <span className="ml-auto text-xs px-2 py-1 rounded-lg font-medium" style={{background:'var(--accent-dim)',color:'var(--accent)'}}>
            Totals in {display}
          </span>
        </div>
      </div>

      {/* Stats — 3 primary metrics + compact top category */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="This Month"      value={fmtCurrency(currentMonthTotal, display)}      sub={format(new Date(),'MMMM yyyy')}                                                   icon={DollarSign} trend={trend}  iconColor="#8b5cf6"/>
        <StatCard label="Recurring /mo"   value={fmtCurrency(monthlyRecurringTotal, display)}  sub={`${activeMonthly.length} active subscription${activeMonthly.length!==1?'s':''}`} icon={RefreshCw}               iconColor="#22c55e"/>
        <StatCard label="Period Total"    value={fmtCurrency(periodTotal, display)}             sub="Selected period"                                                                  icon={TrendingUp}               iconColor="#3b82f6"/>
        <div className="card fade-in col-span-2 lg:col-span-1 opacity-90" style={{ background: 'var(--surface-2)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg" style={{ background: '#ec489918' }}>
              <Package size={13} style={{ color: '#ec4899' }} />
            </div>
            <p className="section-label">Top Category</p>
          </div>
          <p className="text-lg font-bold leading-tight truncate" style={{ color: 'var(--text-1)' }}>{topCategory?.name ?? '—'}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
            {topCategory ? `${fmtCurrency(topCategory.value, display)} this period` : 'No spend in range'}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-sm mb-4" style={{color:'var(--text-1)'}}>Monthly Spend <span className="text-xs font-normal ml-1" style={{color:'var(--text-3)'}}>({display})</span></h3>
          {monthlyTotals.length===0
            ? <ChartEmpty title="No spend in this period" onImport={onImport} onAdd={onAdd} />
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyTotals} barSize={22} barCategoryGap="30%">
                  <XAxis dataKey="label" tick={{fontSize:11,fill:'var(--text-3)'}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:11,fill:'var(--text-3)'}} axisLine={false} tickLine={false} width={52} tickFormatter={v=>fmtCurrency(v,display)}/>
                  <Tooltip content={<CustomTooltip display={display}/>} cursor={{fill:'var(--surface-2)',radius:6}}/>
                  <Bar dataKey="total" radius={[6,6,2,2]}>
                    {monthlyTotals.map((_,i) => (
                      <Cell key={i} fill={i===monthlyTotals.length-1?'#7c3aed':'#a78bfa'}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>

        <div className="card">
          <h3 className="font-semibold text-sm mb-0.5" style={{color:'var(--text-1)'}}>By Category</h3>
          <p className="text-xs mb-3" style={{color:'var(--text-3)'}}>Selected period ({display})</p>
          {categoryTotals.length===0
            ? <ChartEmpty title="No categories to chart yet" onImport={onImport} onAdd={onAdd} />
            : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={categoryTotals} cx="50%" cy="44%" innerRadius={52} outerRadius={80} paddingAngle={3} dataKey="value">
                    {categoryTotals.map(entry => (
                      <Cell key={entry.name} fill={getCategoryColor(entry.name, categories)}/>
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip display={display}/>}/>
                  <Legend formatter={v=><span style={{fontSize:11,color:'var(--text-2)'}}>{v}</span>} iconSize={7} iconType="circle"/>
                </PieChart>
              </ResponsiveContainer>
            )
          }
        </div>
      </div>

      {/* By project */}
      {projectTotals.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-sm mb-4" style={{ color:'var(--text-1)' }}>Spend by Project <span className="text-xs font-normal ml-1" style={{ color:'var(--text-3)' }}>({display})</span></h3>
          <div className="space-y-2">
            {projectTotals.map(p => (
              <div key={p.name} className="flex items-center gap-3">
                <span className="text-xs font-medium w-28 truncate flex-shrink-0" style={{ color:'var(--text-2)' }}>{p.name}</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background:'var(--surface-2)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width:`${p.percent}%`, background: getProjectColor(p.name === 'Company-wide' ? null : p.name, projects) }} />
                </div>
                <span className="text-xs font-semibold tabular-nums w-24 text-right" style={{ color:'var(--text-1)' }}>{fmtCurrency(p.value, display)}</span>
                <span className="text-xs w-10 text-right" style={{ color:'var(--text-3)' }}>{p.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent */}
      <div className="card">
        <h3 className="font-semibold text-sm mb-4" style={{color:'var(--text-1)'}}>Recent Expenses</h3>
        <div>
          {expenses.slice().sort((a,b)=>(b.date??'').localeCompare(a.date??'')).slice(0,8).map((e,i,arr)=>(
            <div key={e.id} className={`flex items-center justify-between py-3 ${i<arr.length-1?'border-b':''}`} style={{borderColor:'var(--border-2)'}}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{background: getCategoryColor(e.category, categories)}}>
                  {e.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{color:'var(--text-1)'}}>{e.name}</p>
                  <p className="text-xs" style={{color:'var(--text-3)'}}>{e.date} · {e.category}{e.project ? ` · ${e.project}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-right">
                {e.recurringId && (() => {
                  const freq = recurring.find(r=>r.id===e.recurringId)?.frequency || 'monthly'
                  return <span className="badge" style={{background: freq==='yearly'?'rgba(245,158,11,0.12)':'var(--accent-dim)', color: freq==='yearly'?'#f59e0b':'var(--accent)'}}>
                    {freq==='yearly' ? '↺ Yearly' : '↺ Monthly'}
                  </span>
                })()}
                <div>
                  <p className="text-sm font-semibold" style={{color:'var(--text-1)'}}>{fmtCurrency(e.amount, e.currency)}</p>
                  {e.currency !== display && (
                    <p className="text-xs" style={{color:'var(--text-3)'}}>≈ {fmtCurrency(convertToDisplay(e.amount,e.currency,currencySettings), display)}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

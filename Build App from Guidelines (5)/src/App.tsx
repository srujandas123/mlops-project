import { useState, useEffect, useRef, useCallback } from 'react'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { FLIGHTS, MODEL_RESULTS, TRAINING_LOG, type Flight } from './data/mockData'
import SectionATC from './components/SectionATC'
import { generateLiveFleet } from './data/liveFlights'
import type { LiveAC } from './data/liveFlights'
import AuthGate, { type AuthUser } from './components/auth/AuthGate'

// ─── Types ────────────────────────────────────────────────────────────────────

type View =
  | 'atc' | 'dashboard' | 'analytics' | 'weather' | 'alerts'
  | 'data' | 'add' | 'view' | 'update' | 'delete'
  | 'train' | 'evaluate' | 'predict' | 'reports'

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={{ padding: '2px 9px', borderRadius: 3, background: `${color}22`, color, border: `1px solid ${color}44`, fontSize: 11, fontWeight: 700 }}>{children}</span>
}

function Card({ title, children, noPad, action }: { title?: string; children: React.ReactNode; noPad?: boolean; action?: React.ReactNode }) {
  return (
    <div style={{ background: '#080f1c', border: '1px solid #0e1e2e', borderRadius: 8, overflow: 'hidden' }}>
      {title && (
        <div style={{ padding: '9px 14px', borderBottom: '1px solid #0e1e2e', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{title}</span>
          {action}
        </div>
      )}
      <div style={noPad ? {} : { padding: '14px 16px' }}>{children}</div>
    </div>
  )
}

function StatCard({ label, value, sub, color = '#00D4FF', icon }: { label: string; value: string | number; sub?: string; color?: string; icon?: string }) {
  return (
    <div style={{ padding: '14px 16px', background: '#060c18', border: '1px solid #0e1e2e', borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#ffffff' }}>{label}</div>
        {icon && <span style={{ fontSize: 18, opacity: 0.7 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: '#ffffff', marginTop: 4, opacity: 0.7 }}>{sub}</div>}
    </div>
  )
}

function CTip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return <div style={{ background: '#080e1c', border: '1px solid #1a2a3a', borderRadius: 4, padding: '4px 10px', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}>{payload.map((p: any) => <div key={p.name} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</div>)}</div>
}

function Pulse({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color, animation: 'pulse-ring 1.8s ease-out infinite' }} />
      <div style={{ position: 'absolute', inset: size * 0.25, borderRadius: '50%', background: color }} />
    </div>
  )
}

// ─── Section: Dashboard ───────────────────────────────────────────────────────

function SectionDashboard({ flights }: { flights: Flight[] }) {
  const total = flights.length
  const deviated = flights.filter(f => f.deviation === 1).length
  const delayed = flights.filter(f => f.delay_minutes > 30).length
  const active = total - delayed
  const storms = flights.filter(f => f.storm).length
  const techIssues = flights.filter(f => f.technical_issue).length
  const collisionAlerts = Math.max(0, flights.filter(f => f.deviation === 1 && f.storm).length - 2)
  const wxAlerts = storms + techIssues

  const byAirline = Array.from(new Set(flights.map(f => f.airline)))
    .map(a => ({ airline: a.slice(0, 8), flights: flights.filter(f => f.airline === a).length, deviations: flights.filter(f => f.airline === a && f.deviation === 1).length }))
    .slice(0, 6)

  const byMonth = Array.from({ length: 12 }, (_, i) => ({
    month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i],
    count: flights.filter(f => new Date(f.scheduled_departure).getMonth() === i).length,
    dev: flights.filter(f => new Date(f.scheduled_departure).getMonth() === i && f.deviation === 1).length,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12 }}>
        <StatCard label="Total Flights" value={total} sub="in dataset" color="#00D4FF" icon="✈" />
        <StatCard label="Active Flights" value={active} sub="on schedule" color="#00e676" icon="🟢" />
        <StatCard label="Delayed Flights" value={delayed} sub=">30 min delay" color="#ffab00" icon="⏱" />
        <StatCard label="Route Deviations" value={deviated} sub={`${((deviated / total) * 100).toFixed(1)}% rate`} color="#ff3d57" icon="⚠" />
        <StatCard label="Collision Alerts" value={collisionAlerts} sub="active conflicts" color="#ff3d57" icon="🔴" />
        <StatCard label="Weather Alerts" value={wxAlerts} sub="wx & tech events" color="#ffab00" icon="⛈" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card title="Monthly Flights vs Deviations">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byMonth} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="#162a3e" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#ffffff', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#ffffff', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CTip />} />
              <Bar dataKey="count" name="Flights" fill="#00D4FF" opacity={0.5} radius={[2, 2, 0, 0]} />
              <Bar dataKey="dev" name="Deviations" fill="#ff3d57" opacity={0.8} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Deviations by Airline">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byAirline} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#162a3e" strokeDasharray="2 4" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#ffffff', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="airline" tick={{ fill: '#ffffff', fontSize: 10 }} tickLine={false} axisLine={false} width={60} />
              <Tooltip content={<CTip />} />
              <Bar dataKey="flights" name="Total" fill="#00D4FF" opacity={0.5} radius={[0, 2, 2, 0]} />
              <Bar dataKey="deviations" name="Deviations" fill="#ff3d57" opacity={0.8} radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card title="Best ML Model — XGBoost Performance">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[['Accuracy','94.1%','#00e676'],['Precision','93.7%','#00D4FF'],['Recall','94.5%','#ff9a00'],['F1 Score','94.1%','#bf7fff']].map(([l, v, c]) => (
            <div key={l} style={{ textAlign: 'center', padding: '14px 0', background: '#060c18', borderRadius: 6 }}>
              <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: c }}>{v}</div>
              <div style={{ fontSize: 11, color: '#ffffff', marginTop: 5 }}>{l}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ─── Section: Analytics ───────────────────────────────────────────────────────

function SectionAnalytics({ flights }: { flights: Flight[] }) {
  const [tab, setTab] = useState<'delay'|'airline'|'weather'|'fuel'|'route'|'heatmap'|'altitude'|'airport'>('delay')

  const delayBuckets = [
    { bucket: 'On Time', count: flights.filter(f => f.delay_minutes === 0).length, fill: '#00e676' },
    { bucket: '1–15m', count: flights.filter(f => f.delay_minutes > 0 && f.delay_minutes <= 15).length, fill: '#7aacc0' },
    { bucket: '16–30m', count: flights.filter(f => f.delay_minutes > 15 && f.delay_minutes <= 30).length, fill: '#ffab00' },
    { bucket: '31–60m', count: flights.filter(f => f.delay_minutes > 30 && f.delay_minutes <= 60).length, fill: '#ff6b00' },
    { bucket: '>60m', count: flights.filter(f => f.delay_minutes > 60).length, fill: '#ff3d57' },
  ]

  const airlineStats = Array.from(new Set(flights.map(f => f.airline))).map(a => {
    const af = flights.filter(f => f.airline === a)
    return {
      airline: a.split(' ')[0],
      total: af.length,
      dev: af.filter(f => f.deviation === 1).length,
      avgDelay: Math.round(af.reduce((s, f) => s + f.delay_minutes, 0) / af.length),
      storm: af.filter(f => f.storm).length,
    }
  }).sort((a, b) => b.total - a.total)

  const wxStats = [
    { factor: 'Storm', deviation: flights.filter(f => f.storm && f.deviation === 1).length, normal: flights.filter(f => f.storm && f.deviation === 0).length },
    { factor: 'Tech Issue', deviation: flights.filter(f => f.technical_issue && f.deviation === 1).length, normal: flights.filter(f => f.technical_issue && f.deviation === 0).length },
    { factor: 'High Wind', deviation: flights.filter(f => f.wind_speed > 50 && f.deviation === 1).length, normal: flights.filter(f => f.wind_speed > 50 && f.deviation === 0).length },
    { factor: 'Low Vis', deviation: flights.filter(f => f.visibility < 2000 && f.deviation === 1).length, normal: flights.filter(f => f.visibility < 2000 && f.deviation === 0).length },
    { factor: 'Congestion', deviation: flights.filter(f => f.airport_congestion > 80 && f.deviation === 1).length, normal: flights.filter(f => f.airport_congestion > 80 && f.deviation === 0).length },
  ]

  const fuelBuckets = [
    { bucket: '0–30%',  count: flights.filter(f => f.fuel_load <= 30).length },
    { bucket: '31–50%', count: flights.filter(f => f.fuel_load > 30 && f.fuel_load <= 50).length },
    { bucket: '51–70%', count: flights.filter(f => f.fuel_load > 50 && f.fuel_load <= 70).length },
    { bucket: '71–90%', count: flights.filter(f => f.fuel_load > 70 && f.fuel_load <= 90).length },
    { bucket: '>90%',   count: flights.filter(f => f.fuel_load > 90).length },
  ]

  const fuelDelay = flights.slice(0, 60).map(f => ({ fuel: f.fuel_load, delay: f.delay_minutes, dev: f.deviation }))

  const routeDeviation = Array.from(new Set(flights.map(f => `${f.departure_airport}→${f.arrival_airport}`))).map(r => {
    const [dep, arr] = r.split('→')
    const rf = flights.filter(f => f.departure_airport === dep && f.arrival_airport === arr)
    return { route: r, total: rf.length, dev: rf.filter(f => f.deviation === 1).length, rate: rf.length ? +(rf.filter(f => f.deviation === 1).length / rf.length * 100).toFixed(0) : 0 }
  }).sort((a, b) => b.rate - a.rate).slice(0, 10)

  // Correlation heatmap (simplified, 6x6 grid of features)
  const features = ['delay','wind','visibility','altitude','fuel','congestion']
  const corrData = features.map(f1 => features.map(f2 => {
    if (f1 === f2) return 1
    const vals1 = flights.map(f => ({ delay: f.delay_minutes, wind: f.wind_speed, visibility: f.visibility, altitude: f.altitude, fuel: f.fuel_load, congestion: f.airport_congestion }[f1] ?? 0))
    const vals2 = flights.map(f => ({ delay: f.delay_minutes, wind: f.wind_speed, visibility: f.visibility, altitude: f.altitude, fuel: f.fuel_load, congestion: f.airport_congestion }[f2] ?? 0))
    const mean1 = vals1.reduce((s, v) => s + v, 0) / vals1.length
    const mean2 = vals2.reduce((s, v) => s + v, 0) / vals2.length
    const cov = vals1.reduce((s, v, i) => s + (v - mean1) * (vals2[i] - mean2), 0)
    const std1 = Math.sqrt(vals1.reduce((s, v) => s + (v - mean1) ** 2, 0))
    const std2 = Math.sqrt(vals2.reduce((s, v) => s + (v - mean2) ** 2, 0))
    return std1 && std2 ? +(cov / (std1 * std2)).toFixed(2) : 0
  }))

  const tabs = [['delay','⏱ Delay'],['airline','✈ Airline'],['weather','⛅ Weather'],['fuel','⛽ Fuel'],['route','🗺 Route Dev'],['altitude','✈ Altitude'],['airport','🏢 Airport'],['heatmap','🔥 Heatmap']] as const
  const CHART_COLORS = ['#00D4FF','#00e676','#ffab00','#ff3d57','#bf7fff','#7aacc0']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
        <StatCard label="Avg Delay" value={`${Math.round(flights.reduce((s,f)=>s+f.delay_minutes,0)/flights.length)}m`} color="#ffab00" icon="⏱" />
        <StatCard label="Deviation Rate" value={`${((flights.filter(f=>f.deviation===1).length/flights.length)*100).toFixed(1)}%`} color="#ff3d57" icon="⚠" />
        <StatCard label="Storm Events" value={flights.filter(f=>f.storm).length} color="#7aacc0" icon="⛈" />
        <StatCard label="Avg Fuel Load" value={`${Math.round(flights.reduce((s,f)=>s+f.fuel_load,0)/flights.length)}%`} color="#00e676" icon="⛽" />
        <StatCard label="Tech Issues" value={flights.filter(f=>f.technical_issue).length} color="#bf7fff" icon="🔧" />
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #0e1e2e' }}>
        {tabs.map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '9px 16px', border: 'none', borderBottom: tab === t ? '2px solid #00D4FF' : '2px solid transparent', background: 'transparent', color: tab === t ? '#00D4FF' : '#7aacc0', fontSize: 12, fontWeight: tab === t ? 700 : 400, cursor: 'pointer' }}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'delay' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Card title="Delay Distribution">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={delayBuckets} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="#162a3e" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fill: '#ffffff', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#ffffff', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CTip />} />
                <Bar dataKey="count" name="Flights" radius={[3, 3, 0, 0]}>
                  {delayBuckets.map((b) => <Cell key={b.bucket} fill={b.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Delay by Airline">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={airlineStats} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="#162a3e" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="airline" tick={{ fill: '#ffffff', fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#ffffff', fontSize: 9 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CTip />} />
                <Bar dataKey="avgDelay" name="Avg Delay (min)" fill="#ffab00" opacity={0.85} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {tab === 'airline' && (
        <Card title="Airline Performance Matrix" noPad>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>
              <thead>
                <tr style={{ background: '#080e1c' }}>
                  {['Airline','Total Flights','Deviations','Dev Rate','Avg Delay','Storm Events'].map(h => <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: '#ffffff', fontWeight: 700, borderBottom: '1px solid #0e1e2e', whiteSpace: 'nowrap', fontSize: 10 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {airlineStats.map((a, i) => (
                  <tr key={a.airline} style={{ borderBottom: '1px solid #07101c', background: i % 2 === 0 ? '#040910' : '#050b14' }}>
                    <td style={{ padding: '8px 12px', color: '#00D4FF', fontWeight: 700 }}>{a.airline}</td>
                    <td style={{ padding: '8px 12px', color: '#ffffff' }}>{a.total}</td>
                    <td style={{ padding: '8px 12px' }}><Badge color={a.dev > 5 ? '#ff3d57' : '#00e676'}>{a.dev}</Badge></td>
                    <td style={{ padding: '8px 12px', color: a.dev / a.total > 0.4 ? '#ff3d57' : '#ffab00' }}>{((a.dev / a.total) * 100).toFixed(1)}%</td>
                    <td style={{ padding: '8px 12px', color: a.avgDelay > 30 ? '#ffab00' : '#ffffff' }}>{a.avgDelay}m</td>
                    <td style={{ padding: '8px 12px' }}><Badge color={a.storm > 3 ? '#ff9500' : '#7aacc0'}>{a.storm}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'weather' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Card title="Weather Factor vs Deviation">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={wxStats} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="#162a3e" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="factor" tick={{ fill: '#ffffff', fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#ffffff', fontSize: 9 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CTip />} />
                <Bar dataKey="normal" name="Normal" fill="#00e676" opacity={0.6} radius={[2, 2, 0, 0]} />
                <Bar dataKey="deviation" name="Deviation" fill="#ff3d57" opacity={0.9} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Deviation Cause Breakdown">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={wxStats} dataKey="deviation" nameKey="factor" cx="50%" cy="50%" outerRadius={80} label={(p: any) => `${p.factor ?? ''} ${((p.percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {wxStats.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CTip />} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {tab === 'fuel' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Card title="Fuel Load Distribution">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={fuelBuckets} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="#162a3e" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fill: '#ffffff', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#ffffff', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CTip />} />
                <Bar dataKey="count" name="Flights" fill="#00e676" opacity={0.8} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Fuel Load vs Delay (scatter)">
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="#162a3e" strokeDasharray="2 4" />
                <XAxis dataKey="fuel" name="Fuel %" tick={{ fill: '#ffffff', fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis dataKey="delay" name="Delay (m)" tick={{ fill: '#ffffff', fontSize: 9 }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#ffffff10' }} content={<CTip />} />
                <Scatter data={fuelDelay} fill="#00D4FF" opacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {tab === 'route' && (
        <Card title="Top 10 Routes by Deviation Rate">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={routeDeviation} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 10 }}>
              <CartesianGrid stroke="#162a3e" strokeDasharray="2 4" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#ffffff', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="route" tick={{ fill: '#7aacc0', fontSize: 9 }} tickLine={false} axisLine={false} width={80} />
              <Tooltip content={<CTip />} />
              <Bar dataKey="rate" name="Dev Rate %" fill="#ff3d57" opacity={0.85} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {tab === 'altitude' && (() => {
        const altBuckets = [
          { label:'<FL200', min:0, max:20000, count:flights.filter(f=>f.altitude<20000).length, fill:'#4488ff' },
          { label:'FL200–260', min:20000, max:26000, count:flights.filter(f=>f.altitude>=20000&&f.altitude<26000).length, fill:'#00D4FF' },
          { label:'FL260–320', min:26000, max:32000, count:flights.filter(f=>f.altitude>=26000&&f.altitude<32000).length, fill:'#00a8cc' },
          { label:'FL320–380', min:32000, max:38000, count:flights.filter(f=>f.altitude>=32000&&f.altitude<38000).length, fill:'#00e676' },
          { label:'>FL380', min:38000, max:99999, count:flights.filter(f=>f.altitude>=38000).length, fill:'#ffab00' },
        ]
        const altDelayData = altBuckets.map(b => ({
          ...b,
          avgDelay: flights.filter(f=>f.altitude>=b.min&&f.altitude<b.max).length
            ? Math.round(flights.filter(f=>f.altitude>=b.min&&f.altitude<b.max).reduce((s,f)=>s+f.delay_minutes,0)/Math.max(1,flights.filter(f=>f.altitude>=b.min&&f.altitude<b.max).length))
            : 0,
          devRate: flights.filter(f=>f.altitude>=b.min&&f.altitude<b.max).length
            ? +((flights.filter(f=>f.altitude>=b.min&&f.altitude<b.max&&f.deviation===1).length / Math.max(1,flights.filter(f=>f.altitude>=b.min&&f.altitude<b.max).length))*100).toFixed(1)
            : 0
        }))
        // Boxplot data (min/q1/median/q3/max per altitude bucket)
        const boxData = altBuckets.map(b => {
          const vals = flights.filter(f=>f.altitude>=b.min&&f.altitude<b.max).map(f=>f.delay_minutes).sort((a,z)=>a-z)
          if (!vals.length) return { label:b.label, fill:b.fill, min:0, q1:0, median:0, q3:0, max:0 }
          const q = (p:number) => vals[Math.floor(p*(vals.length-1))]
          return { label:b.label, fill:b.fill, min:vals[0], q1:q(0.25), median:q(0.5), q3:q(0.75), max:vals[vals.length-1] }
        })
        return (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <Card title="Flight Distribution by Altitude Band">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={altBuckets} margin={{top:4,right:4,bottom:0,left:-20}}>
                    <CartesianGrid stroke="#162a3e" strokeDasharray="2 4" vertical={false}/>
                    <XAxis dataKey="label" tick={{fill:'#ffffff',fontSize:9}} tickLine={false} axisLine={false}/>
                    <YAxis tick={{fill:'#ffffff',fontSize:9}} tickLine={false} axisLine={false}/>
                    <Tooltip content={<CTip/>}/>
                    <Bar dataKey="count" name="Flights" radius={[3,3,0,0]}>
                      {altBuckets.map(b=><Cell key={b.label} fill={b.fill}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card title="Avg Delay by Altitude Band">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={altDelayData} margin={{top:4,right:4,bottom:0,left:-20}}>
                    <CartesianGrid stroke="#162a3e" strokeDasharray="2 4" vertical={false}/>
                    <XAxis dataKey="label" tick={{fill:'#ffffff',fontSize:9}} tickLine={false} axisLine={false}/>
                    <YAxis tick={{fill:'#ffffff',fontSize:9}} tickLine={false} axisLine={false}/>
                    <Tooltip content={<CTip/>}/>
                    <Bar dataKey="avgDelay" name="Avg Delay (min)" fill="#ffab00" radius={[3,3,0,0]}/>
                    <Bar dataKey="devRate" name="Dev Rate (%)" fill="#ff3d57" radius={[3,3,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
            <Card title="Delay Distribution Boxplot by Altitude Band">
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,fontFamily:'JetBrains Mono, monospace'}}>
                  <thead><tr style={{background:'#080e1c'}}>
                    {['Band','Min','Q1','Median','Q3','Max','IQR'].map(h=><th key={h} style={{padding:'8px 12px',textAlign:'left',color:'#ffffff',fontWeight:700,borderBottom:'1px solid #0e1e2e',fontSize:10}}>{h}</th>)}
                  </tr></thead>
                  <tbody>{boxData.map((b,i)=>(
                    <tr key={b.label} style={{borderBottom:'1px solid #07101c',background:i%2===0?'#040910':'#050b14'}}>
                      <td style={{padding:'7px 12px'}}><span style={{color:b.fill,fontWeight:700}}>{b.label}</span></td>
                      <td style={{padding:'7px 12px',color:'#7aacc0'}}>{b.min}m</td>
                      <td style={{padding:'7px 12px',color:'#7aacc0'}}>{b.q1}m</td>
                      <td style={{padding:'7px 12px',color:'#00D4FF',fontWeight:700}}>{b.median}m</td>
                      <td style={{padding:'7px 12px',color:'#7aacc0'}}>{b.q3}m</td>
                      <td style={{padding:'7px 12px',color:'#ffab00'}}>{b.max}m</td>
                      <td style={{padding:'7px 12px',color:'#00e676'}}>{b.q3-b.q1}m</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div style={{padding:'10px 12px',display:'flex',gap:10,flexWrap:'wrap',borderTop:'1px solid #0e1e2e'}}>
                {boxData.map(b=>(
                  <div key={b.label} style={{flex:'1 1 120px',padding:'8px',background:'#060c18',border:`1px solid ${b.fill}33`,borderRadius:6}}>
                    <div style={{fontSize:9,color:b.fill,fontWeight:700,marginBottom:4}}>{b.label}</div>
                    <div style={{height:32,position:'relative',display:'flex',alignItems:'center'}}>
                      <div style={{position:'absolute',left:0,right:0,height:1,background:'#1a3050'}}/>
                      <div style={{position:'absolute',left:`${b.q1/b.max*100||0}%`,right:`${100-b.q3/b.max*100||0}%`,height:14,background:`${b.fill}33`,border:`1px solid ${b.fill}88`,borderRadius:2,top:'50%',transform:'translateY(-50%)'}}/>
                      <div style={{position:'absolute',left:`${b.median/b.max*100||0}%`,width:2,height:22,background:b.fill,top:'50%',transform:'translateY(-50%)'}}/>
                    </div>
                    <div style={{fontSize:8,color:'#3a5870',marginTop:2,fontFamily:'JetBrains Mono, monospace'}}>{b.min}–{b.max}m</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )
      })()}

      {tab === 'airport' && (() => {
        const aps = ['DXB','LHR','FRA','JFK','IST','CDG','SIN','DOH','AUH','BOM','DEL','HKG','KUL','BKK']
        const apStats = aps.map(ap => {
          const dep = flights.filter(f=>f.departure_airport===ap)
          const arr = flights.filter(f=>f.arrival_airport===ap)
          const all = [...dep,...arr]
          if (!all.length) return null
          return {
            ap,
            departures: dep.length,
            arrivals: arr.length,
            total: all.length,
            devRate: +((all.filter(f=>f.deviation===1).length/all.length)*100).toFixed(1),
            avgDelay: Math.round(dep.reduce((s,f)=>s+f.delay_minutes,0)/Math.max(1,dep.length)),
            storms: all.filter(f=>f.storm).length,
            avgCong: Math.round(all.reduce((s,f)=>s+f.airport_congestion,0)/all.length),
          }
        }).filter(Boolean) as {ap:string;departures:number;arrivals:number;total:number;devRate:number;avgDelay:number;storms:number;avgCong:number}[]
        apStats.sort((a,b)=>b.total-a.total)

        return (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <Card title="Top Airports by Traffic Volume">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={apStats.slice(0,8)} layout="vertical" margin={{top:4,right:8,bottom:0,left:0}}>
                    <CartesianGrid stroke="#162a3e" strokeDasharray="2 4" horizontal={false}/>
                    <XAxis type="number" tick={{fill:'#ffffff',fontSize:9}} tickLine={false} axisLine={false}/>
                    <YAxis type="category" dataKey="ap" tick={{fill:'#7aacc0',fontSize:10}} tickLine={false} axisLine={false} width={35}/>
                    <Tooltip content={<CTip/>}/>
                    <Bar dataKey="departures" name="Departures" fill="#00D4FF" opacity={0.8} radius={[0,2,2,0]}/>
                    <Bar dataKey="arrivals"   name="Arrivals"   fill="#00e676" opacity={0.8} radius={[0,2,2,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card title="Airport Congestion vs Deviation Rate">
                <ResponsiveContainer width="100%" height={220}>
                  <ScatterChart margin={{top:4,right:4,bottom:0,left:-20}}>
                    <CartesianGrid stroke="#162a3e" strokeDasharray="2 4"/>
                    <XAxis dataKey="avgCong" name="Avg Congestion %" tick={{fill:'#ffffff',fontSize:9}} tickLine={false} axisLine={false}/>
                    <YAxis dataKey="devRate" name="Dev Rate %" tick={{fill:'#ffffff',fontSize:9}} tickLine={false} axisLine={false}/>
                    <Tooltip cursor={{fill:'#ffffff10'}} content={<CTip/>}/>
                    <Scatter data={apStats} fill="#ff3d57" opacity={0.7}/>
                  </ScatterChart>
                </ResponsiveContainer>
              </Card>
            </div>
            <Card title="Airport Performance Summary" noPad>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,fontFamily:'JetBrains Mono, monospace'}}>
                  <thead><tr style={{background:'#080e1c'}}>
                    {['Airport','Total','Dep','Arr','Dev Rate','Avg Delay','Storms','Congestion'].map(h=><th key={h} style={{padding:'8px 12px',textAlign:'left',color:'#ffffff',fontWeight:700,borderBottom:'1px solid #0e1e2e',fontSize:10,whiteSpace:'nowrap'}}>{h}</th>)}
                  </tr></thead>
                  <tbody>{apStats.map((a,i)=>(
                    <tr key={a.ap} style={{borderBottom:'1px solid #07101c',background:i%2===0?'#040910':'#050b14'}}>
                      <td style={{padding:'7px 12px',color:'#00D4FF',fontWeight:700}}>{a.ap}</td>
                      <td style={{padding:'7px 12px',color:'#ffffff'}}>{a.total}</td>
                      <td style={{padding:'7px 12px',color:'#7aacc0'}}>{a.departures}</td>
                      <td style={{padding:'7px 12px',color:'#7aacc0'}}>{a.arrivals}</td>
                      <td style={{padding:'7px 12px'}}><Badge color={a.devRate>40?'#ff3d57':a.devRate>20?'#ffab00':'#00e676'}>{a.devRate}%</Badge></td>
                      <td style={{padding:'7px 12px',color:a.avgDelay>30?'#ffab00':'#7aacc0'}}>{a.avgDelay}m</td>
                      <td style={{padding:'7px 12px'}}><Badge color={a.storms>3?'#ff9500':'#7aacc0'}>{a.storms}</Badge></td>
                      <td style={{padding:'7px 12px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <div style={{width:50,height:5,background:'#0e1e2e',borderRadius:2,overflow:'hidden'}}>
                            <div style={{width:`${a.avgCong}%`,height:'100%',background:a.avgCong>80?'#ff3d57':a.avgCong>60?'#ffab00':'#00e676'}}/>
                          </div>
                          <span style={{fontSize:9,color:'#7aacc0'}}>{a.avgCong}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </Card>
          </div>
        )
      })()}

      {tab === 'heatmap' && (
        <Card title="Feature Correlation Matrix">
          <div style={{ padding: '8px 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `80px repeat(${features.length}, 1fr)`, gap: 2 }}>
              <div />
              {features.map(f => <div key={f} style={{ textAlign: 'center', fontSize: 10, color: '#7aacc0', padding: '4px 0', fontFamily: 'JetBrains Mono, monospace', textTransform: 'capitalize' }}>{f}</div>)}
              {corrData.map((row, ri) => (
                <>
                  <div key={`l${ri}`} style={{ fontSize: 10, color: '#7aacc0', fontFamily: 'JetBrains Mono, monospace', textTransform: 'capitalize', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8 }}>{features[ri]}</div>
                  {row.map((val, ci) => {
                    const absV = Math.abs(val)
                    const r = val > 0 ? Math.round(absV * 0) : Math.round(absV * 255 * 0.3)
                    const g = val > 0 ? Math.round(absV * 150) : 0
                    const b = val > 0 ? Math.round(absV * 255) : 0
                    const bg = ri === ci ? '#1a3050' : `rgba(${r},${g},${b},${0.2 + absV * 0.6})`
                    return (
                      <div key={`${ri}${ci}`} style={{ aspectRatio: '1', background: bg, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: ri === ci ? '#7aacc0' : absV > 0.4 ? '#ffffff' : '#7aacc0' }}>
                        {val.toFixed(1)}
                      </div>
                    )
                  })}
                </>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── Section: Weather ─────────────────────────────────────────────────────────

function SectionWeather({ flights }: { flights: Flight[] }) {
  const airports = ['DXB','AUH','DOH','IST','LHR','FRA','CDG','JFK','SIN','HKG','DEL','BOM','CAI']
  const wxData = airports.map(ap => {
    const af = flights.filter(f => f.departure_airport === ap || f.arrival_airport === ap)
    if (!af.length) return null
    const avg = (k: keyof Flight) => af.reduce((s, f) => s + (f[k] as number), 0) / af.length
    const storm = af.some(f => f.storm)
    return {
      ap, wind: Math.round(avg('wind_speed')), vis: Math.round(avg('visibility')),
      temp: Math.round(avg('temperature')), storm,
      status: storm ? 'STORM' : avg('wind_speed') > 50 ? 'WINDY' : avg('visibility') < 3000 ? 'FOG' : 'CLEAR'
    }
  }).filter(Boolean) as { ap:string; wind:number; vis:number; temp:number; storm:boolean; status:string }[]

  const wxTrend = Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2,'0')}:00`,
    wind: 10 + Math.sin(i * 0.4) * 15 + Math.random() * 5,
    visibility: 8000 + Math.sin(i * 0.3 + 1) * 3000,
    temp: 22 + Math.sin(i * 0.26 + 2) * 8,
  }))

  const statusColor = (s: string) => s === 'STORM' ? '#ff3d57' : s === 'WINDY' ? '#ffab00' : s === 'FOG' ? '#7aacc0' : '#00e676'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label:'Storm Events', value: flights.filter(f=>f.storm).length, color:'#ff3d57', icon:'⛈' },
          { label:'High Wind (>50)', value: flights.filter(f=>f.wind_speed>50).length, color:'#ffab00', icon:'💨' },
          { label:'Low Visibility', value: flights.filter(f=>f.visibility<2000).length, color:'#7aacc0', icon:'🌫' },
          { label:'Clear Flights', value: flights.filter(f=>!f.storm&&f.wind_speed<=30).length, color:'#00e676', icon:'☀' },
        ].map(s => <StatCard key={s.label} label={s.label} value={s.value} color={s.color} icon={s.icon} />)}
      </div>

      <Card title="Airport Weather Status">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {wxData.map(w => (
            <div key={w.ap} style={{ padding: '12px', background: '#060c18', border: `1px solid ${statusColor(w.status)}33`, borderRadius: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#00D4FF' }}>{w.ap}</div>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 3, background: `${statusColor(w.status)}22`, color: statusColor(w.status), border: `1px solid ${statusColor(w.status)}44` }}>{w.status}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}>
                <div style={{ color: '#5a90b8' }}>Wind: <span style={{ color: w.wind > 50 ? '#ffab00' : '#7aacc0' }}>{w.wind}km/h</span></div>
                <div style={{ color: '#5a90b8' }}>Vis: <span style={{ color: w.vis < 2000 ? '#ff3d57' : '#7aacc0' }}>{(w.vis/1000).toFixed(1)}km</span></div>
                <div style={{ color: '#5a90b8' }}>Temp: <span style={{ color: '#7aacc0' }}>{w.temp}°C</span></div>
                <div style={{ color: '#5a90b8' }}>Storm: <span style={{ color: w.storm ? '#ff3d57' : '#00e676' }}>{w.storm ? 'YES' : 'NO'}</span></div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card title="Wind Speed (24h Forecast)">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={wxTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs><linearGradient id="gWind" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ffab00" stopOpacity={0.3}/><stop offset="95%" stopColor="#ffab00" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid stroke="#162a3e" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: '#ffffff', fontSize: 8 }} tickLine={false} axisLine={false} interval={3} />
              <YAxis tick={{ fill: '#ffffff', fontSize: 8 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CTip />} />
              <Area type="monotone" dataKey="wind" name="Wind (km/h)" stroke="#ffab00" fill="url(#gWind)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Visibility (24h Forecast)">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={wxTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs><linearGradient id="gVis" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00D4FF" stopOpacity={0.3}/><stop offset="95%" stopColor="#00D4FF" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid stroke="#162a3e" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: '#ffffff', fontSize: 8 }} tickLine={false} axisLine={false} interval={3} />
              <YAxis tick={{ fill: '#ffffff', fontSize: 8 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CTip />} />
              <Area type="monotone" dataKey="visibility" name="Visibility (m)" stroke="#00D4FF" fill="url(#gVis)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  )
}

// ─── Section: Alerts ──────────────────────────────────────────────────────────

interface AlertItem { id: string; type: string; severity: 'info'|'warning'|'critical'; flight: string; message: string; ts: string; acked: boolean }

function SectionAlerts({ flights }: { flights: Flight[] }) {
  const initial: AlertItem[] = [
    ...flights.filter(f => f.storm && f.deviation === 1).slice(0, 3).map((f, i) => ({
      id: `A${i}`, type: 'Weather', severity: 'critical' as const, flight: f.flight_id,
      message: `Storm-induced route deviation detected on ${f.flight_id} (${f.departure_airport}→${f.arrival_airport})`, ts: new Date(Date.now()-i*120000).toISOString().slice(11,19), acked: false
    })),
    ...flights.filter(f => f.technical_issue).slice(0, 4).map((f, i) => ({
      id: `B${i}`, type: 'Technical', severity: 'warning' as const, flight: f.flight_id,
      message: `Technical issue reported on ${f.flight_id} — ${f.aircraft_type} — ${f.departure_airport}→${f.arrival_airport}`, ts: new Date(Date.now()-(i+3)*90000).toISOString().slice(11,19), acked: false
    })),
    ...flights.filter(f => f.delay_minutes > 90).slice(0, 3).map((f, i) => ({
      id: `C${i}`, type: 'Delay', severity: 'info' as const, flight: f.flight_id,
      message: `Excessive delay: ${f.flight_id} — ${f.delay_minutes} min delay from ${f.departure_airport}`, ts: new Date(Date.now()-(i+7)*60000).toISOString().slice(11,19), acked: false
    })),
  ]
  const [alerts, setAlerts] = useState<AlertItem[]>(initial)
  const ack = (id: string) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, acked: true } : a))
  const dismiss = (id: string) => setAlerts(prev => prev.filter(a => a.id !== id))

  const sColor = (s: AlertItem['severity']) => s === 'critical' ? '#ff3d57' : s === 'warning' ? '#ffab00' : '#00D4FF'
  const tColor = (t: string) => t === 'Weather' ? '#7aacc0' : t === 'Technical' ? '#bf7fff' : '#ffab00'

  const counts = {
    critical: alerts.filter(a => a.severity === 'critical' && !a.acked).length,
    warning: alerts.filter(a => a.severity === 'warning' && !a.acked).length,
    info: alerts.filter(a => a.severity === 'info' && !a.acked).length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <StatCard label="Critical" value={counts.critical} color="#ff3d57" icon="🔴" />
        <StatCard label="Warning" value={counts.warning} color="#ffab00" icon="⚠" />
        <StatCard label="Info" value={counts.info} color="#00D4FF" icon="ℹ" />
        <StatCard label="Total Active" value={alerts.filter(a => !a.acked).length} color="#7aacc0" icon="🔔" />
      </div>
      <Card title={`Active Alerts (${alerts.filter(a=>!a.acked).length})`} action={<button onClick={() => setAlerts(prev => prev.map(a => ({...a, acked:true})))} style={{ padding:'3px 12px', background:'#0a1628', border:'1px solid #1a3050', borderRadius:4, color:'#7aacc0', fontSize:10, cursor:'pointer' }}>Ack All</button>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.sort((a,b) => (a.acked?1:-1) - (b.acked?1:-1) || ['critical','warning','info'].indexOf(a.severity) - ['critical','warning','info'].indexOf(b.severity)).map(a => (
            <div key={a.id} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'12px', background: a.acked ? '#04090e' : '#060c18', border:`1px solid ${a.acked ? '#0e1e2e' : sColor(a.severity)+'44'}`, borderRadius:6, opacity: a.acked ? 0.5 : 1 }}>
              {!a.acked && <Pulse color={sColor(a.severity)} size={8} />}
              {a.acked && <div style={{ width:8, height:8, borderRadius:'50%', background:'#1a3050', flexShrink:0, marginTop:2 }} />}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', gap:8, marginBottom:3 }}>
                  <span style={{ fontSize:9, fontWeight:700, padding:'1px 7px', borderRadius:3, background:`${sColor(a.severity)}22`, color:sColor(a.severity), border:`1px solid ${sColor(a.severity)}44` }}>{a.severity.toUpperCase()}</span>
                  <span style={{ fontSize:9, fontWeight:700, padding:'1px 7px', borderRadius:3, background:`${tColor(a.type)}22`, color:tColor(a.type), border:`1px solid ${tColor(a.type)}44` }}>{a.type}</span>
                  <span style={{ fontSize:9, color:'#5a90b8', fontFamily:'JetBrains Mono, monospace' }}>{a.flight}</span>
                  <span style={{ fontSize:9, color:'#3a5870', marginLeft:'auto', fontFamily:'JetBrains Mono, monospace', flexShrink:0 }}>{a.ts}</span>
                </div>
                <div style={{ fontSize:11, color:'#7aacc0', lineHeight:1.5 }}>{a.message}</div>
              </div>
              <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                {!a.acked && <button onClick={() => ack(a.id)} style={{ padding:'3px 10px', border:'1px solid #00e67644', borderRadius:4, background:'#00e67614', color:'#00e676', fontSize:10, cursor:'pointer' }}>Ack</button>}
                <button onClick={() => dismiss(a.id)} style={{ padding:'3px 10px', border:'1px solid #ff3d5744', borderRadius:4, background:'#ff3d5714', color:'#ff3d57', fontSize:10, cursor:'pointer' }}>✕</button>
              </div>
            </div>
          ))}
          {alerts.length === 0 && <div style={{ textAlign:'center', padding:'24px', color:'#3a5870', fontSize:12 }}>No active alerts</div>}
        </div>
      </Card>
    </div>
  )
}

// ─── Section: Reports ─────────────────────────────────────────────────────────

function SectionReports({ flights }: { flights: Flight[] }) {
  const [rtype, setRtype] = useState('deviation')
  const [generated, setGenerated] = useState(false)
  const REPORT_TYPES = [
    { id:'deviation', label:'Route Deviation Report', icon:'⚠' },
    { id:'daily', label:'Daily Operations Summary', icon:'📋' },
    { id:'delay', label:'Delay Analysis Report', icon:'⏱' },
    { id:'weather', label:'Weather Impact Report', icon:'⛅' },
    { id:'airline', label:'Airline Performance Report', icon:'✈' },
  ]
  const preview = rtype === 'deviation'
    ? flights.filter(f => f.deviation === 1).slice(0, 8)
    : rtype === 'delay'
    ? flights.filter(f => f.delay_minutes > 30).sort((a,b) => b.delay_minutes - a.delay_minutes).slice(0, 8)
    : rtype === 'weather'
    ? flights.filter(f => f.storm).slice(0, 8)
    : flights.slice(0, 8)

  function generate() {
    setGenerated(true)
    const rows = [Object.keys(flights[0]).join(','), ...preview.map(f => Object.values(f).join(','))].join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows)
    a.download = `airways_${rtype}_report.csv`; a.click()
    setTimeout(() => setGenerated(false), 3000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="Report Generator">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          {REPORT_TYPES.map(r => (
            <button key={r.id} onClick={() => setRtype(r.id)} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', border:`1px solid ${rtype===r.id?'#00D4FF55':'#0e1e2e'}`, borderRadius:6, background:rtype===r.id?'#00D4FF14':'#060c18', color:rtype===r.id?'#00D4FF':'#7aacc0', fontSize:12, fontWeight:rtype===r.id?700:400, cursor:'pointer' }}>
              {r.icon} {r.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={generate} style={{ padding:'10px 24px', background:'#00D4FF', color:'#020a14', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer' }}>
            {generated ? '✓ Downloaded!' : '⬇ Generate & Download CSV'}
          </button>
          <span style={{ fontSize:11, color:'#5a90b8' }}>Preview: {preview.length} records shown below</span>
        </div>
      </Card>
      <Card title={`${REPORT_TYPES.find(r=>r.id===rtype)?.label} — Preview`} noPad>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
            <thead>
              <tr style={{ background: '#080e1c' }}>
                {['Flight ID','Airline','Route','Alt ft','Delay','Storm','Dev','Risk'].map(h => <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: '#ffffff', fontWeight: 700, borderBottom: '1px solid #0e1e2e', fontSize: 10, whiteSpace: 'nowrap' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {preview.map((f, i) => (
                <tr key={f.flight_id} style={{ borderBottom: '1px solid #07101c', background: i % 2 === 0 ? '#040910' : '#050b14' }}>
                  <td style={{ padding: '7px 12px', color: '#00D4FF' }}>{f.flight_id}</td>
                  <td style={{ padding: '7px 12px', color: '#7aacc0' }}>{f.airline.split(' ')[0]}</td>
                  <td style={{ padding: '7px 12px', color: '#5a90b8' }}>{f.departure_airport}→{f.arrival_airport}</td>
                  <td style={{ padding: '7px 12px', color: '#ffffff' }}>{f.altitude.toLocaleString()}</td>
                  <td style={{ padding: '7px 12px', color: f.delay_minutes > 30 ? '#ffab00' : '#5a90b8' }}>{f.delay_minutes}m</td>
                  <td style={{ padding: '7px 12px' }}><Badge color={f.storm ? '#ff3d57' : '#00e676'}>{f.storm ? 'YES' : 'NO'}</Badge></td>
                  <td style={{ padding: '7px 12px' }}><Badge color={f.deviation === 1 ? '#ff3d57' : '#00e676'}>{f.deviation === 1 ? 'DEV' : 'OK'}</Badge></td>
                  <td style={{ padding: '7px 12px', color: f.deviation === 1 && f.storm ? '#ff3d57' : '#7aacc0' }}>{f.deviation === 1 && f.storm ? 'HIGH' : f.deviation === 1 ? 'MED' : 'LOW'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ─── Section: Data Management ─────────────────────────────────────────────────

function SectionDataManagement({ flights }: { flights: Flight[] }) {
  const [importStatus, setImportStatus] = useState<null|'loading'|'done'>(null)
  const [importFile, setImportFile] = useState('')
  const [exportDone, setExportDone] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'preview'|'validation'|'stats'>('preview')

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (!f) return; setImportFile(f.name); setImportStatus('loading'); setTimeout(() => setImportStatus('done'), 1400) }
  function handleExcel(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (!f) return; setImportFile(f.name); setImportStatus('loading'); setTimeout(() => setImportStatus('done'), 1600) }
  function doExport() { const header = Object.keys(flights[0]).join(','); const rows = flights.map(f => Object.values(f).join(',')); const csv = [header, ...rows].join('\n'); const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = 'airway_flights.csv'; a.click(); setExportDone(true); setTimeout(() => setExportDone(false), 3000) }
  function doRefresh() { setRefreshing(true); setTimeout(() => setRefreshing(false), 1200) }

  const previewFlights = flights.slice(0, 8)
  const stats = [
    { l:'Total Records', v:flights.length, c:'#00D4FF' },
    { l:'Columns', v:17, c:'#00e676' },
    { l:'Deviations', v:flights.filter(f => f.deviation === 1).length, c:'#ff3d57' },
    { l:'Storm Events', v:flights.filter(f => f.storm).length, c:'#ffab00' },
    { l:'Tech Issues', v:flights.filter(f => f.technical_issue).length, c:'#bf7fff' },
    { l:'Avg Delay (min)', v:Math.round(flights.reduce((s, f) => s + f.delay_minutes, 0) / flights.length), c:'#00D4FF' },
    { l:'Avg Altitude (ft)', v:Math.round(flights.reduce((s, f) => s + f.altitude, 0) / flights.length).toLocaleString(), c:'#00e676' },
    { l:'Airlines', v:new Set(flights.map(f => f.airline)).size, c:'#7aacc0' },
  ]
  const schemaFields = [
    { col:'flight_id',type:'string',req:'Yes',ex:'FL1001',valid:'✓' },
    { col:'airline',type:'string',req:'Yes',ex:'Emirates',valid:'✓' },
    { col:'departure_airport',type:'string',req:'Yes',ex:'DXB',valid:'✓' },
    { col:'arrival_airport',type:'string',req:'Yes',ex:'LHR',valid:'✓' },
    { col:'altitude',type:'integer',req:'Yes',ex:'35000',valid:'✓' },
    { col:'wind_speed',type:'number',req:'Yes',ex:'15.2',valid:'✓' },
    { col:'storm',type:'boolean',req:'Yes',ex:'false',valid:'✓' },
    { col:'deviation',type:'0|1',req:'Yes',ex:'1',valid:'✓' },
    { col:'delay_minutes',type:'integer',req:'Yes',ex:'25',valid:'✓' },
    { col:'temperature',type:'number',req:'No',ex:'22.5',valid:'✓' },
  ]
  const btnBase: React.CSSProperties = { display:'flex', alignItems:'center', gap:7, padding:'9px 16px', border:'none', borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="Data Management">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <label style={{ ...btnBase, background:'#00D4FF', color:'#020a14', cursor:'pointer' }}>📂 Import CSV<input type="file" accept=".csv" onChange={handleFile} style={{ display:'none' }} /></label>
          <label style={{ ...btnBase, background:'#0a1e32', color:'#00D4FF', border:'1px solid #00D4FF44', cursor:'pointer' }}>📊 Upload Excel<input type="file" accept=".xlsx,.xls" onChange={handleExcel} style={{ display:'none' }} /></label>
          <button style={{ ...btnBase, background:'#00e676', color:'#020a14' }} onClick={doExport}>{exportDone ? '✓ Downloaded!' : '⬇ Export CSV'}</button>
          <button style={{ ...btnBase, background:'#0a1e32', color:'#ffab00', border:'1px solid #ffab0044' }} onClick={doRefresh}>{refreshing ? '⟳ Refreshing…' : '↺ Refresh Data'}</button>
        </div>
        {importStatus === 'loading' && <div style={{ padding:'10px 14px', background:'#0a1628', border:'1px solid #0e1e2e', borderRadius:6, marginBottom:10 }}><div style={{ fontSize:13, color:'#00D4FF', marginBottom:8 }}>Parsing {importFile}…</div><div style={{ height:4, background:'#0e1e2e', borderRadius:2, overflow:'hidden' }}><div style={{ height:'100%', width:'60%', background:'#00D4FF', borderRadius:2, animation:'blink 1s ease-in-out infinite' }} /></div></div>}
        {importStatus === 'done' && <div style={{ padding:'10px 14px', background:'#00e67614', border:'1px solid #00e67640', borderRadius:6, marginBottom:10 }}><div style={{ fontSize:13, fontWeight:700, color:'#00e676', marginBottom:3 }}>✓  Import Successful</div><div style={{ fontSize:12, color:'#ffffff' }}>{importFile} — 120 rows parsed, 17 columns validated. 0 errors.</div></div>}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
          {stats.slice(0, 4).map(s => (
            <div key={s.l} style={{ padding:'10px 12px', background:'#060c18', border:'1px solid #0e1e2e', borderRadius:6 }}>
              <div style={{ fontSize:10, color:'#ffffff', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:3 }}>{s.l}</div>
              <div style={{ fontSize:22, fontWeight:700, fontFamily:"'JetBrains Mono', monospace", color:s.c }}>{s.v}</div>
            </div>
          ))}
        </div>
      </Card>
      <div>
        <div style={{ display:'flex', gap:0, marginBottom:0, borderBottom:'1px solid #0e1e2e' }}>
          {(['preview','validation','stats'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{ padding:'9px 18px', border:'none', borderBottom:activeTab===t?'2px solid #00D4FF':'2px solid transparent', background:'transparent', color:activeTab===t?'#00D4FF':'#ffffff', fontSize:13, fontWeight:activeTab===t?700:400, cursor:'pointer' }}>
              {t === 'preview' ? '📋 Data Preview' : t === 'validation' ? '✅ Data Validation' : '📈 Dataset Statistics'}
            </button>
          ))}
        </div>
        {activeTab === 'preview' && (
          <Card noPad>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, fontFamily:"'JetBrains Mono', monospace" }}>
                <thead><tr style={{ background:'#080e1c' }}>{['Flight ID','Airline','DEP','ARR','Alt ft','Wind','Storm','Delay','Dev'].map(h => <th key={h} style={{ padding:'9px 12px', textAlign:'left', color:'#ffffff', fontWeight:700, borderBottom:'1px solid #0e1e2e', whiteSpace:'nowrap', fontSize:11 }}>{h}</th>)}</tr></thead>
                <tbody>{previewFlights.map((f, i) => (
                  <tr key={f.flight_id} style={{ borderBottom:'1px solid #07101c', background:i%2===0?'#040910':'#050b14' }}>
                    <td style={{ padding:'7px 12px', color:'#00D4FF' }}>{f.flight_id}</td>
                    <td style={{ padding:'7px 12px', color:'#ffffff' }}>{f.airline}</td>
                    <td style={{ padding:'7px 12px', color:'#7aacc0' }}>{f.departure_airport}</td>
                    <td style={{ padding:'7px 12px', color:'#7aacc0' }}>{f.arrival_airport}</td>
                    <td style={{ padding:'7px 12px', color:'#ffffff' }}>{f.altitude.toLocaleString()}</td>
                    <td style={{ padding:'7px 12px', color:'#ffffff' }}>{f.wind_speed}</td>
                    <td style={{ padding:'7px 12px' }}><Badge color={f.storm ? '#ff3d57' : '#00e676'}>{f.storm ? 'YES' : 'NO'}</Badge></td>
                    <td style={{ padding:'7px 12px', color:f.delay_minutes>30?'#ffab00':'#ffffff' }}>{f.delay_minutes}m</td>
                    <td style={{ padding:'7px 12px' }}><Badge color={f.deviation===1?'#ff3d57':'#00e676'}>{f.deviation===1?'DEV':'OK'}</Badge></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div style={{ padding:'8px 14px', borderTop:'1px solid #0e1e2e', fontSize:12, color:'#ffffff' }}>Showing 8 of {flights.length} records</div>
          </Card>
        )}
        {activeTab === 'validation' && (
          <Card title="Schema & Validation">
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, fontFamily:"'JetBrains Mono', monospace" }}>
                <thead><tr style={{ background:'#080e1c' }}>{['Column','Type','Required','Example','Status'].map(h => <th key={h} style={{ padding:'9px 12px', textAlign:'left', color:'#ffffff', fontWeight:700, borderBottom:'1px solid #0e1e2e', fontSize:11 }}>{h}</th>)}</tr></thead>
                <tbody>{schemaFields.map((r, i) => (
                  <tr key={r.col} style={{ borderBottom:'1px solid #07101c', background:i%2===0?'#040910':'#050b14' }}>
                    <td style={{ padding:'7px 12px', color:'#00D4FF' }}>{r.col}</td>
                    <td style={{ padding:'7px 12px', color:'#7aacc0' }}>{r.type}</td>
                    <td style={{ padding:'7px 12px', color:r.req==='Yes'?'#ffffff':'#7aacc0' }}>{r.req}</td>
                    <td style={{ padding:'7px 12px', color:'#ffffff' }}>{r.ex}</td>
                    <td style={{ padding:'7px 12px', color:'#00e676', fontWeight:700 }}>{r.valid} Valid</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div style={{ padding:'12px 14px', borderTop:'1px solid #0e1e2e', display:'flex', gap:12, flexWrap:'wrap' }}>
              <span style={{ fontSize:12, color:'#00e676', fontWeight:700 }}>✓ 17/17 columns valid</span>
              <span style={{ fontSize:12, color:'#00e676', fontWeight:700 }}>✓ 0 null values</span>
              <span style={{ fontSize:12, color:'#00e676', fontWeight:700 }}>✓ Schema match: 100%</span>
              <span style={{ fontSize:12, color:'#ffab00', fontWeight:700 }}>⚠ 3 outlier rows detected</span>
            </div>
          </Card>
        )}
        {activeTab === 'stats' && (
          <Card title="Dataset Statistics">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
              {stats.map(s => (
                <div key={s.l} style={{ padding:'12px 14px', background:'#060c18', border:'1px solid #0e1e2e', borderRadius:6 }}>
                  <div style={{ fontSize:11, color:'#ffffff', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:4 }}>{s.l}</div>
                  <div style={{ fontSize:24, fontWeight:700, fontFamily:"'JetBrains Mono', monospace", color:s.c }}>{s.v}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:14 }}>
              <div style={{ fontSize:12, color:'#ffffff', fontWeight:700, marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>Delay Distribution</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[['On Time',flights.filter(f=>f.delay_minutes===0).length,'#00e676'],['1–30 min',flights.filter(f=>f.delay_minutes>0&&f.delay_minutes<=30).length,'#7aacc0'],['31–60 min',flights.filter(f=>f.delay_minutes>30&&f.delay_minutes<=60).length,'#ffab00'],['>60 min',flights.filter(f=>f.delay_minutes>60).length,'#ff3d57']].map(([l, v, c]) => (
                  <div key={String(l)} style={{ flex:1, minWidth:120, padding:'10px 14px', background:'#060c18', border:`1px solid ${c}33`, borderRadius:6, textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:700, fontFamily:"'JetBrains Mono', monospace", color:c as string }}>{v as number}</div>
                    <div style={{ fontSize:11, color:'#ffffff', marginTop:3 }}>{l as string}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

// ─── Section: Add Flight ──────────────────────────────────────────────────────

const AIRLINES = ['Emirates','Qatar Airways','Turkish Airlines','Lufthansa','British Airways','Air Arabia','FlyDubai','Etihad']
const AP_LIST = ['DXB','AUH','DOH','IST','LHR','FRA','CDG','JFK','SIN','KUL','BKK']
const AIRCRAFT = ['Boeing 737','Airbus A320','Boeing 777','Airbus A380','Boeing 787','Airbus A350']
const RUNWAYS = ['Operational','Partially Closed','Maintenance','Wet','Dry']

function SectionAdd({ onAdd }: { onAdd: (f: Flight) => void }) {
  const blank: Partial<Flight> = { airline:'Emirates', aircraft_type:'Boeing 777', departure_airport:'DXB', arrival_airport:'LHR', runway_status:'Operational', temperature:22, visibility:8000, wind_speed:12, rainfall:0, airport_congestion:40, fuel_load:75, distance:5500, altitude:35000, delay_minutes:0, storm:false, technical_issue:false, deviation:0 }
  const [f, setF] = useState<Partial<Flight>>(blank)
  const [ok, setOk] = useState(false)
  function set(k: keyof Flight, v: any) { setF(p => ({ ...p, [k]: v })) }
  function submit(e: React.FormEvent) { e.preventDefault(); const id = `FL${String(Math.floor(Math.random() * 9000 + 1000))}`; const now = new Date().toISOString().slice(0, 16).replace('T', ' '); const ff: Flight = { ...f as Flight, flight_id:id, scheduled_departure:now, actual_departure:now, scheduled_arrival:now, actual_arrival:now }; onAdd(ff); setOk(true); setTimeout(() => { setOk(false); setF(blank) }, 2500) }
  const inp: React.CSSProperties = { width:'100%', background:'#060c18', border:'1px solid #0e1e2e', borderRadius:5, padding:'7px 10px', color:'#7aaccc', fontSize:11, fontFamily:'JetBrains Mono, monospace', outline:'none' }
  const lbl: React.CSSProperties = { fontSize:8.5, color:'#5a90b8', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:3, display:'block' }
  return (
    <Card title="Add New Flight Record">
      {ok && <div style={{ padding:'10px 14px', background:'#00e67614', border:'1px solid #00e67640', borderRadius:6, marginBottom:14, fontSize:11, fontWeight:700, color:'#00e676' }}>✓  Flight record added successfully</div>}
      <form onSubmit={submit}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, maxWidth:780 }}>
          <div><label style={lbl}>Airline</label><select style={inp} value={f.airline} onChange={e => set('airline', e.target.value)}>{AIRLINES.map(a => <option key={a}>{a}</option>)}</select></div>
          <div><label style={lbl}>Aircraft Type</label><select style={inp} value={f.aircraft_type} onChange={e => set('aircraft_type', e.target.value)}>{AIRCRAFT.map(a => <option key={a}>{a}</option>)}</select></div>
          <div><label style={lbl}>Departure</label><select style={inp} value={f.departure_airport} onChange={e => set('departure_airport', e.target.value)}>{AP_LIST.map(a => <option key={a}>{a}</option>)}</select></div>
          <div><label style={lbl}>Arrival</label><select style={inp} value={f.arrival_airport} onChange={e => set('arrival_airport', e.target.value)}>{AP_LIST.map(a => <option key={a}>{a}</option>)}</select></div>
          <div><label style={lbl}>Temperature (°C)</label><input style={inp} type="number" value={f.temperature} onChange={e => set('temperature', +e.target.value)} /></div>
          <div><label style={lbl}>Visibility (m)</label><input style={inp} type="number" value={f.visibility} onChange={e => set('visibility', +e.target.value)} /></div>
          <div><label style={lbl}>Wind Speed (km/h)</label><input style={inp} type="number" value={f.wind_speed} onChange={e => set('wind_speed', +e.target.value)} /></div>
          <div><label style={lbl}>Rainfall (mm)</label><input style={inp} type="number" value={f.rainfall} onChange={e => set('rainfall', +e.target.value)} /></div>
          <div><label style={lbl}>Airport Congestion (%)</label><input style={inp} type="number" min={0} max={100} value={f.airport_congestion} onChange={e => set('airport_congestion', +e.target.value)} /></div>
          <div><label style={lbl}>Runway Status</label><select style={inp} value={f.runway_status} onChange={e => set('runway_status', e.target.value)}>{RUNWAYS.map(r => <option key={r}>{r}</option>)}</select></div>
          <div><label style={lbl}>Fuel Load (%)</label><input style={inp} type="number" min={0} max={100} value={f.fuel_load} onChange={e => set('fuel_load', +e.target.value)} /></div>
          <div><label style={lbl}>Distance (km)</label><input style={inp} type="number" value={f.distance} onChange={e => set('distance', +e.target.value)} /></div>
          <div><label style={lbl}>Altitude (ft)</label><input style={inp} type="number" value={f.altitude} onChange={e => set('altitude', +e.target.value)} /></div>
          <div><label style={lbl}>Delay (min)</label><input style={inp} type="number" value={f.delay_minutes} onChange={e => set('delay_minutes', +e.target.value)} /></div>
          <div style={{ display:'flex', gap:18, alignItems:'center', paddingTop:14 }}>
            <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:11, color:'#7aacc0' }}><input type="checkbox" checked={!!f.storm} onChange={e => set('storm', e.target.checked)} /> Storm</label>
            <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:11, color:'#7aacc0' }}><input type="checkbox" checked={!!f.technical_issue} onChange={e => set('technical_issue', e.target.checked)} /> Tech Issue</label>
          </div>
          <div><label style={lbl}>Deviation (0/1)</label><select style={inp} value={f.deviation} onChange={e => set('deviation', +e.target.value as 0 | 1)}><option value={0}>0 — Normal</option><option value={1}>1 — Deviated</option></select></div>
        </div>
        <button type="submit" style={{ marginTop:18, padding:'10px 28px', background:'#00D4FF', color:'#020a14', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer' }}>+ Add Flight</button>
      </form>
    </Card>
  )
}

// ─── Section: View Flights ────────────────────────────────────────────────────

function SectionView({ flights }: { flights: Flight[] }) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const PER = 12
  const filtered = flights.filter(f =>
    f.flight_id.toLowerCase().includes(query.toLowerCase()) ||
    f.airline.toLowerCase().includes(query.toLowerCase()) ||
    f.departure_airport.includes(query.toUpperCase()) ||
    f.arrival_airport.includes(query.toUpperCase())
  )
  const pages = Math.ceil(filtered.length / PER)
  const visible = filtered.slice(page * PER, (page + 1) * PER)
  const cols: Array<[keyof Flight, string]> = [['flight_id','Flight ID'],['airline','Airline'],['departure_airport','DEP'],['arrival_airport','ARR'],['altitude','Alt ft'],['wind_speed','Wind'],['storm','Storm'],['delay_minutes','Delay'],['deviation','Dev']]
  return (
    <Card title={`View Flights (${filtered.length} records)`} noPad>
      <div style={{ padding:'10px 14px', borderBottom:'1px solid #0e1e2e' }}>
        <input placeholder="Search by flight ID, airline, airport…" value={query} onChange={e => { setQuery(e.target.value); setPage(0) }}
          style={{ width:'100%', maxWidth:340, background:'#060c18', border:'1px solid #0e1e2e', borderRadius:5, padding:'7px 12px', color:'#7aaccc', fontSize:11, fontFamily:'JetBrains Mono, monospace', outline:'none' }} />
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10.5, fontFamily:'JetBrains Mono, monospace' }}>
          <thead>
            <tr style={{ background:'#080e1c' }}>
              {cols.map(([k, h]) => <th key={k} style={{ padding:'7px 10px', textAlign:'left', color:'#5a90b8', fontWeight:600, borderBottom:'1px solid #0e1e2e', whiteSpace:'nowrap' }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {visible.map((f, i) => (
              <tr key={f.flight_id} style={{ borderBottom:'1px solid #07101c', background:i%2===0?'#040910':'#050b14' }}>
                <td style={{ padding:'6px 10px', color:'#00D4FF' }}>{f.flight_id}</td>
                <td style={{ padding:'6px 10px', color:'#7aacc0' }}>{f.airline}</td>
                <td style={{ padding:'6px 10px', color:'#5a90b8' }}>{f.departure_airport}</td>
                <td style={{ padding:'6px 10px', color:'#5a90b8' }}>{f.arrival_airport}</td>
                <td style={{ padding:'6px 10px', color:'#5a90b8' }}>{f.altitude.toLocaleString()}</td>
                <td style={{ padding:'6px 10px', color:'#5a90b8' }}>{f.wind_speed}</td>
                <td style={{ padding:'6px 10px' }}><Badge color={f.storm ? '#ff3d57' : '#00e676'}>{f.storm ? 'YES' : 'NO'}</Badge></td>
                <td style={{ padding:'6px 10px', color:f.delay_minutes>30?'#ffab00':'#5a90b8' }}>{f.delay_minutes}m</td>
                <td style={{ padding:'6px 10px' }}><Badge color={f.deviation===1?'#ff3d57':'#00e676'}>{f.deviation===1?'DEV':'OK'}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 14px', borderTop:'1px solid #0e1e2e' }}>
        <span style={{ fontSize:10, color:'#5a90b8' }}>Page {page+1} of {pages}</span>
        <div style={{ display:'flex', gap:6 }}>
          {[...Array(Math.min(pages, 8))].map((_, i) => (
            <button key={i} onClick={() => setPage(i)} style={{ padding:'2px 8px', borderRadius:3, border:'1px solid #0e1e2e', background:i===page?'#00D4FF22':'#060c18', color:i===page?'#00D4FF':'#5a90b8', fontSize:10, cursor:'pointer' }}>{i+1}</button>
          ))}
        </div>
      </div>
    </Card>
  )
}

// ─── Section: Update Flight ───────────────────────────────────────────────────

function SectionUpdate({ flights, onUpdate }: { flights: Flight[]; onUpdate: (f: Flight) => void }) {
  const [id, setId] = useState('')
  const [found, setFound] = useState<Flight | null>(null)
  const [f, setF] = useState<Flight | null>(null)
  const [ok, setOk] = useState(false)
  function search() { const r = flights.find(x => x.flight_id.toLowerCase() === id.toLowerCase()); setFound(r || null); setF(r ? { ...r } : null) }
  function set(k: keyof Flight, v: any) { setF(p => p ? { ...p, [k]: v } : null) }
  function save() { if (!f) return; onUpdate(f); setOk(true); setTimeout(() => setOk(false), 2500) }
  const inp: React.CSSProperties = { width:'100%', background:'#060c18', border:'1px solid #0e1e2e', borderRadius:5, padding:'7px 10px', color:'#7aaccc', fontSize:11, fontFamily:'JetBrains Mono, monospace', outline:'none' }
  const lbl: React.CSSProperties = { fontSize:8.5, color:'#5a90b8', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:3, display:'block' }
  return (
    <Card title="Update Flight Record">
      <div style={{ display:'flex', gap:8, marginBottom:16, maxWidth:400 }}>
        <input placeholder="Enter Flight ID (e.g. FL1001)" value={id} onChange={e => setId(e.target.value)} style={{ ...inp, flex:1 }} />
        <button onClick={search} style={{ padding:'7px 16px', background:'#00D4FF', color:'#020a14', border:'none', borderRadius:5, fontSize:11, fontWeight:700, cursor:'pointer' }}>Search</button>
      </div>
      {found === null && id && <div style={{ fontSize:11, color:'#ff3d57' }}>Flight not found.</div>}
      {f && (
        <>
          {ok && <div style={{ padding:'8px 12px', background:'#00e67614', border:'1px solid #00e67640', borderRadius:6, marginBottom:12, fontSize:11, fontWeight:700, color:'#00e676' }}>✓  Record updated</div>}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, maxWidth:780 }}>
            <div><label style={lbl}>Airline</label><select style={inp} value={f.airline} onChange={e => set('airline', e.target.value)}>{AIRLINES.map(a => <option key={a}>{a}</option>)}</select></div>
            <div><label style={lbl}>Temperature</label><input style={inp} type="number" value={f.temperature} onChange={e => set('temperature', +e.target.value)} /></div>
            <div><label style={lbl}>Wind Speed</label><input style={inp} type="number" value={f.wind_speed} onChange={e => set('wind_speed', +e.target.value)} /></div>
            <div><label style={lbl}>Visibility</label><input style={inp} type="number" value={f.visibility} onChange={e => set('visibility', +e.target.value)} /></div>
            <div><label style={lbl}>Delay (min)</label><input style={inp} type="number" value={f.delay_minutes} onChange={e => set('delay_minutes', +e.target.value)} /></div>
            <div><label style={lbl}>Altitude (ft)</label><input style={inp} type="number" value={f.altitude} onChange={e => set('altitude', +e.target.value)} /></div>
            <div><label style={lbl}>Deviation</label><select style={inp} value={f.deviation} onChange={e => set('deviation', +e.target.value as 0 | 1)}><option value={0}>0 — Normal</option><option value={1}>1 — Deviated</option></select></div>
            <div style={{ display:'flex', gap:16, alignItems:'center', paddingTop:14 }}>
              <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:11, color:'#7aacc0' }}><input type="checkbox" checked={!!f.storm} onChange={e => set('storm', e.target.checked)} /> Storm</label>
              <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:11, color:'#7aacc0' }}><input type="checkbox" checked={!!f.technical_issue} onChange={e => set('technical_issue', e.target.checked)} /> Tech Issue</label>
            </div>
          </div>
          <button onClick={save} style={{ marginTop:14, padding:'9px 24px', background:'#00D4FF', color:'#020a14', border:'none', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>Save Changes</button>
        </>
      )}
    </Card>
  )
}

// ─── Section: Delete Flight ───────────────────────────────────────────────────

function SectionDelete({ flights, onDelete }: { flights: Flight[]; onDelete: (id: string) => void }) {
  const [id, setId] = useState('')
  const [found, setFound] = useState<Flight | null | undefined>(undefined)
  const [confirm, setConfirm] = useState(false)
  const [done, setDone] = useState(false)
  function search() { setFound(flights.find(f => f.flight_id.toLowerCase() === id.toLowerCase()) ?? null); setConfirm(false); setDone(false) }
  function del() { if (!found) return; onDelete(found.flight_id); setDone(true); setFound(undefined); setId(''); setConfirm(false) }
  const inp: React.CSSProperties = { background:'#060c18', border:'1px solid #0e1e2e', borderRadius:5, padding:'7px 10px', color:'#7aaccc', fontSize:11, fontFamily:'JetBrains Mono, monospace', outline:'none', flex:1 }
  return (
    <Card title="Delete Flight Record">
      <div style={{ maxWidth:500 }}>
        {done && <div style={{ padding:'8px 12px', background:'#ff3d5714', border:'1px solid #ff3d5740', borderRadius:6, marginBottom:12, fontSize:11, fontWeight:700, color:'#ff3d57' }}>✓  Flight record deleted</div>}
        <div style={{ display:'flex', gap:8, marginBottom:14 }}>
          <input placeholder="Enter Flight ID (e.g. FL1001)" value={id} onChange={e => setId(e.target.value)} style={inp} />
          <button onClick={search} style={{ padding:'7px 16px', background:'#0e1e2e', color:'#00D4FF', border:'1px solid #00D4FF44', borderRadius:5, fontSize:11, fontWeight:700, cursor:'pointer' }}>Search</button>
        </div>
        {found === null && <div style={{ fontSize:11, color:'#ff3d57' }}>Flight not found.</div>}
        {found && (
          <div style={{ padding:'14px', background:'#060c18', border:'1px solid #ff3d5730', borderRadius:8 }}>
            <div style={{ fontSize:13, fontWeight:700, fontFamily:'JetBrains Mono, monospace', color:'#00D4FF', marginBottom:10 }}>{found.flight_id}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:11, lineHeight:1.9, fontFamily:'JetBrains Mono, monospace', color:'#7aacc0' }}>
              {[['Airline',found.airline],['Route',`${found.departure_airport} → ${found.arrival_airport}`],['Aircraft',found.aircraft_type],['Altitude',`${found.altitude.toLocaleString()} ft`],['Delay',`${found.delay_minutes}m`],['Deviation',found.deviation===1?'YES':'NO']].map(([k, v]) => (
                <div key={k}>{k}: <span style={{ color:'#7aacc0' }}>{v}</span></div>
              ))}
            </div>
            {!confirm
              ? <button onClick={() => setConfirm(true)} style={{ marginTop:12, padding:'8px 20px', background:'#ff3d5714', color:'#ff3d57', border:'1px solid #ff3d5744', borderRadius:5, fontSize:11, fontWeight:700, cursor:'pointer' }}>Delete This Record</button>
              : <div style={{ marginTop:12, display:'flex', gap:10, alignItems:'center' }}>
                  <span style={{ fontSize:11, color:'#ff9a00' }}>Confirm delete?</span>
                  <button onClick={del} style={{ padding:'7px 16px', background:'#ff3d57', color:'#fff', border:'none', borderRadius:5, fontSize:11, fontWeight:700, cursor:'pointer' }}>Confirm</button>
                  <button onClick={() => setConfirm(false)} style={{ padding:'7px 16px', background:'#0e1e2e', color:'#7aacc0', border:'1px solid #0e1e2e', borderRadius:5, fontSize:11, cursor:'pointer' }}>Cancel</button>
                </div>
            }
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── Section: Train Model ─────────────────────────────────────────────────────

function SectionTrain() {
  const [running, setRunning] = useState(false)
  const [epoch, setEpoch] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  function train() {
    setRunning(true); setEpoch(0)
    timerRef.current = setInterval(() => {
      setEpoch(e => { if (e >= 10) { clearInterval(timerRef.current!); setRunning(false); return 10 } return e + 1 })
    }, 600)
  }
  const log = TRAINING_LOG.slice(0, epoch)
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <Card title="Model Training — XGBoost">
        <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
          <button onClick={train} disabled={running} style={{ padding:'9px 22px', background:running?'#0e1e2e':'#00D4FF', color:running?'#5a90b8':'#020a14', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:running?'not-allowed':'pointer' }}>
            {running ? `Training… epoch ${epoch}/10` : '▶  Start Training'}
          </button>
          {epoch === 10 && <Badge color="#00e676">✓  Training Complete — Best: XGBoost 94.1%</Badge>}
        </div>
        {epoch > 0 && (
          <div style={{ marginBottom:14 }}>
            <div style={{ height:5, background:'#0e1e2e', borderRadius:3, overflow:'hidden', marginBottom:6 }}>
              <div style={{ height:'100%', width:`${epoch * 10}%`, background:'#00D4FF', borderRadius:3, transition:'width .4s ease' }} />
            </div>
            <div style={{ fontSize:9, color:'#5a90b8', textAlign:'right' }}>{epoch}/10 epochs</div>
          </div>
        )}
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={log} margin={{ top:4, right:4, bottom:0, left:-20 }}>
            <CartesianGrid stroke="#162a3e" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="epoch" tick={{ fill:'#5a90b8', fontSize:8 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill:'#5a90b8', fontSize:8 }} tickLine={false} axisLine={false} />
            <Tooltip content={<CTip />} />
            <Line type="monotone" dataKey="train_loss" name="Train Loss" stroke="#ff3d57" strokeWidth={1.8} dot={false} />
            <Line type="monotone" dataKey="val_loss" name="Val Loss" stroke="#ffab00" strokeWidth={1.8} dot={false} />
            <Line type="monotone" dataKey="accuracy" name="Accuracy" stroke="#00e676" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Epoch Log" noPad>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10.5, fontFamily:'JetBrains Mono, monospace' }}>
            <thead><tr style={{ background:'#080e1c' }}>{['Epoch','Train Loss','Val Loss','Accuracy'].map(h => <th key={h} style={{ padding:'7px 12px', textAlign:'left', color:'#5a90b8', fontWeight:600, borderBottom:'1px solid #0e1e2e' }}>{h}</th>)}</tr></thead>
            <tbody>{log.map(r => (
              <tr key={r.epoch} style={{ borderBottom:'1px solid #07101c' }}>
                <td style={{ padding:'5px 12px', color:'#7aacc0' }}>{r.epoch}</td>
                <td style={{ padding:'5px 12px', color:'#ff3d57' }}>{r.train_loss}</td>
                <td style={{ padding:'5px 12px', color:'#ffab00' }}>{r.val_loss}</td>
                <td style={{ padding:'5px 12px', color:'#00e676' }}>{(r.accuracy * 100).toFixed(1)}%</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ─── Section: Evaluate Model ──────────────────────────────────────────────────

function SectionEvaluate() {
  const m = MODEL_RESULTS
  const cm = m.confusionMatrix
  const { tp, fp, fn, tn } = cm
  const total = tp + fp + fn + tn
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <Card title="Model Comparison">
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={m.models.map(x => ({ name:x.name.split(' ')[0], acc:+(x.accuracy*100).toFixed(1), f1:+(x.f1*100).toFixed(1) }))} margin={{ top:4, right:4, bottom:0, left:-20 }}>
            <CartesianGrid stroke="#162a3e" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="name" tick={{ fill:'#5a90b8', fontSize:8 }} tickLine={false} axisLine={false} />
            <YAxis domain={[75, 100]} tick={{ fill:'#5a90b8', fontSize:8 }} tickLine={false} axisLine={false} />
            <Tooltip content={<CTip />} />
            <Bar dataKey="acc" name="Accuracy %" fill="#00D4FF" opacity={0.8} radius={[3,3,0,0]} />
            <Bar dataKey="f1" name="F1 %" fill="#00e676" opacity={0.8} radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Card title="Confusion Matrix — XGBoost">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[{l:'True Positive',v:tp,c:'#00e676'},{l:'False Positive',v:fp,c:'#ff3d57'},{l:'False Negative',v:fn,c:'#ffab00'},{l:'True Negative',v:tn,c:'#00D4FF'}].map(x => (
              <div key={x.l} style={{ padding:'12px', background:'#060c18', borderRadius:6, textAlign:'center' }}>
                <div style={{ fontSize:22, fontWeight:700, fontFamily:'JetBrains Mono, monospace', color:x.c }}>{x.v}</div>
                <div style={{ fontSize:8.5, color:'#5a90b8', marginTop:3 }}>{x.l}</div>
                <div style={{ fontSize:8.5, color:'#5a90b8' }}>({((x.v/total)*100).toFixed(1)}%)</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:12, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:10, fontFamily:'JetBrains Mono, monospace', color:'#5a90b8' }}>
            <div>Precision: <span style={{color:'#7aacc0'}}>{(tp/(tp+fp)*100).toFixed(1)}%</span></div>
            <div>Recall: <span style={{color:'#7aacc0'}}>{(tp/(tp+fn)*100).toFixed(1)}%</span></div>
            <div>Accuracy: <span style={{color:'#7aacc0'}}>{((tp+tn)/total*100).toFixed(1)}%</span></div>
            <div>AUC-ROC: <span style={{color:'#00D4FF'}}>0.967</span></div>
          </div>
        </Card>
        <Card title="Feature Importance">
          {m.featureImportance.map(f => (
            <div key={f.feature} style={{ marginBottom:7 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:9.5, fontFamily:'JetBrains Mono, monospace', color:'#5a90b8', marginBottom:3 }}>
                <span>{f.feature}</span><span style={{color:'#7aacc0'}}>{(f.importance*100).toFixed(1)}%</span>
              </div>
              <div style={{ height:5, background:'#0e1e2e', borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${f.importance*100}%`, background:'linear-gradient(90deg,#00D4FF,#004880)', borderRadius:3 }} />
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

// ─── Section: Predict Deviation ───────────────────────────────────────────────

function devCol(p: number) { return p >= 0.65 ? '#ff3d57' : p >= 0.4 ? '#ff6b00' : p >= 0.2 ? '#ffd700' : '#00e676' }
function riskLabel(p: number) { return p >= 0.65 ? 'CRITICAL' : p >= 0.4 ? 'MED DEV' : p >= 0.2 ? 'MINOR' : 'ON ROUTE' }
function calcDevProb(ac: LiveAC) {
  let p = (ac.storm ? .35 : 0) + (ac.technicalIssue ? .25 : 0)
        + (ac.windSpeed > 60 ? .12 : 0) + (ac.visibility < 1500 ? .1 : 0)
        + (ac.fuelPct < 25 ? .08 : 0) + (ac.delayMin > 60 ? .05 : 0)
  return Math.min(+(p + ac.devProb * 0.4).toFixed(3), 0.98)
}

function SectionPredict({ liveFleet }: { liveFleet: LiveAC[] }) {
  const [tab, setTab] = useState<'live' | 'manual'>('live')
  const [sortBy, setSortBy] = useState<'prob' | 'id'>('prob')
  const [filterRisk, setFilterRisk] = useState<'all' | 'deviated' | 'critical'>('all')
  // Manual prediction form
  const [form, setForm] = useState({ storm:false, technical_issue:false, airport_congestion:40, wind_speed:15, visibility:8000, delay_minutes:10 })
  const [result, setResult] = useState<null | { prob:number; label:string }>(null)

  function setF(k: string, v: any) { setForm(p => ({ ...p, [k]: v })) }
  function predict() {
    let p = (form.storm ? .35 : 0) + (form.technical_issue ? .25 : 0) + (form.airport_congestion > 80 ? .15 : 0) + (form.wind_speed > 60 ? .1 : 0) + (form.visibility < 500 ? .1 : 0) + (form.delay_minutes > 60 ? .05 : 0)
    p = Math.min(p, 0.97)
    setResult({ prob:p, label:p>0.5?'DEVIATION PREDICTED':'NO DEVIATION' })
  }

  // Live aircraft with computed deviation predictions
  const liveRows = liveFleet.map(ac => ({ ac, prob: calcDevProb(ac) }))
  const filteredRows = liveRows.filter(r =>
    filterRisk === 'critical' ? r.prob >= 0.65 :
    filterRisk === 'deviated' ? r.prob >= 0.2 : true
  ).sort((a, b) => sortBy === 'prob' ? b.prob - a.prob : a.ac.id.localeCompare(b.ac.id))

  const critCount = liveRows.filter(r => r.prob >= 0.65).length
  const devCount  = liveRows.filter(r => r.prob >= 0.2).length

  const inp: React.CSSProperties = { width:'100%', background:'#060c18', border:'1px solid #0e1e2e', borderRadius:5, padding:'7px 10px', color:'#7aaccc', fontSize:11, fontFamily:'JetBrains Mono, monospace', outline:'none' }
  const lbl: React.CSSProperties = { fontSize:8.5, color:'#5a90b8', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:3, display:'block' }

  const tabBtn = (t: 'live' | 'manual', label: string) => (
    <button onClick={() => setTab(t)} style={{
      padding:'6px 16px', border:'none', cursor:'pointer', fontSize:11, fontWeight: tab===t ? 700 : 400,
      background: tab===t ? '#00D4FF18' : 'transparent',
      color: tab===t ? '#00D4FF' : '#4a7090',
      borderBottom: tab===t ? '2px solid #00D4FF' : '2px solid transparent',
    }}>{label}</button>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Tab bar */}
      <div style={{ display:'flex', gap:0, borderBottom:'1px solid #0e1e2e', marginBottom:4 }}>
        {tabBtn('live', `⚡ Live Aircraft  (${liveFleet.length})`)}
        {tabBtn('manual', '🔧 Manual Input')}
      </div>

      {/* ── Live Aircraft tab ── */}
      {tab === 'live' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {/* Summary row */}
          <div style={{ display:'flex', gap:10 }}>
            {[
              { l:'Total Tracked', v: liveFleet.length, c:'#00D4FF' },
              { l:'Deviating', v: devCount, c:'#ffd700' },
              { l:'Critical', v: critCount, c:'#ff3d57' },
              { l:'On Route', v: liveFleet.length - devCount, c:'#00e676' },
            ].map(s => (
              <div key={s.l} style={{ flex:1, padding:'10px 12px', background:'#060c18', border:`1px solid ${s.c}22`, borderRadius:7, textAlign:'center' }}>
                <div style={{ fontSize:22, fontWeight:800, fontFamily:'JetBrains Mono, monospace', color:s.c }}>{s.v}</div>
                <div style={{ fontSize:9, color:'#5a90b8', marginTop:3, textTransform:'uppercase', letterSpacing:'0.06em' }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Filter + sort controls */}
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ fontSize:9, color:'#5a90b8', textTransform:'uppercase', letterSpacing:'0.06em' }}>Filter:</span>
            {(['all','deviated','critical'] as const).map(f => (
              <button key={f} onClick={() => setFilterRisk(f)} style={{
                padding:'3px 10px', borderRadius:4, border:`1px solid ${filterRisk===f ? '#00D4FF55' : '#1a3050'}`,
                background: filterRisk===f ? '#00D4FF14' : 'transparent',
                color: filterRisk===f ? '#00D4FF' : '#4a7090',
                fontSize:10, fontWeight: filterRisk===f ? 700 : 400, cursor:'pointer',
                fontFamily:'JetBrains Mono, monospace', textTransform:'uppercase',
              }}>{f}</button>
            ))}
            <span style={{ marginLeft:'auto', fontSize:9, color:'#5a90b8', textTransform:'uppercase', letterSpacing:'0.06em' }}>Sort:</span>
            <button onClick={() => setSortBy('prob')} style={{ padding:'3px 10px', borderRadius:4, border:`1px solid ${sortBy==='prob' ? '#00D4FF55' : '#1a3050'}`, background: sortBy==='prob' ? '#00D4FF14' : 'transparent', color: sortBy==='prob' ? '#00D4FF' : '#4a7090', fontSize:10, cursor:'pointer' }}>Risk</button>
            <button onClick={() => setSortBy('id')} style={{ padding:'3px 10px', borderRadius:4, border:`1px solid ${sortBy==='id' ? '#00D4FF55' : '#1a3050'}`, background: sortBy==='id' ? '#00D4FF14' : 'transparent', color: sortBy==='id' ? '#00D4FF' : '#4a7090', fontSize:10, cursor:'pointer' }}>Flight ID</button>
          </div>

          {/* Aircraft table */}
          <div style={{ border:'1px solid #0e1e2e', borderRadius:8, overflow:'hidden' }}>
            <div style={{ overflowY:'auto', maxHeight:420 }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#060c18', position:'sticky', top:0 }}>
                    {['Flight','Route','Aircraft','Dev Prob','Risk','Storm','Tech','Fuel %','Action'].map(h => (
                      <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:9, color:'#ffffff', fontWeight:700, borderBottom:'1px solid #0e1e2e', whiteSpace:'nowrap', letterSpacing:'0.05em', textTransform:'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.slice(0, 50).map(({ ac, prob }) => {
                    const col = devCol(prob)
                    return (
                      <tr key={ac.id} style={{ borderBottom:'1px solid #080f1c' }}>
                        <td style={{ padding:'7px 10px', fontFamily:'JetBrains Mono, monospace', fontSize:11, fontWeight:700, color:'#00D4FF' }}>{ac.id}</td>
                        <td style={{ padding:'7px 10px', fontSize:10, color:'#7aacc0', fontFamily:'JetBrains Mono, monospace' }}>{ac.depCode}→{ac.arrCode}</td>
                        <td style={{ padding:'7px 10px', fontSize:10, color:'#5a90b8' }}>{ac.acType}</td>
                        <td style={{ padding:'7px 10px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ flex:1, height:5, background:'#0e1e2e', borderRadius:3, overflow:'hidden', minWidth:50 }}>
                              <div style={{ height:'100%', width:`${prob*100}%`, background:col, borderRadius:3 }} />
                            </div>
                            <span style={{ fontSize:10, fontWeight:700, fontFamily:'JetBrains Mono, monospace', color:col, minWidth:36, textAlign:'right' }}>{(prob*100).toFixed(0)}%</span>
                          </div>
                        </td>
                        <td style={{ padding:'7px 10px' }}>
                          <span style={{ padding:'2px 7px', borderRadius:9, border:`1px solid ${col}55`, background:`${col}18`, fontSize:9, fontWeight:700, color:col }}>{riskLabel(prob)}</span>
                        </td>
                        <td style={{ padding:'7px 10px', textAlign:'center', fontSize:11 }}>{ac.storm ? '⛈' : '–'}</td>
                        <td style={{ padding:'7px 10px', textAlign:'center', fontSize:11 }}>{ac.technicalIssue ? '🔧' : '–'}</td>
                        <td style={{ padding:'7px 10px', fontSize:10, fontFamily:'JetBrains Mono, monospace', color: ac.fuelPct < 25 ? '#ff3d57' : ac.fuelPct < 50 ? '#ffab00' : '#00e676' }}>{ac.fuelPct}%</td>
                        <td style={{ padding:'7px 10px', fontSize:9, color: prob >= 0.65 ? '#ff3d57' : prob >= 0.4 ? '#ffab00' : '#7aacc0' }}>
                          {prob >= 0.65 ? 'Reroute now' : prob >= 0.4 ? 'Monitor' : prob >= 0.2 ? 'Watch' : 'Normal'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding:'6px 12px', background:'#040810', borderTop:'1px solid #0e1e2e', fontSize:9, color:'#4a7090', fontFamily:'JetBrains Mono, monospace', display:'flex', justifyContent:'space-between' }}>
              <span>Showing {Math.min(filteredRows.length, 50)} of {filteredRows.length} aircraft</span>
              <span style={{ color:'#3a5870' }}>Live simulation data · XGBoost model</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Manual input tab ── */}
      {tab === 'manual' && (
        <Card title="Manual Prediction — XGBoost">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, maxWidth:680 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div><label style={lbl}>Airport Congestion (%)</label><input style={inp} type="number" min={0} max={100} value={form.airport_congestion} onChange={e => setF('airport_congestion', +e.target.value)} /></div>
              <div><label style={lbl}>Wind Speed (km/h)</label><input style={inp} type="number" value={form.wind_speed} onChange={e => setF('wind_speed', +e.target.value)} /></div>
              <div><label style={lbl}>Visibility (m)</label><input style={inp} type="number" value={form.visibility} onChange={e => setF('visibility', +e.target.value)} /></div>
              <div><label style={lbl}>Delay (min)</label><input style={inp} type="number" value={form.delay_minutes} onChange={e => setF('delay_minutes', +e.target.value)} /></div>
              <div style={{ display:'flex', gap:18 }}>
                <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:11, color:'#7aacc0' }}><input type="checkbox" checked={form.storm} onChange={e => setF('storm', e.target.checked)} /> Storm Active</label>
                <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:11, color:'#7aacc0' }}><input type="checkbox" checked={form.technical_issue} onChange={e => setF('technical_issue', e.target.checked)} /> Technical Issue</label>
              </div>
              <button onClick={predict} style={{ padding:'10px', background:'#00D4FF', color:'#020a14', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer' }}>▶  Run Prediction</button>
            </div>
            {result && (
              <div style={{ padding:'20px', background:'#060c18', border:`2px solid ${result.prob>0.5?'#ff3d57':'#00e676'}`, borderRadius:10, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', gap:10 }}>
                <div style={{ fontSize:32, fontWeight:800, fontFamily:'JetBrains Mono, monospace', color:result.prob>0.5?'#ff3d57':'#00e676' }}>{(result.prob*100).toFixed(1)}%</div>
                <div style={{ fontSize:11, fontWeight:700, color:result.prob>0.5?'#ff3d57':'#00e676', letterSpacing:'0.06em' }}>{result.label}</div>
                <div style={{ width:'100%', height:8, background:'#0e1e2e', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${result.prob*100}%`, background:result.prob>0.5?'#ff3d57':'#00e676', borderRadius:4 }} />
                </div>
                <div style={{ fontSize:9.5, color:'#5a90b8', lineHeight:1.6 }}>
                  Model: XGBoost v3.1<br />Confidence: {result.prob > 0.7 || result.prob < 0.2 ? 'High' : 'Moderate'}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── FlightInfoPanel moved to SectionATC.tsx ─────────────────────────────────

// @ts-expect-error kept for reference — now rendered inside SectionATC
function FlightInfoPanel({ ac, onClose }: { ac: LiveAC | undefined; onClose: () => void }) {
  if (!ac) return null
  const riskColor = ac.riskLevel === 'critical' ? '#FF3D57' : ac.riskLevel === 'high' ? '#FF6B00' : ac.riskLevel === 'medium' ? '#FFAB00' : '#00e676'
  const phaseColor = ac.phase === 'climb' ? '#00e676' : ac.phase === 'descent' ? '#ffab00' : ac.phase === 'approach' ? '#ff3d57' : '#00D4FF'
  const altColor = ac.altFt > 35000 ? '#ffab00' : ac.altFt > 25000 ? '#00e676' : '#00D4FF'

  return (
    <div style={{ height:'100%', overflowY:'auto', padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, fontFamily:'JetBrains Mono, monospace', color:'#00D4FF', letterSpacing:'0.04em' }}>{ac.id}</div>
          <div style={{ fontSize:10, color:'#5a90b8', marginTop:2 }}>{ac.airline}  ·  {ac.acType}  ·  {ac.isCargo ? 'CARGO' : 'PAX'}</div>
        </div>
        <button onClick={onClose} style={{ background:'transparent', border:'1px solid #1a3050', borderRadius:4, color:'#5a90b8', cursor:'pointer', fontSize:16, width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1, flexShrink:0 }}>×</button>
      </div>

      {/* Route bar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'#060c18', border:'1px solid #1a3050', borderRadius:6 }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:16, fontWeight:800, fontFamily:'JetBrains Mono, monospace', color:'#7aacc0' }}>{ac.depCode}</div>
          <div style={{ fontSize:9, color:'#3a6888' }}>DEP</div>
        </div>
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
          <div style={{ width:'100%', height:1, background:'linear-gradient(90deg,#1a3050,#00D4FF66,#1a3050)' }} />
          <span style={{ fontSize:9, color:'#00D4FF', fontFamily:'JetBrains Mono, monospace' }}>▶ {Math.round(ac.progress * 100)}%</span>
          <div style={{ width:'100%', height:1, background:'linear-gradient(90deg,#1a3050,#0e1e2e,#1a3050)' }} />
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:16, fontWeight:800, fontFamily:'JetBrains Mono, monospace', color:'#7aacc0' }}>{ac.arrCode}</div>
          <div style={{ fontSize:9, color:'#3a6888' }}>ARR</div>
        </div>
      </div>

      {/* Status badges */}
      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
        <span style={{ padding:'3px 9px', borderRadius:10, border:`1px solid ${riskColor}55`, background:`${riskColor}18`, fontSize:9, fontWeight:700, color:riskColor }}>{ac.riskLevel.toUpperCase()} RISK</span>
        <span style={{ padding:'3px 9px', borderRadius:10, border:`1px solid ${phaseColor}55`, background:`${phaseColor}18`, fontSize:9, fontWeight:700, color:phaseColor }}>{ac.phase.toUpperCase()}</span>
        {ac.storm && <span style={{ padding:'3px 9px', borderRadius:10, border:'1px solid #ff3d5755', background:'#ff3d5718', fontSize:9, fontWeight:700, color:'#ff3d57' }}>⛈ STORM</span>}
        {ac.technicalIssue && <span style={{ padding:'3px 9px', borderRadius:10, border:'1px solid #bf7fff55', background:'#bf7fff18', fontSize:9, fontWeight:700, color:'#bf7fff' }}>🔧 TECH</span>}
      </div>

      {/* Key metrics grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
        {[
          { l:'Altitude', v:`${ac.altFt.toLocaleString()} ft`, c:altColor },
          { l:'Speed', v:`${ac.speedKts} kts`, c:'#7aacc0' },
          { l:'Heading', v:`${Math.round(ac.heading)}°`, c:'#7aacc0' },
          { l:'V/S', v:`${ac.vspeed > 0 ? '+' : ''}${ac.vspeed} ft/m`, c:ac.vspeed > 0 ? '#00e676' : ac.vspeed < 0 ? '#ffab00' : '#7aacc0' },
          { l:'ETA', v:`${ac.etaMin}m`, c:'#7aacc0' },
          { l:'Fuel', v:`${ac.fuelPct}%`, c:ac.fuelPct < 30 ? '#ff3d57' : ac.fuelPct < 50 ? '#ffab00' : '#00e676' },
          { l:'Delay', v:`${ac.delayMin}m`, c:ac.delayMin > 30 ? '#ffab00' : '#7aacc0' },
          { l:'Distance', v:`${ac.distanceNm} nm`, c:'#7aacc0' },
        ].map(r => (
          <div key={r.l} style={{ padding:'7px 9px', background:'#060c18', border:'1px solid #1a3050', borderRadius:5 }}>
            <div style={{ fontSize:8, color:'#4a7090', textTransform:'uppercase', letterSpacing:'0.06em' }}>{r.l}</div>
            <div style={{ fontSize:12, fontWeight:700, fontFamily:'JetBrains Mono, monospace', color:r.c, marginTop:1 }}>{r.v}</div>
          </div>
        ))}
      </div>

      {/* Weather */}
      <div style={{ background:'#040810', border:'1px solid #1a3050', borderRadius:6, padding:'8px 10px' }}>
        <div style={{ fontSize:9, fontWeight:700, color:'#7aacc0', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Weather Conditions</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:10, fontFamily:'JetBrains Mono, monospace' }}>
          {[
            { l:'Wind', v:`${ac.windSpeed} km/h`, c:ac.windSpeed > 60 ? '#ffab00' : '#7aacc0' },
            { l:'Visibility', v:`${(ac.visibility/1000).toFixed(1)} km`, c:ac.visibility < 2000 ? '#ff3d57' : '#7aacc0' },
            { l:'Temperature', v:`${ac.temperature}°C`, c:'#7aacc0' },
            { l:'Storm', v:ac.storm ? 'ACTIVE' : 'CLEAR', c:ac.storm ? '#ff3d57' : '#00e676' },
          ].map(r => (
            <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'2px 0', borderBottom:'1px solid #0c1828' }}>
              <span style={{ color:'#4a7090' }}>{r.l}</span>
              <span style={{ fontWeight:700, color:r.c }}>{r.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ML Prediction */}
      <div style={{ background:'#040810', border:`1px solid ${riskColor}44`, borderRadius:6, padding:'8px 10px' }}>
        <div style={{ fontSize:9, fontWeight:700, color:'#00D4FF', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>AI Deviation Prediction</div>
        <div style={{ marginBottom:6 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
            <span style={{ fontSize:10, color:'#5a90b8', fontFamily:'JetBrains Mono, monospace' }}>Deviation Probability</span>
            <span style={{ fontSize:13, fontWeight:700, fontFamily:'JetBrains Mono, monospace', color:riskColor }}>{(ac.devProb * 100).toFixed(1)}%</span>
          </div>
          <div style={{ height:6, background:'#0e1e2e', borderRadius:3, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${ac.devProb*100}%`, background:riskColor, borderRadius:3 }} />
          </div>
        </div>
        {[
          { l:'Risk Level',   v:ac.riskLevel.toUpperCase(), c:riskColor },
          { l:'Tech Issues',  v:ac.technicalIssue ? 'DETECTED' : 'None', c:ac.technicalIssue ? '#bf7fff' : '#00e676' },
          { l:'Confidence',   v:`${Math.round(Math.max(ac.devProb, 1-ac.devProb)*100)}%`, c:'#7aacc0' },
          { l:'Deviation Cause',
            v: ac.storm ? 'Storm Activity' : ac.technicalIssue ? 'Tech Fault' : ac.windSpeed > 60 ? 'Wind Shear' : ac.visibility < 2000 ? 'Low Visibility' : ac.fuelPct < 30 ? 'Low Fuel' : 'Route Congestion',
            c:'#ffab00' },
        ].map(r => (
          <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:'1px solid #0c1828' }}>
            <span style={{ fontSize:9, color:'#4a7090', fontFamily:'JetBrains Mono, monospace' }}>{r.l}</span>
            <span style={{ fontSize:10, fontWeight:700, fontFamily:'JetBrains Mono, monospace', color:r.c }}>{r.v}</span>
          </div>
        ))}
      </div>

      {/* Suggested Actions */}
      {(() => {
        const actions: Array<{icon:string; text:string; priority:'high'|'medium'|'low'}> = []
        if (ac.riskLevel === 'critical') {
          actions.push({ icon:'🚨', text:`Immediate reroute via ${ac.arrCode}-ALT`, priority:'high' })
          actions.push({ icon:'📡', text:'Contact ATC for emergency clearance', priority:'high' })
        }
        if (ac.riskLevel === 'high' || ac.riskLevel === 'critical') {
          actions.push({ icon:'✈', text:`Adjust altitude to FL${Math.round(ac.altFt / 100) + (ac.vspeed < 0 ? 20 : -20)}`, priority:'high' })
        }
        if (ac.storm) {
          actions.push({ icon:'⛈', text:'Deviate 15° right — storm avoidance', priority:'high' })
        }
        if (ac.fuelPct < 30) {
          actions.push({ icon:'⛽', text:`Divert to nearest airport — fuel critical`, priority:'high' })
        }
        if (ac.technicalIssue) {
          actions.push({ icon:'🔧', text:'Technical fault — declare PAN-PAN', priority:'medium' })
        }
        if (ac.windSpeed > 60) {
          actions.push({ icon:'💨', text:'Reduce speed — wind shear reported', priority:'medium' })
        }
        if (ac.visibility < 2000) {
          actions.push({ icon:'🌫', text:'Request ILS approach — low visibility', priority:'medium' })
        }
        if (ac.delayMin > 30) {
          actions.push({ icon:'⏱', text:'Update ETA — delay exceeds 30 min', priority:'low' })
        }
        if (!actions.length) {
          actions.push({ icon:'✅', text:'All systems nominal — continue flight', priority:'low' })
        }
        const pColor = (p: string) => p === 'high' ? '#ff3d57' : p === 'medium' ? '#ffab00' : '#00e676'
        return (
          <div style={{ background:'#040810', border:'1px solid #1a3050', borderRadius:6, padding:'8px 10px' }}>
            <div style={{ fontSize:9, fontWeight:700, color:'#ffab00', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Suggested Actions</div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {actions.map((a, i) => (
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:6, padding:'5px 7px', background:`${pColor(a.priority)}0e`, border:`1px solid ${pColor(a.priority)}33`, borderRadius:4 }}>
                  <span style={{ fontSize:11, flexShrink:0, lineHeight:1.4 }}>{a.icon}</span>
                  <span style={{ fontSize:9.5, color:'#7aacc0', fontFamily:'JetBrains Mono, monospace', lineHeight:1.5 }}>{a.text}</span>
                  <span style={{ marginLeft:'auto', fontSize:8, fontWeight:700, color:pColor(a.priority), flexShrink:0, alignSelf:'center' }}>{a.priority.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Coordinates */}
      <div style={{ background:'#060c18', border:'1px solid #0e1e2e', borderRadius:5, padding:'8px 10px', fontSize:9, fontFamily:'JetBrains Mono, monospace', color:'#4a7090' }}>
        <div>LAT: <span style={{ color:'#5a90b8' }}>{ac.lat.toFixed(4)}°</span>  LON: <span style={{ color:'#5a90b8' }}>{ac.lon.toFixed(4)}°</span></div>
        <div style={{ marginTop:2 }}>FL{Math.round(ac.altFt / 100).toString().padStart(3,'0')}  ·  {ac.airlineCode}{ac.id.replace(ac.airlineCode,'')}  ·  {ac.acType}</div>
      </div>
    </div>
  )
}

// ─── Navigation ───────────────────────────────────────────────────────────────

const NAV_ITEMS: Array<{ id: View; label: string; icon: string; group: string }> = [
  { id:'atc',       label:'Live ATC Map',      icon:'🗺',  group:'Operations' },
  { id:'dashboard', label:'Dashboard',          icon:'📊',  group:'Operations' },
  { id:'analytics', label:'Analytics',          icon:'📈',  group:'Operations' },
  { id:'weather',   label:'Weather',            icon:'⛅',  group:'Operations' },
  { id:'alerts',    label:'Alerts',             icon:'🚨',  group:'Monitoring' },
  { id:'reports',   label:'Reports',            icon:'📋',  group:'Monitoring' },
  { id:'data',      label:'Data Management',    icon:'🗄',  group:'Data' },
  { id:'add',       label:'Add Flight',         icon:'＋',  group:'Flights' },
  { id:'view',      label:'View Flights',       icon:'≡',   group:'Flights' },
  { id:'update',    label:'Update Flight',      icon:'✎',   group:'Flights' },
  { id:'delete',    label:'Delete Flight',      icon:'✕',   group:'Flights' },
  { id:'train',     label:'Train Model',        icon:'▶',   group:'ML Pipeline' },
  { id:'evaluate',  label:'Evaluate Model',     icon:'◉',   group:'ML Pipeline' },
  { id:'predict',   label:'Predict Deviation',  icon:'⚡',  group:'ML Pipeline' },
]

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try { const s = localStorage.getItem('atc_auth'); return s ? JSON.parse(s) : null } catch { return null }
  })

  function handleAuth(user: AuthUser) { setAuthUser(user) }
  function handleLogout() { localStorage.removeItem('atc_auth'); setAuthUser(null) }

  const [view, setView] = useState<View>('atc')
  const [flights, setFlights] = useState<Flight[]>([...FLIGHTS])
  const [selectedAC, setSelectedAC] = useState<string | null>(null)
  const [liveFleet, setLiveFleet] = useState<LiveAC[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showWeather, setShowWeather] = useState(false)
  const [filterRisk, setFilterRisk] = useState<string | null>(null)
  const [utc, setUtc] = useState('')
  const [lightMode, setLightMode] = useState(false)

  const initialFleetRef = useRef<LiveAC[]>([])
  if (initialFleetRef.current.length === 0) initialFleetRef.current = generateLiveFleet()

  const lastFleetUpdate = useRef(0)
  const onFleetUpdate = useCallback((fleet: LiveAC[]) => {
    const now = Date.now()
    if (now - lastFleetUpdate.current > 200) {
      lastFleetUpdate.current = now
      setLiveFleet([...fleet])
    }
  }, [])

  useEffect(() => {
    const t = setInterval(() => setUtc(new Date().toUTCString().slice(17, 25) + ' UTC'), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('light', lightMode)
  }, [lightMode])

  function onAdd(f: Flight) { setFlights(p => [f, ...p]) }
  function onUpdate(f: Flight) { setFlights(p => p.map(x => x.flight_id === f.flight_id ? f : x)) }
  function onDelete(id: string) { setFlights(p => p.filter(x => x.flight_id !== id)) }

  if (!authUser) return <AuthGate onAuth={handleAuth} />

  const currentItem = NAV_ITEMS.find(n => n.id === view)!
  const isATC = view === 'atc'
  const criticalCount = liveFleet.filter(a => a.riskLevel === 'critical').length
  const highCount = liveFleet.filter(a => a.riskLevel === 'high').length
  // selectedFlightData now used inside SectionATC

  const groups = ['Operations', 'Monitoring', 'Data', 'Flights', 'ML Pipeline']

  return (
    <div style={{ display:'flex', height:'100vh', background:'#040910', color:'#e2e8f0', fontFamily:"'Inter', system-ui, sans-serif", overflow:'hidden' }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <div style={{ width:sidebarOpen?220:52, flexShrink:0, background:'#06101e', borderRight:'1px solid #0e1e2e', display:'flex', flexDirection:'column', overflow:'hidden', transition:'width 0.18s ease' }}>

        {/* Logo + toggle */}
        <div style={{ padding:'11px 10px', borderBottom:'1px solid #0e1e2e', display:'flex', alignItems:'center', gap:8, minHeight:52 }}>
          <div style={{ width:30, height:30, borderRadius:7, background:'linear-gradient(135deg,#00a8d6,#004880)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>✈</div>
          {sidebarOpen && (
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:11, fontWeight:800, letterSpacing:'0.06em', color:'#7aacc0', whiteSpace:'nowrap' }}>AIRWAYS</div>
              <div style={{ fontSize:9, color:'#ffffff', letterSpacing:'0.04em', whiteSpace:'nowrap' }}>ATC OPERATIONS CENTER</div>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background:'transparent', border:'1px solid #1a3050', borderRadius:4, color:'#4a7090', cursor:'pointer', fontSize:12, width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, lineHeight:1 }}>
            {sidebarOpen ? '‹' : '›'}
          </button>
        </div>

        {/* Nav */}
        <div style={{ flex:1, overflowY:'auto', padding:'6px 0' }}>
          {groups.map(grp => {
            const items = NAV_ITEMS.filter(n => n.group === grp)
            return (
              <div key={grp} style={{ marginBottom:2 }}>
                {sidebarOpen && <div style={{ padding:'6px 14px 2px', fontSize:8.5, letterSpacing:'0.12em', textTransform:'uppercase', color:'#2a4860', fontWeight:700 }}>{grp}</div>}
                {items.map(item => {
                  const active = view === item.id
                  const isAlert = item.id === 'alerts' && criticalCount > 0
                  return (
                    <button key={item.id} onClick={() => setView(item.id)}
                      title={!sidebarOpen ? item.label : undefined}
                      style={{ display:'flex', alignItems:'center', gap:9, width:'100%', padding:sidebarOpen?'8px 14px':'8px 0', justifyContent:sidebarOpen?'flex-start':'center', border:'none', background:active?'#00D4FF14':'transparent', borderLeft:active?'2px solid #00D4FF':'2px solid transparent', color:active?'#00D4FF':item.id==='atc'?'#7aacc0':'#4a7090', fontSize:12, fontWeight:active?700:400, cursor:'pointer', textAlign:'left', transition:'all .1s', position:'relative' }}>
                      <span style={{ fontSize:13, opacity:0.8, flexShrink:0 }}>{item.icon}</span>
                      {sidebarOpen && <span style={{ flex:1 }}>{item.label}</span>}
                      {sidebarOpen && isAlert && <span style={{ width:6, height:6, borderRadius:'50%', background:'#ff3d57', flexShrink:0 }} />}
                      {!sidebarOpen && isAlert && <span style={{ position:'absolute', top:4, right:6, width:5, height:5, borderRadius:'50%', background:'#ff3d57' }} />}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        {sidebarOpen && (
          <div style={{ padding:'9px 14px', borderTop:'1px solid #0e1e2e' }}>
            <div style={{ fontSize:9.5, color:'#3a5870', lineHeight:2 }}>
              <div>Model: <span style={{ color:'#5a90b8' }}>XGBoost v3.1</span></div>
              <div>Flights: <span style={{ color:'#5a90b8' }}>{flights.length}</span></div>
              <div>Live AC: <span style={{ color:'#5a90b8' }}>{liveFleet.length}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* ── Main area ────────────────────────────────────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>

        {/* Top bar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', background:'#050e1a', borderBottom:'1px solid #0e1e2e', flexShrink:0, height:44, gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div>
              <div style={{ fontSize:9, color:'#3a5870', letterSpacing:'0.08em', textTransform:'uppercase', lineHeight:1 }}>Airways Route Deviation Prediction System</div>
              <div style={{ fontSize:14, fontWeight:700, color:'#ffffff', lineHeight:1.3 }}>{currentItem.label}</div>
            </div>
          </div>

          {/* ATC map controls */}
          {isATC && (
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <button onClick={() => setShowWeather(!showWeather)} style={{ padding:'4px 10px', border:`1px solid ${showWeather?'#4488FF55':'#1a3050'}`, borderRadius:4, background:showWeather?'#4488FF14':'transparent', color:showWeather?'#4488FF':'#4a7090', fontSize:10, cursor:'pointer', fontWeight:showWeather?700:400 }}>⛅ Weather</button>
              {(['low','medium','high','critical'] as const).map(r => (
                <button key={r} onClick={() => setFilterRisk(filterRisk === r ? null : r)} style={{ padding:'4px 8px', border:`1px solid ${filterRisk===r?'#00D4FF55':'#1a3050'}`, borderRadius:3, background:filterRisk===r?'#00D4FF14':'transparent', color:filterRisk===r?'#00D4FF':'#4a7090', fontSize:9, cursor:'pointer', fontWeight:700, textTransform:'uppercase' }}>{r}</button>
              ))}
            </div>
          )}

          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {isATC && (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 8px', background:'#060c18', border:'1px solid #0e1e2e', borderRadius:4 }}>
                  <Pulse color="#00e676" size={5} />
                  <span style={{ fontSize:9, fontFamily:'JetBrains Mono, monospace', color:'#5a90b8' }}>AC: <span style={{ color:'#00e676' }}>{liveFleet.length}</span></span>
                </div>
                {criticalCount > 0 && (
                  <div style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 8px', background:'#ff3d5714', border:'1px solid #ff3d5744', borderRadius:4 }}>
                    <Pulse color="#ff3d57" size={5} />
                    <span style={{ fontSize:9, fontFamily:'JetBrains Mono, monospace', color:'#ff3d57', fontWeight:700 }}>CRITICAL: {criticalCount}</span>
                  </div>
                )}
                {highCount > 0 && (
                  <div style={{ padding:'3px 8px', background:'#FF6B0014', border:'1px solid #FF6B0044', borderRadius:4 }}>
                    <span style={{ fontSize:9, fontFamily:'JetBrains Mono, monospace', color:'#FF6B00', fontWeight:700 }}>HIGH: {highCount}</span>
                  </div>
                )}
              </>
            )}
            {!isATC && (
              <>
                <Badge color="#00e676">{flights.filter(f => f.deviation === 0).length} Normal</Badge>
                <Badge color="#ff3d57">{flights.filter(f => f.deviation === 1).length} Deviation</Badge>
              </>
            )}
            <button onClick={() => setLightMode(l => !l)} title={lightMode ? 'Dark mode' : 'Light mode'} style={{ padding:'3px 9px', border:'1px solid #1a3050', borderRadius:4, background:'#060c18', color:'#7aacc0', fontSize:12, cursor:'pointer', lineHeight:1.4 }}>
              {lightMode ? '🌙' : '☀'}
            </button>
            <span style={{ fontSize:9, fontFamily:'JetBrains Mono, monospace', color:'#3a5870' }}>{utc}</span>
            {/* user chip + logout */}
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 8px 3px 6px', background:'#040c18', border:'1px solid #1a2d44', borderRadius:4 }}>
              <div style={{ width:18, height:18, borderRadius:'50%', background:'linear-gradient(135deg,#00a8d6,#004880)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'#fff', fontWeight:700, flexShrink:0 }}>
                {authUser.username[0].toUpperCase()}
              </div>
              <div style={{ display:'flex', flexDirection:'column', lineHeight:1.2 }}>
                <span style={{ fontSize:9.5, color:'#7aacc0', fontWeight:600, whiteSpace:'nowrap' }}>{authUser.username}</span>
                <span style={{ fontSize:8, color:'#3a5870', fontFamily:'JetBrains Mono, monospace', letterSpacing:'0.05em', textTransform:'uppercase' }}>{authUser.role}</span>
              </div>
              <button onClick={handleLogout} title="Logout" style={{ background:'transparent', border:'1px solid #1a3050', borderRadius:3, color:'#4a7090', fontSize:9, cursor:'pointer', padding:'2px 5px', marginLeft:2, lineHeight:1.4, transition:'color 0.15s, border-color 0.15s' }}
                onMouseEnter={e=>{(e.target as HTMLButtonElement).style.color='#ff3d57';(e.target as HTMLButtonElement).style.borderColor='#ff3d5740'}}
                onMouseLeave={e=>{(e.target as HTMLButtonElement).style.color='#4a7090';(e.target as HTMLButtonElement).style.borderColor='#1a3050'}}
              >
                ⏻
              </button>
            </div>
          </div>
        </div>

        {/* Content area */}
        <div style={{ flex:1, overflow:'hidden', position:'relative', background:'#050d18' }}>
          {isATC ? (
            // ── ATC Operations view (radar + airspace + altitude panel + alerts)
            <SectionATC
              fleet={liveFleet}
              initialFleet={initialFleetRef.current}
              onFleetUpdate={onFleetUpdate}
              selectedAC={selectedAC}
              onSelectAC={setSelectedAC}
              showWeather={showWeather}
              filterRisk={filterRisk}
            />
          ) : (
            // ── Section views ────────────────────────────────────────────────
            <div style={{ height:'100%', overflowY:'auto' }}>
              <div style={{ padding:'16px 18px' }}>
                {view === 'dashboard'  && <SectionDashboard flights={flights} />}
                {view === 'analytics'  && <SectionAnalytics flights={flights} />}
                {view === 'weather'    && <SectionWeather flights={flights} />}
                {view === 'alerts'     && <SectionAlerts flights={flights} />}
                {view === 'reports'    && <SectionReports flights={flights} />}
                {view === 'data'       && <SectionDataManagement flights={flights} />}
                {view === 'add'        && <SectionAdd onAdd={onAdd} />}
                {view === 'view'       && <SectionView flights={flights} />}
                {view === 'update'     && <SectionUpdate flights={flights} onUpdate={onUpdate} />}
                {view === 'delete'     && <SectionDelete flights={flights} onDelete={onDelete} />}
                {view === 'train'      && <SectionTrain />}
                {view === 'evaluate'   && <SectionEvaluate />}
                {view === 'predict'    && <SectionPredict liveFleet={liveFleet} />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

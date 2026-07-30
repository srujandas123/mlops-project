/**
 * SectionATC — top-level ATC operations view.
 * Manages: mode toggle (2D Radar / Airspace Map), altitude panel,
 * live alert notifications, and the right flight-info panel.
 */
import { useState, useRef, useEffect } from 'react'
import ATCMap from './ATCMap'
import type { MapHandle } from './ATCMap'
import RadarCanvas, { devColor, devLabel, deviationKm, confidence, deviationReason } from './RadarCanvas'
import type { LiveAC } from '../data/liveFlights'

// ── FL quick-select buttons ────────────────────────────────────────────────────
const FL_BUTTONS = [18000, 22000, 26000, 30000, 34000, 36000, 39000, 41000]
function flLabel(ft: number) { return `FL${Math.round(ft / 100).toString().padStart(3, '0')}` }

// ── Alert type ────────────────────────────────────────────────────────────────
interface LiveAlert {
  id:       string
  kind:     'deviation' | 'weather' | 'collision' | 'emergency'
  severity: 'info' | 'warning' | 'critical'
  acId:     string
  msg:      string
  ts:       number
}

function alertColor(s: LiveAlert['severity']) {
  return s === 'critical' ? '#ff3d57' : s === 'warning' ? '#ffab00' : '#00D4FF'
}
function alertIcon(k: LiveAlert['kind']) {
  return k === 'deviation' ? '⚠' : k === 'weather' ? '⛈' : k === 'collision' ? '🚨' : '🆘'
}

// ── Small Pulse dot ────────────────────────────────────────────────────────────
function Dot({ color }: { color: string }) {
  return (
    <span style={{
      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
      background: color, flexShrink: 0,
      boxShadow: `0 0 4px ${color}`,
    }} />
  )
}

// ── FlightInfoPanel ────────────────────────────────────────────────────────────
function FlightInfoPanel({ ac, onClose }: { ac: LiveAC | undefined; onClose: () => void }) {
  if (!ac) return null
  const riskCol = devColor(ac.devProb)
  const phaseCol = ac.phase === 'climb' ? '#00e676' : ac.phase === 'descent' ? '#ffab00' : ac.phase === 'approach' ? '#ff3d57' : '#00D4FF'
  const altCol  = ac.altFt > 35000 ? '#ffab00' : ac.altFt > 25000 ? '#00e676' : '#00D4FF'
  const isDeviated = ac.devProb >= 0.2

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#00D4FF' }}>{ac.id}</div>
          <div style={{ fontSize: 10, color: '#5a90b8', marginTop: 2 }}>{ac.airline} · {ac.acType} · {ac.isCargo ? 'CARGO' : 'PAX'}</div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #1a3050', borderRadius: 4, color: '#5a90b8', cursor: 'pointer', fontSize: 16, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
      </div>

      {/* Route bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#060c18', border: '1px solid #1a3050', borderRadius: 6 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#7aacc0' }}>{ac.depCode}</div>
          <div style={{ fontSize: 9, color: '#3a6888' }}>DEP</div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ width: '100%', height: 1, background: 'linear-gradient(90deg,#1a3050,#00D4FF66,#1a3050)' }} />
          <span style={{ fontSize: 9, color: '#00D4FF', fontFamily: 'JetBrains Mono, monospace' }}>▶ {Math.round(ac.progress * 100)}%</span>
          <div style={{ width: '100%', height: 1, background: 'linear-gradient(90deg,#1a3050,#0e1e2e,#1a3050)' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#7aacc0' }}>{ac.arrCode}</div>
          <div style={{ fontSize: 9, color: '#3a6888' }}>ARR</div>
        </div>
      </div>

      {/* Status badges */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        <span style={{ padding: '3px 9px', borderRadius: 10, border: `1px solid ${riskCol}55`, background: `${riskCol}18`, fontSize: 9, fontWeight: 700, color: riskCol }}>{devLabel(ac.devProb)}</span>
        <span style={{ padding: '3px 9px', borderRadius: 10, border: `1px solid ${phaseCol}55`, background: `${phaseCol}18`, fontSize: 9, fontWeight: 700, color: phaseCol }}>{ac.phase.toUpperCase()}</span>
        {ac.storm && <span style={{ padding: '3px 9px', borderRadius: 10, border: '1px solid #ff3d5755', background: '#ff3d5718', fontSize: 9, fontWeight: 700, color: '#ff3d57' }}>⛈ STORM</span>}
        {ac.technicalIssue && <span style={{ padding: '3px 9px', borderRadius: 10, border: '1px solid #bf7fff55', background: '#bf7fff18', fontSize: 9, fontWeight: 700, color: '#bf7fff' }}>🔧 TECH</span>}
      </div>

      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {[
          { l: 'Altitude', v: `${ac.altFt.toLocaleString()} ft`, c: altCol },
          { l: 'Speed', v: `${ac.speedKts} kts`, c: '#7aacc0' },
          { l: 'Heading', v: `${Math.round(ac.heading)}°`, c: '#7aacc0' },
          { l: 'V/S', v: `${ac.vspeed > 0 ? '+' : ''}${ac.vspeed} ft/m`, c: ac.vspeed > 0 ? '#00e676' : ac.vspeed < 0 ? '#ffab00' : '#7aacc0' },
          { l: 'ETA', v: `${ac.etaMin}m`, c: '#7aacc0' },
          { l: 'Fuel', v: `${ac.fuelPct}%`, c: ac.fuelPct < 30 ? '#ff3d57' : ac.fuelPct < 50 ? '#ffab00' : '#00e676' },
          { l: 'Delay', v: `${ac.delayMin}m`, c: ac.delayMin > 30 ? '#ffab00' : '#7aacc0' },
          { l: 'Distance', v: `${ac.distanceNm} nm`, c: '#7aacc0' },
        ].map(r => (
          <div key={r.l} style={{ padding: '7px 9px', background: '#060c18', border: '1px solid #1a3050', borderRadius: 5 }}>
            <div style={{ fontSize: 8, color: '#4a7090', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{r.l}</div>
            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: r.c, marginTop: 1 }}>{r.v}</div>
          </div>
        ))}
      </div>

      {/* Weather */}
      <div style={{ background: '#040810', border: '1px solid #1a3050', borderRadius: 6, padding: '8px 10px' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#7aacc0', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Weather Conditions</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}>
          {[
            { l: 'Wind', v: `${ac.windSpeed} km/h`, c: ac.windSpeed > 60 ? '#ffab00' : '#7aacc0' },
            { l: 'Visibility', v: `${(ac.visibility / 1000).toFixed(1)} km`, c: ac.visibility < 2000 ? '#ff3d57' : '#7aacc0' },
            { l: 'Temperature', v: `${ac.temperature}°C`, c: '#7aacc0' },
            { l: 'Storm', v: ac.storm ? 'ACTIVE' : 'CLEAR', c: ac.storm ? '#ff3d57' : '#00e676' },
          ].map(r => (
            <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px solid #0c1828' }}>
              <span style={{ color: '#4a7090' }}>{r.l}</span>
              <span style={{ fontWeight: 700, color: r.c }}>{r.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Deviation analysis */}
      {isDeviated && (
        <div style={{ background: '#040810', border: `1px solid ${riskCol}44`, borderRadius: 6, padding: '8px 10px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: riskCol, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>⚠ Deviation Analysis</div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: '#5a90b8', fontFamily: 'JetBrains Mono, monospace' }}>Probability</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: riskCol }}>{(ac.devProb * 100).toFixed(1)}%</span>
            </div>
            <div style={{ height: 5, background: '#0e1e2e', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${ac.devProb * 100}%`, background: riskCol, borderRadius: 3, transition: 'width .3s' }} />
            </div>
          </div>
          {[
            { l: 'Deviation Distance', v: `${deviationKm(ac.devProb)} km` },
            { l: 'Confidence Score', v: `${confidence(ac.devProb)}%` },
            { l: 'Reason', v: deviationReason(ac) },
            { l: 'Suggested Action', v: ac.devProb >= 0.65 ? 'Reroute immediately' : ac.devProb >= 0.4 ? 'Monitor closely' : 'Standard monitoring' },
          ].map(r => (
            <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #0c1828' }}>
              <span style={{ fontSize: 9, color: '#4a7090', fontFamily: 'JetBrains Mono, monospace' }}>{r.l}</span>
              <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: riskCol }}>{r.v}</span>
            </div>
          ))}
        </div>
      )}

      {/* AI prediction */}
      <div style={{ background: '#040810', border: '1px solid #1a3050', borderRadius: 6, padding: '8px 10px' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#00D4FF', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>ML Prediction</div>
        {[
          { l: 'Risk Level', v: devLabel(ac.devProb), c: riskCol },
          { l: 'Model', v: 'XGBoost v3.1', c: '#7aacc0' },
        ].map(r => (
          <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px solid #0c1828' }}>
            <span style={{ fontSize: 9, color: '#4a7090', fontFamily: 'JetBrains Mono, monospace' }}>{r.l}</span>
            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: r.c }}>{r.v}</span>
          </div>
        ))}
      </div>

      {/* Coordinates */}
      <div style={{ background: '#060c18', border: '1px solid #0e1e2e', borderRadius: 5, padding: '7px 10px', fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#4a7090' }}>
        <div>LAT: <span style={{ color: '#5a90b8' }}>{ac.lat.toFixed(4)}°</span>  LON: <span style={{ color: '#5a90b8' }}>{ac.lon.toFixed(4)}°</span></div>
        <div style={{ marginTop: 2 }}>FL{Math.round(ac.altFt / 100).toString().padStart(3, '0')} · {ac.airlineCode}{ac.id.replace(ac.airlineCode, '')} · {ac.acType}</div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  fleet:         LiveAC[]
  initialFleet:  LiveAC[]
  onFleetUpdate: (fleet: LiveAC[]) => void
  selectedAC:    string | null
  onSelectAC:    (id: string | null) => void
  showWeather:   boolean
  filterRisk:    string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  flights?:      any[]  // reserved for future use
}

type RadarMode = 'radar' | 'airspace'

export default function SectionATC({
  fleet, initialFleet, onFleetUpdate,
  selectedAC, onSelectAC,
  showWeather, filterRisk,
}: Props) {
  const [mode, setMode]           = useState<RadarMode>('airspace')
  const [altFilter, setAltFilter] = useState<number | null>(null)
  const [alerts, setAlerts]       = useState<LiveAlert[]>([])
  const [showAlerts, setShowAlerts] = useState(true)
  const alertIdsRef               = useRef<Set<string>>(new Set())
  const lastAlertScan             = useRef(0)
  const dismissTimers             = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const mapHandleRef              = useRef<MapHandle>(null)

  // ── Generate live alerts from fleet ───────────────────────────────────────
  useEffect(() => {
    const now = Date.now()
    if (now - lastAlertScan.current < 3000) return
    lastAlertScan.current = now

    const newAlerts: LiveAlert[] = []
    for (const ac of fleet) {
      // Critical deviation
      if (ac.devProb >= 0.65) {
        const id = `dev-${ac.id}`
        if (!alertIdsRef.current.has(id)) {
          alertIdsRef.current.add(id)
          newAlerts.push({ id, kind: 'deviation', severity: 'critical', acId: ac.id, msg: `${ac.id} critical deviation — ${deviationKm(ac.devProb)}km off route (${deviationReason(ac)})`, ts: now })
        }
      }
      // Weather + deviation
      if (ac.storm && ac.devProb >= 0.4) {
        const id = `wx-${ac.id}`
        if (!alertIdsRef.current.has(id)) {
          alertIdsRef.current.add(id)
          newAlerts.push({ id, kind: 'weather', severity: 'warning', acId: ac.id, msg: `${ac.id} entering active storm cell — route deviation risk HIGH`, ts: now })
        }
      }
      // Emergency: low fuel + deviation
      if (ac.fuelPct < 20 && ac.devProb >= 0.3) {
        const id = `emer-${ac.id}`
        if (!alertIdsRef.current.has(id)) {
          alertIdsRef.current.add(id)
          newAlerts.push({ id, kind: 'emergency', severity: 'critical', acId: ac.id, msg: `${ac.id} EMERGENCY — fuel critical (${ac.fuelPct}%) + active deviation`, ts: now })
        }
      }
    }

    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev].slice(0, 30))
      if (newAlerts.some(a => a.severity === 'critical')) setShowAlerts(true)
      // Auto-dismiss non-critical alerts after 6 seconds
      for (const a of newAlerts) {
        if (a.severity !== 'critical') {
          const timer = setTimeout(() => dismissAlert(a.id), 6000)
          dismissTimers.current.set(a.id, timer)
        }
      }
    }
  }, [fleet])

  // Cleanup dismiss timers on unmount
  useEffect(() => {
    return () => { dismissTimers.current.forEach(t => clearTimeout(t)) }
  }, [])

  function dismissAlert(id: string) {
    setAlerts(prev => prev.filter(a => a.id !== id))
    alertIdsRef.current.delete(id)
    const t = dismissTimers.current.get(id)
    if (t) { clearTimeout(t); dismissTimers.current.delete(id) }
  }

  function focusAlert(acId: string) {
    onSelectAC(acId)
    if (mode === 'airspace') {
      mapHandleRef.current?.zoomToAC(acId)
    }
  }

  const selectedFlightData = selectedAC ? fleet.find(a => a.id === selectedAC) : undefined
  const visibleCount = altFilter !== null
    ? fleet.filter(ac => Math.abs(ac.altFt - altFilter) <= 2200).length
    : fleet.length

  const critCount = alerts.filter(a => a.severity === 'critical').length
  const warnCount = alerts.filter(a => a.severity === 'warning').length

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', background: '#040910' }}>

      {/* ── Mode toggle bar ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
        background: '#06101e', borderBottom: '1px solid #0e1e2e',
        flexShrink: 0, zIndex: 900,
      }}>
        {/* Toggle */}
        <div style={{ display: 'flex', background: '#040910', border: '1px solid #0e1e2e', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
          {(['radar', 'airspace'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: '5px 14px', border: 'none', background: mode === m ? '#00D4FF18' : 'transparent',
              borderRight: m === 'radar' ? '1px solid #0e1e2e' : 'none',
              color: mode === m ? '#00D4FF' : '#4a7090', fontSize: 11, fontWeight: mode === m ? 700 : 400,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            }}>
              {m === 'radar' ? '📡 ATC Radar' : '🗺 Airspace View'}
            </button>
          ))}
        </div>

        {/* Alert toggle button */}
        {alerts.length > 0 && (
          <button onClick={() => setShowAlerts(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px',
            background: critCount > 0 ? '#ff3d5710' : '#0a1628',
            border: `1px solid ${critCount > 0 ? '#ff3d5740' : '#0e1e2e'}`,
            borderRadius: 5, cursor: 'pointer',
          }}>
            {critCount > 0 && <Dot color="#ff3d57" />}
            {warnCount > 0 && <Dot color="#ffab00" />}
            <span style={{ fontSize: 10, fontWeight: 700, color: critCount > 0 ? '#ff3d57' : '#7aacc0' }}>
              {alerts.length} alert{alerts.length !== 1 ? 's' : ''} {showAlerts ? '▾' : '▸'}
            </span>
          </button>
        )}

        {/* Visible aircraft count */}
        <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#5a90b8', marginLeft: 'auto' }}>
          {altFilter !== null ? (
            <span><span style={{ color: '#00e676' }}>{visibleCount}</span> / {fleet.length} at <span style={{ color: '#00D4FF' }}>{flLabel(altFilter)}</span></span>
          ) : (
            <span><span style={{ color: '#00e676' }}>{fleet.length}</span> aircraft tracked</span>
          )}
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Map views — ATCMap always mounted (keeps fleet simulation running) */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

          {/* Airspace (Leaflet) */}
          <div style={{
            position: 'absolute', inset: 0,
            visibility: mode === 'airspace' ? 'visible' : 'hidden',
            pointerEvents: mode === 'airspace' ? 'auto' : 'none',
          }}>
            <ATCMap
              ref={mapHandleRef}
              selectedAC={selectedAC}
              onSelectAC={onSelectAC}
              showWeather={showWeather}
              filterRisk={filterRisk}
              altFilter={altFilter}
              onFleetUpdate={onFleetUpdate}
              initialFleet={initialFleet}
            />
          </div>

          {/* 2D Radar scope */}
          {mode === 'radar' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020c06' }}>
              <RadarCanvas
                fleet={fleet}
                selectedAC={selectedAC}
                onSelectAC={onSelectAC}
                altFilter={altFilter}
              />
            </div>
          )}

          {/* ── Altitude legend overlay (Airspace mode) ───────────────────────── */}
          {mode === 'airspace' && (
            <div style={{ position: 'absolute', bottom: 80, left: 10, background: 'rgba(6,11,20,0.88)', border: '1px solid #0e1e2e', borderRadius: 6, padding: '8px 10px', zIndex: 700, pointerEvents: 'none' }}>
              <div style={{ fontSize: 9, color: '#3a5870', marginBottom: 5, letterSpacing: '0.08em', fontFamily: 'JetBrains Mono, monospace' }}>DEVIATION STATUS</div>
              {[['ON ROUTE', '#00e676'], ['MINOR DEV', '#ffd700'], ['MED DEV', '#ff6b00'], ['CRITICAL', '#ff3d57']].map(([l, c]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, boxShadow: `0 0 4px ${c}` }} />
                  <span style={{ fontSize: 9, color: '#5a90b8', fontFamily: 'JetBrains Mono, monospace' }}>{l}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid #0e1e2e', marginTop: 5, paddingTop: 5 }}>
                {[['Planned Route', '#4488FF', 'dashed'], ['Current Route', '#ffffff', 'solid'], ['Predicted Path', '(risk color)', 'dashed'], ['Alt. Route', '#bf7fff', 'dotted']].map(([l, c]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <div style={{ width: 14, height: 2, background: c, borderRadius: 1, opacity: 0.8 }} />
                    <span style={{ fontSize: 8, color: '#4a7090', fontFamily: 'JetBrains Mono, monospace' }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Reset View button (airspace mode only) ─────────────────────────── */}
          {mode === 'airspace' && (
            <button
              onClick={() => mapHandleRef.current?.resetView()}
              style={{
                position: 'absolute', top: 10, left: 10, zIndex: 700,
                padding: '5px 11px', background: 'rgba(6,10,20,0.88)',
                border: '1px solid #1a3050', borderRadius: 5, cursor: 'pointer',
                color: '#7aacc0', fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              ⌂ Reset View
            </button>
          )}

          {/* ── Floating alerts toast overlay ──────────────────────────────────── */}
          {alerts.length > 0 && showAlerts && (
            <div style={{
              position: 'absolute', top: 10, right: 10, zIndex: 750,
              width: 258, pointerEvents: 'auto',
              display: 'flex', flexDirection: 'column', gap: 0,
              background: 'rgba(4,8,18,0.95)', border: '1px solid #1a3050',
              borderRadius: 7, overflow: 'hidden',
            }}>
              {/* Panel header with single close button */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 10px 6px 12px',
                borderBottom: '1px solid #0e1e2e', flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {critCount > 0 && <Dot color="#ff3d57" />}
                  <span style={{ fontSize: 10, fontWeight: 700, color: critCount > 0 ? '#ff3d57' : '#7aacc0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Live Warnings  ({alerts.length})
                  </span>
                </div>
                <button
                  onClick={() => setShowAlerts(false)}
                  title="Close panel"
                  style={{
                    background: 'transparent', border: '1px solid #1a3050',
                    borderRadius: 4, color: '#5a90b8', cursor: 'pointer',
                    fontSize: 13, width: 22, height: 22,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1, flexShrink: 0,
                  }}
                >✕</button>
              </div>
              {/* Alert items */}
              <div style={{ maxHeight: 320, overflowY: 'auto', padding: '5px 6px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {alerts.slice(0, 8).map(a => (
                  <div
                    key={a.id}
                    onClick={() => focusAlert(a.acId)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 7,
                      padding: '7px 8px',
                      background: 'rgba(6,12,24,0.8)',
                      border: `1px solid ${alertColor(a.severity)}30`,
                      borderLeft: `3px solid ${alertColor(a.severity)}`,
                      borderRadius: 4, cursor: 'pointer',
                      animation: 'fade-in 0.2s ease',
                    }}
                  >
                    <span style={{ fontSize: 11, lineHeight: 1, paddingTop: 1, flexShrink: 0 }}>{alertIcon(a.kind)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: alertColor(a.severity), textTransform: 'uppercase', letterSpacing: '0.04em' }}>{a.severity}</span>
                        <span style={{ fontSize: 9, color: '#4a7090', fontFamily: 'JetBrains Mono, monospace' }}>{a.acId}</span>
                      </div>
                      <div style={{ fontSize: 9, color: '#8ab0c8', lineHeight: 1.35 }}>{a.msg}</div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); dismissAlert(a.id) }}
                      style={{
                        background: 'transparent', border: 'none', color: '#3a5870',
                        fontSize: 13, cursor: 'pointer', flexShrink: 0, padding: '0 0 0 4px',
                        lineHeight: 1, alignSelf: 'flex-start',
                      }}
                    >×</button>
                  </div>
                ))}
                {alerts.length > 8 && (
                  <div style={{ textAlign: 'center', fontSize: 9, color: '#4a7090', padding: '3px 0', fontFamily: 'JetBrains Mono, monospace' }}>
                    +{alerts.length - 8} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Radar deviation legend ─────────────────────────────────────────── */}
          {mode === 'radar' && (
            <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(2,12,6,0.88)', border: '1px solid #0a2808', borderRadius: 6, padding: '8px 10px', zIndex: 700, pointerEvents: 'none' }}>
              <div style={{ fontSize: 9, color: '#1a5520', marginBottom: 6, letterSpacing: '0.08em', fontFamily: 'JetBrains Mono, monospace' }}>DEVIATION STATUS</div>
              {[['ON ROUTE', '#00e676'], ['MINOR DEV', '#ffd700'], ['MED DEV', '#ff6b00'], ['CRITICAL', '#ff3d57']].map(([l, c]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, boxShadow: `0 0 6px ${c}` }} />
                  <span style={{ fontSize: 9, color: '#2a7030', fontFamily: 'JetBrains Mono, monospace' }}>{l}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Flight info right panel ────────────────────────────────────────── */}
        {selectedAC && (
          <div style={{
            width: 295, flexShrink: 0, background: 'rgba(6,10,18,0.97)',
            borderLeft: '1px solid #0e1e2e', overflow: 'hidden', zIndex: 850,
          }}>
            <FlightInfoPanel ac={selectedFlightData} onClose={() => onSelectAC(null)} />
          </div>
        )}
      </div>

      {/* ── Altitude control panel ─────────────────────────────────────────── */}
      <div style={{
        background: '#06101e', borderTop: '1px solid #0e1e2e',
        padding: '8px 14px', flexShrink: 0, zIndex: 900,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Label */}
          <div style={{ fontSize: 9, color: '#3a5870', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
            ALTITUDE<br />FILTER
          </div>

          {/* FL quick buttons */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap', overflowX: 'auto' }}>
            <button onClick={() => setAltFilter(null)} style={{
              padding: '4px 10px', borderRadius: 4, border: `1px solid ${altFilter === null ? '#00D4FF55' : '#1a3050'}`,
              background: altFilter === null ? '#00D4FF14' : 'transparent', color: altFilter === null ? '#00D4FF' : '#4a7090',
              fontSize: 10, fontWeight: altFilter === null ? 700 : 400, cursor: 'pointer', flexShrink: 0,
              fontFamily: 'JetBrains Mono, monospace',
            }}>ALL</button>
            {FL_BUTTONS.map(ft => (
              <button key={ft} onClick={() => setAltFilter(altFilter === ft ? null : ft)} style={{
                padding: '4px 10px', borderRadius: 4, flexShrink: 0,
                border: `1px solid ${altFilter === ft ? '#00D4FF55' : '#1a3050'}`,
                background: altFilter === ft ? '#00D4FF14' : 'transparent',
                color: altFilter === ft ? '#00D4FF' : '#4a7090',
                fontSize: 10, fontWeight: altFilter === ft ? 700 : 400, cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace',
              }}>{flLabel(ft)}</button>
            ))}
          </div>

          {/* Slider */}
          <div style={{ flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="range" min={18000} max={41000} step={1000}
              value={altFilter ?? 30000}
              onChange={e => setAltFilter(+e.target.value)}
              style={{ flex: 1, accentColor: '#00D4FF', cursor: 'pointer' }}
            />
            <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: altFilter !== null ? '#00D4FF' : '#3a5870', flexShrink: 0 }}>
              {altFilter !== null ? flLabel(altFilter) : '–'}
            </div>
          </div>

          {/* Stats for selected altitude */}
          {altFilter !== null && (
            <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#5a90b8', flexShrink: 0, textAlign: 'right' }}>
              <div><span style={{ color: '#00e676' }}>{visibleCount}</span> of {fleet.length}</div>
              <div style={{ color: '#3a5870' }}>±2000ft</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

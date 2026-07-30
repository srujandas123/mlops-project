/**
 * RadarCanvas — classic 2D phosphor ATC scope.
 * Receives fleet from props (updated ~5fps from App state via onFleetUpdate).
 * Runs its own 60fps loop for sweep animation and glow effects.
 */
import { useEffect, useRef, useState } from 'react'
import type { LiveAC, AircraftType } from '../data/liveFlights'

// ── Radar geography ────────────────────────────────────────────────────────────
const CENTER_LAT   = 27
const CENTER_LON   = 42
const RANGE_DEFAULT = 60   // degrees radius shown on scope
const RANGE_MIN     = 8
const RANGE_MAX     = 110

// ── Deviation colour scale ─────────────────────────────────────────────────────
export function devColor(devProb: number): string {
  if (devProb < 0.2)  return '#00e676'  // green  — on route
  if (devProb < 0.4)  return '#ffd700'  // yellow — minor
  if (devProb < 0.65) return '#ff6b00'  // orange — medium
  return '#ff3d57'                       // red    — critical
}

export function devLabel(devProb: number): string {
  if (devProb < 0.2)  return 'ON ROUTE'
  if (devProb < 0.4)  return 'MINOR DEV'
  if (devProb < 0.65) return 'MED DEV'
  return 'CRITICAL'
}

export function deviationKm(devProb: number) { return +(devProb * 48).toFixed(0) }
export function confidence(devProb: number)   { return +(75 + (1 - devProb) * 20).toFixed(0) }
export function deviationReason(ac: LiveAC): string {
  if (ac.storm)              return 'Wx: active storm cell'
  if (ac.technicalIssue)     return 'Technical malfunction'
  if (ac.windSpeed > 65)     return 'Wind shear'
  if (ac.visibility < 1500)  return 'Low visibility'
  if (ac.fuelPct < 25)       return 'Low fuel — direct routing'
  return 'Traffic congestion'
}

// ── Projection ─────────────────────────────────────────────────────────────────
function projectR(lat: number, lon: number, cx: number, cy: number, r: number, range: number) {
  return {
    x: cx + ((lon - CENTER_LON) / range) * r,
    y: cy - ((lat - CENTER_LAT) / range) * r,
  }
}

function inScopeR(lat: number, lon: number, range: number): boolean {
  const dlat = lat - CENTER_LAT
  const dlon = lon - CENTER_LON
  return Math.sqrt(dlat * dlat + dlon * dlon) <= range
}


// ── Aircraft icon type map ─────────────────────────────────────────────────────
function drawBlip(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  heading: number,
  color: string,
  sz: number,
  selected: boolean,
  acType: AircraftType
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((heading * Math.PI) / 180)
  ctx.beginPath()

  switch (acType) {
    case 'Helicopter': {
      ctx.restore(); ctx.save(); ctx.translate(x, y)
      ctx.beginPath(); ctx.arc(0, 0, sz * 1.2, 0, Math.PI * 2)
      ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(-sz * 1.2, 0); ctx.lineTo(sz * 1.2, 0)
      ctx.moveTo(0, -sz * 1.2); ctx.lineTo(0, sz * 1.2)
      ctx.stroke()
      ctx.beginPath(); ctx.arc(0, 0, sz * 0.35, 0, Math.PI * 2)
      ctx.fillStyle = color; ctx.fill()
      ctx.restore(); return
    }
    case 'B747F': case 'B777F': {
      ctx.moveTo(0, -sz * 1.6)
      ctx.lineTo(sz * 1.1, sz * 0.5)
      ctx.lineTo(sz * 0.5, sz * 0.7)
      ctx.lineTo(sz * 0.3, sz * 1.2)
      ctx.lineTo(-sz * 0.3, sz * 1.2)
      ctx.lineTo(-sz * 0.5, sz * 0.7)
      ctx.lineTo(-sz * 1.1, sz * 0.5)
      ctx.closePath(); break
    }
    case 'A330': case 'A350': case 'A380': case 'B777': case 'B787': case 'B747': case 'B767': {
      ctx.moveTo(0, -sz * 1.4)
      ctx.lineTo(sz * 0.9, sz * 0.6)
      ctx.lineTo(sz * 0.4, sz * 0.7)
      ctx.lineTo(sz * 0.25, sz * 1.2)
      ctx.lineTo(-sz * 0.25, sz * 1.2)
      ctx.lineTo(-sz * 0.4, sz * 0.7)
      ctx.lineTo(-sz * 0.9, sz * 0.6)
      ctx.closePath(); break
    }
    case 'ERJ190': case 'ATR72': {
      ctx.moveTo(0, -sz * 1.1)
      ctx.lineTo(sz * 0.5, sz * 0.6)
      ctx.lineTo(0, sz * 0.3)
      ctx.lineTo(-sz * 0.5, sz * 0.6)
      ctx.closePath(); break
    }
    default: {
      ctx.moveTo(0, -sz * 1.25)
      ctx.lineTo(-sz * 0.65, sz * 0.75)
      ctx.lineTo(0, sz * 0.35)
      ctx.lineTo(sz * 0.65, sz * 0.75)
      ctx.closePath()
    }
  }
  ctx.fillStyle = selected ? '#ffffff' : color
  ctx.fill()
  if (selected) { ctx.strokeStyle = color; ctx.lineWidth = 0.8; ctx.stroke() }
  ctx.restore()
}

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  fleet:       LiveAC[]
  selectedAC:  string | null
  onSelectAC:  (id: string | null) => void
  altFilter:   number | null   // ft, or null for all
}

export default function RadarCanvas({ fleet, selectedAC, onSelectAC, altFilter }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const sweepRef    = useRef(0)
  const rafRef      = useRef(0)
  const fleetRef    = useRef<LiveAC[]>(fleet)
  const selRef      = useRef<string | null>(selectedAC)
  const altRef      = useRef<number | null>(altFilter)
  const lastTRef    = useRef(performance.now())
  const [rangeDeg, setRangeDeg] = useState(RANGE_DEFAULT)
  const rangeRef    = useRef(RANGE_DEFAULT)

  useEffect(() => { fleetRef.current = fleet }, [fleet])
  useEffect(() => { selRef.current   = selectedAC }, [selectedAC])
  useEffect(() => { altRef.current   = altFilter }, [altFilter])
  useEffect(() => { rangeRef.current = rangeDeg }, [rangeDeg])

  // Click → select aircraft
  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current; if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const mx = (e.clientX - rect.left) * scaleX
    const my = (e.clientY - rect.top)  * scaleY
    const W = canvas.width; const H = canvas.height
    const cx = W / 2; const cy = H / 2
    const R  = Math.min(cx, cy) - 20
    let best: LiveAC | null = null; let bestD = 14
    for (const ac of fleetRef.current) {
      if (!inScopeR(ac.lat, ac.lon, rangeRef.current)) continue
      const { x, y } = projectR(ac.lat, ac.lon, cx, cy, R, rangeRef.current)
      const d = Math.hypot(mx - x, my - y)
      if (d < bestD) { bestD = d; best = ac }
    }
    onSelectAC(best ? best.id : null)
  }

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return

    const cvs = canvas  // non-null alias for use inside closure

    function loop(now: number) {
      const dt = Math.min(now - lastTRef.current, 80)
      lastTRef.current = now
      sweepRef.current = (sweepRef.current + dt * 0.00038) % (Math.PI * 2) // ~3.6rpm

      const ctx = cvs.getContext('2d'); if (!ctx) { rafRef.current = requestAnimationFrame(loop); return }
      const W = cvs.width; const H = cvs.height
      const cx = W / 2; const cy = H / 2
      const R = Math.min(cx, cy) - 20
      const sweep = sweepRef.current

      // ── Background ──────────────────────────────────────────────────────────
      ctx.fillStyle = '#020c06'
      ctx.fillRect(0, 0, cvs.width, cvs.height)

      // ── Scope mask: darken outside circle ───────────────────────────────────
      ctx.save()
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip()

      // ── Concentric rings ─────────────────────────────────────────────────────
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath(); ctx.arc(cx, cy, R * (i / 4), 0, Math.PI * 2)
        ctx.strokeStyle = '#041a08'; ctx.lineWidth = 1; ctx.stroke()
      }
      // ── Cross-hairs ──────────────────────────────────────────────────────────
      ctx.beginPath()
      ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy)
      ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R)
      ctx.strokeStyle = '#041a08'; ctx.lineWidth = 0.5; ctx.stroke()
      // ── Azimuth ticks ────────────────────────────────────────────────────────
      for (let a = 0; a < 360; a += 30) {
        const rad = (a - 90) * Math.PI / 180
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(rad) * (R - 8), cy + Math.sin(rad) * (R - 8))
        ctx.lineTo(cx + Math.cos(rad) * R, cy + Math.sin(rad) * R)
        ctx.strokeStyle = '#0a3010'; ctx.lineWidth = 1; ctx.stroke()
        ctx.font = '7px "JetBrains Mono", monospace'
        ctx.fillStyle = '#0a3010'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(`${a}°`, cx + Math.cos(rad) * (R - 16), cy + Math.sin(rad) * (R - 16))
      }

      // ── Sweep glow ───────────────────────────────────────────────────────────
      // Back-glow arc (120° wide behind sweep arm)
      const GLOW_SPAN = Math.PI * 0.55
      // Draw as filled wedge with glow opacity gradient
      for (let g = 0; g < 32; g++) {
        const frac = g / 32
        const a0 = sweep - GLOW_SPAN * frac
        const a1 = sweep - GLOW_SPAN * (frac + 1 / 32)
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, R, a0, a1, true)
        ctx.closePath()
        ctx.fillStyle = `rgba(0,60,15,${(1 - frac) * 0.15})`
        ctx.fill()
      }
      // Bright sweep arm
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R)
      ctx.strokeStyle = '#00ff55'; ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.85; ctx.stroke(); ctx.globalAlpha = 1

      // ── Aircraft blips ────────────────────────────────────────────────────────
      const altFilt = altRef.current
      const selId   = selRef.current
      const nowMs   = Date.now()
      const range   = rangeRef.current

      for (const ac of fleetRef.current) {
        if (!inScopeR(ac.lat, ac.lon, range)) continue
        if (altFilt !== null && Math.abs(ac.altFt - altFilt) > 2200) continue

        const { x, y } = projectR(ac.lat, ac.lon, cx, cy, R, range)
        const col        = devColor(ac.devProb)
        const isSelected = ac.id === selId
        const isDeviated = ac.devProb >= 0.2

        // ── Trail (from ac.trail array) ────────────────────────────────────────
        if (ac.trail.length > 1) {
          for (let t = 0; t < Math.min(ac.trail.length, 6); t++) {
            const [tlat, tlon] = ac.trail[ac.trail.length - 1 - t]
            if (!inScopeR(tlat, tlon, range)) continue
            const tp = projectR(tlat, tlon, cx, cy, R, range)
            ctx.beginPath(); ctx.arc(tp.x, tp.y, 1.2, 0, Math.PI * 2)
            ctx.fillStyle = col; ctx.globalAlpha = (1 - t / 6) * 0.4
            ctx.fill(); ctx.globalAlpha = 1
          }
        }

        // ── Deviation circle ────────────────────────────────────────────────────
        if (isDeviated) {
          const blink = Math.sin(nowMs * 0.003) > 0
          if (blink || ac.devProb >= 0.65) {
            ctx.beginPath(); ctx.arc(x, y, isSelected ? 12 : 8, 0, Math.PI * 2)
            ctx.strokeStyle = col; ctx.lineWidth = isSelected ? 1.5 : 1
            ctx.globalAlpha = 0.7; ctx.stroke(); ctx.globalAlpha = 1
          }
        }

        // ── Aircraft icon ───────────────────────────────────────────────────────
        const sz = isSelected ? 6 : (ac.acType === 'A380' || ac.acType === 'B747') ? 5 : 4
        drawBlip(ctx, x, y, ac.heading, col, sz, isSelected, ac.acType)

        // ── Label ───────────────────────────────────────────────────────────────
        const showLabel = isSelected || ac.devProb >= 0.65
        if (showLabel) {
          ctx.font = `${isSelected ? '600' : '500'} 8px "JetBrains Mono", monospace`
          ctx.textAlign = 'left'; ctx.textBaseline = 'top'
          const fl  = `FL${Math.round(ac.altFt / 100).toString().padStart(3, '0')}`
          const line1 = `${ac.id} ${fl}`
          const line2 = ac.devProb >= 0.2 ? `${devLabel(ac.devProb)} ${(ac.devProb * 100).toFixed(0)}%` : `${ac.speedKts}kt`
          const tw = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width)
          // bg
          ctx.fillStyle = 'rgba(2,12,6,0.85)'
          ctx.fillRect(x + 9, y - 2, tw + 8, isDeviated ? 22 : 12)
          ctx.fillStyle = isSelected ? '#ffffff' : col
          ctx.fillText(line1, x + 12, y - 1)
          if (isDeviated) {
            ctx.fillStyle = col
            ctx.fillText(line2, x + 12, y + 9)
          }
        }

        // ── Warning icon (blinking ⚠ above aircraft) ───────────────────────────
        if (ac.devProb >= 0.4) {
          const blink = Math.sin(nowMs * (ac.devProb >= 0.65 ? 0.005 : 0.003)) > 0
          if (blink) {
            ctx.font = `bold ${ac.devProb >= 0.65 ? 10 : 8}px sans-serif`
            ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
            ctx.fillStyle = col; ctx.globalAlpha = 0.9
            ctx.fillText('⚠', x, y - 7)
            ctx.globalAlpha = 1
          }
        }
      }

      ctx.restore() // end scope clip

      // ── Scope rim ────────────────────────────────────────────────────────────
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.strokeStyle = '#0a4015'; ctx.lineWidth = 2; ctx.stroke()

      // ── Range rings legend ───────────────────────────────────────────────────
      ctx.font = '7px "JetBrains Mono", monospace'
      ctx.fillStyle = '#0a3510'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      for (let i = 1; i <= 4; i++) {
        const nm = Math.round((range / 4) * i * 60)
        ctx.fillText(`${nm}nm`, cx - 2, cy - R * (i / 4) + 2)
      }

      // ── Status bar ───────────────────────────────────────────────────────────
      const visible = fleetRef.current.filter(ac =>
        inScopeR(ac.lat, ac.lon, range) && (altFilt === null || Math.abs(ac.altFt - altFilt) <= 2200)
      )
      const deviating = visible.filter(ac => ac.devProb >= 0.2)
      ctx.font = '9px "JetBrains Mono", monospace'
      ctx.fillStyle = '#1a5520'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
      ctx.fillText(
        `TRK:${visible.length}  DEV:${deviating.length}  ` +
        (altFilt ? `FL${Math.round(altFilt / 100).toString().padStart(3,'0')} ±2000ft` : 'ALL ALT'),
        6, H - 4
      )
      ctx.fillStyle = '#0a3010'; ctx.textAlign = 'right'
      ctx.fillText(`CTR ${CENTER_LAT}°N ${CENTER_LON}°E  RNG ${Math.round(range * 60)}nm`, W - 6, H - 4)

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const btnStyle: React.CSSProperties = {
    width: 30, height: 30, background: 'rgba(2,12,6,0.9)',
    border: '1px solid #0a3010', borderRadius: 5, cursor: 'pointer',
    color: '#00e676', fontSize: 16, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    lineHeight: 1, userSelect: 'none',
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        width={600}
        height={600}
        onClick={handleClick}
        style={{
          width: '100%', height: '100%',
          objectFit: 'contain',
          cursor: 'crosshair',
          background: '#020c06',
          display: 'block',
        }}
      />
      {/* Zoom controls */}
      <div style={{
        position: 'absolute', bottom: 36, right: 14,
        display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10,
      }}>
        <button
          style={btnStyle}
          onClick={() => setRangeDeg(r => Math.max(RANGE_MIN, +(r * 0.65).toFixed(1)))}
          title="Zoom In"
        >+</button>
        <button
          style={{ ...btnStyle, fontSize: 11, color: '#0a5020' }}
          onClick={() => setRangeDeg(RANGE_DEFAULT)}
          title="Reset Zoom"
        >⊙</button>
        <button
          style={btnStyle}
          onClick={() => setRangeDeg(r => Math.min(RANGE_MAX, +(r / 0.65).toFixed(1)))}
          title="Zoom Out"
        >−</button>
      </div>
      {/* Range indicator */}
      <div style={{
        position: 'absolute', bottom: 36, left: 14, zIndex: 10,
        fontSize: 9, fontFamily: 'JetBrains Mono, monospace',
        color: '#1a5520', background: 'rgba(2,12,6,0.8)',
        padding: '3px 7px', borderRadius: 4, border: '1px solid #0a2808',
      }}>
        RNG {Math.round(rangeDeg * 60)} nm
      </div>
    </div>
  )
}

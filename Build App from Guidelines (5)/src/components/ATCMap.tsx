/**
 * ATCMap — Leaflet interactive airspace view.
 * Enhanced with:
 *   • Deviation colour scale: green/yellow/orange/red
 *   • Route overlay: blue dashed (planned), white (flown), risk-coloured (predicted), purple (alternate)
 *   • Deviation circles + blinking ⚠ on deviated aircraft
 *   • Altitude filter (show/fade aircraft by FL)
 *   • TCAS collision warning rings
 *   • Per-type aircraft icons
 *   • Double-click to zoom to aircraft
 *   • resetView / zoomToAC imperative handle
 */
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { AIRPORTS, WEATHER_CELLS, updateFleet } from '../data/liveFlights'
import type { LiveAC, AircraftType } from '../data/liveFlights'
import { devColor, deviationKm, confidence, deviationReason } from './RadarCanvas'

export interface MapHandle {
  resetView: () => void
  zoomToAC: (id: string) => void
}

interface Props {
  selectedAC:    string | null
  onSelectAC:    (id: string | null) => void
  showWeather:   boolean
  filterRisk:    string | null
  altFilter:     number | null   // ft, or null for all
  onFleetUpdate?: (fleet: LiveAC[]) => void
  initialFleet:  LiveAC[]
}

// ── Per-type icon ──────────────────────────────────────────────────────────────
function drawACIcon(
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

  const fill = selected ? '#ffffff' : color

  switch (acType) {
    case 'Helicopter': {
      ctx.beginPath(); ctx.arc(0, 0, sz * 1.1, 0, Math.PI * 2)
      ctx.fillStyle = fill; ctx.globalAlpha = 0.12; ctx.fill(); ctx.globalAlpha = 1
      ctx.strokeStyle = fill; ctx.lineWidth = 1.2; ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(-sz * 1.1, 0); ctx.lineTo(sz * 1.1, 0)
      ctx.moveTo(0, -sz * 1.1); ctx.lineTo(0, sz * 1.1)
      ctx.lineWidth = 0.9; ctx.stroke()
      ctx.beginPath(); ctx.arc(0, 0, sz * 0.3, 0, Math.PI * 2)
      ctx.fillStyle = fill; ctx.fill()
      ctx.restore(); return
    }
    case 'B747F': case 'B777F': {
      ctx.beginPath()
      ctx.moveTo(0, -sz * 1.5); ctx.lineTo(sz * 1.1, sz * 0.4); ctx.lineTo(sz * 0.5, sz * 0.6)
      ctx.lineTo(sz * 0.35, sz * 1.1); ctx.lineTo(-sz * 0.35, sz * 1.1)
      ctx.lineTo(-sz * 0.5, sz * 0.6); ctx.lineTo(-sz * 1.1, sz * 0.4); ctx.closePath(); break
    }
    case 'A330': case 'A350': case 'A380': case 'B767': case 'B777': case 'B787': case 'B747': {
      ctx.beginPath()
      ctx.moveTo(0, -sz * 1.4); ctx.lineTo(sz * 0.9, sz * 0.55); ctx.lineTo(sz * 0.4, sz * 0.65)
      ctx.lineTo(sz * 0.28, sz * 1.1); ctx.lineTo(-sz * 0.28, sz * 1.1)
      ctx.lineTo(-sz * 0.4, sz * 0.65); ctx.lineTo(-sz * 0.9, sz * 0.55); ctx.closePath(); break
    }
    case 'ERJ190': case 'ATR72': {
      ctx.beginPath()
      ctx.moveTo(0, -sz * 1.1); ctx.lineTo(sz * 0.5, sz * 0.6)
      ctx.lineTo(0, sz * 0.3); ctx.lineTo(-sz * 0.5, sz * 0.6); ctx.closePath(); break
    }
    case 'PrivateJet': {
      ctx.beginPath()
      ctx.moveTo(0, -sz * 1.5)
      ctx.lineTo(sz * 0.7, sz * 0.9)
      ctx.lineTo(sz * 0.2, sz * 0.55)
      ctx.lineTo(sz * 0.15, sz * 1.2)
      ctx.lineTo(-sz * 0.15, sz * 1.2)
      ctx.lineTo(-sz * 0.2, sz * 0.55)
      ctx.lineTo(-sz * 0.7, sz * 0.9)
      ctx.closePath()
      break
    }
    default: {
      ctx.beginPath()
      ctx.moveTo(0, -sz * 1.25); ctx.lineTo(-sz * 0.65, sz * 0.75)
      ctx.lineTo(0, sz * 0.35); ctx.lineTo(sz * 0.65, sz * 0.75); ctx.closePath()
    }
  }
  ctx.fillStyle = fill; ctx.fill()
  if (selected) { ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke() }
  ctx.restore()
}

// ── Collision detection ───────────────────────────────────────────────────────
function findCollisions(fleet: LiveAC[]): Set<string> {
  const warn = new Set<string>()
  for (let i = 0; i < fleet.length; i++) {
    for (let j = i + 1; j < fleet.length; j++) {
      const a = fleet[i]; const b = fleet[j]
      const dlat = a.lat - b.lat; const dlon = a.lon - b.lon
      if (Math.abs(dlat) > 0.6 || Math.abs(dlon) > 0.6) continue
      if (Math.sqrt(dlat * dlat + dlon * dlon) < 0.28 && Math.abs(a.altFt - b.altFt) < 1200) {
        warn.add(a.id); warn.add(b.id)
      }
    }
  }
  return warn
}

// ── Main component ────────────────────────────────────────────────────────────

const ATCMap = forwardRef<MapHandle, Props>(function ATCMap({
  selectedAC, onSelectAC,
  showWeather, filterRisk, altFilter,
  onFleetUpdate, initialFleet,
}, ref) {
  const containerRef    = useRef<HTMLDivElement>(null)
  const mapRef          = useRef<L.Map | null>(null)
  const canvasRef       = useRef<HTMLCanvasElement | null>(null)
  const acRef           = useRef<LiveAC[]>(initialFleet)
  const rafRef          = useRef<number>(0)
  const routeLayersRef  = useRef<L.Layer[]>([])
  const selectedRef     = useRef<string | null>(null)
  const showWxRef       = useRef(showWeather)
  const filterRef       = useRef(filterRisk)
  const altRef          = useRef<number | null>(altFilter)
  const collisionRef    = useRef<Set<string>>(new Set())
  const colTimerRef     = useRef(0)

  // Expose imperative handle
  useImperativeHandle(ref, () => ({
    resetView: () => {
      mapRef.current?.setView([28, 45], 4, { animate: true })
    },
    zoomToAC: (id: string) => {
      const ac = acRef.current.find(a => a.id === id)
      if (ac && mapRef.current) {
        mapRef.current.setView([ac.lat, ac.lon], Math.max(mapRef.current.getZoom() + 2, 8), { animate: true })
      }
    },
  }))

  useEffect(() => { selectedRef.current = selectedAC }, [selectedAC])
  useEffect(() => { showWxRef.current   = showWeather }, [showWeather])
  useEffect(() => { filterRef.current   = filterRisk }, [filterRisk])
  useEffect(() => { altRef.current      = altFilter }, [altFilter])

  // ── Map init (once) ─────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return

    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({ iconRetinaUrl: '', iconUrl: '', shadowUrl: '' })

    const map = L.map(container, {
      center: [28, 45], zoom: 4,
      zoomControl: false, attributionControl: true,
      minZoom: 2, maxZoom: 13,
      doubleClickZoom: false,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" style="color:#4a7090">OSM</a> &copy; <a href="https://carto.com/" style="color:#4a7090">CARTO</a>',
    }).addTo(map)

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    // Airport markers
    Object.entries(AIRPORTS).forEach(([code, ap]) => {
      const html = `<div style="position:relative;pointer-events:none">
        <div style="width:7px;height:7px;background:#00D4FF;border:1px solid rgba(255,255,255,0.3);border-radius:50%;margin:-3px 0 0 -3px;box-shadow:0 0 8px #00D4FF77"></div>
        <div style="position:absolute;top:8px;left:4px;color:#7aacc0;font-size:8px;font-family:'JetBrains Mono',monospace;white-space:nowrap;text-shadow:1px 1px 3px rgba(0,0,0,0.9)">${code}</div>
      </div>`
      L.marker([ap.lat, ap.lon], {
        icon: L.divIcon({ html, iconSize: [0, 0], className: '' }),
        interactive: false,
      }).addTo(map)
    })

    mapRef.current = map

    // ── Waypoints ─────────────────────────────────────────────────────────────
    const WAYPOINTS: Array<{ id: string; lat: number; lon: number }> = [
      { id:'DUBAI1', lat:25.0, lon:55.5 }, { id:'GMRES', lat:27.5, lon:49.0 },
      { id:'RASMO', lat:32.0, lon:44.0 }, { id:'TOBAK', lat:36.0, lon:28.0 },
      { id:'LAMDA', lat:38.5, lon:22.0 }, { id:'RODIK', lat:42.0, lon:14.5 },
      { id:'ERAKA', lat:49.0, lon:8.0  }, { id:'LONED', lat:51.0, lon:2.0  },
      { id:'NOPKI', lat:23.0, lon:72.0 }, { id:'SAMAS', lat:15.0, lon:45.0 },
      { id:'KIRAN', lat:5.0,  lon:100.0},{ id:'AKAGI', lat:30.0, lon:135.0 },
      { id:'TIGER', lat:38.0, lon:123.0},{ id:'MOSEL', lat:22.0, lon:88.0  },
    ]
    WAYPOINTS.forEach(wp => {
      const html = `<div style="position:relative;pointer-events:none">
        <div style="width:5px;height:5px;background:transparent;border:1.5px solid #4488FF;transform:rotate(45deg);margin:-2px 0 0 -2px"></div>
        <div style="position:absolute;top:6px;left:4px;color:#3a6888;font-size:7px;font-family:'JetBrains Mono',monospace;white-space:nowrap">${wp.id}</div>
      </div>`
      L.marker([wp.lat, wp.lon], {
        icon: L.divIcon({ html, iconSize: [0, 0], className: '' }),
        interactive: false,
      }).addTo(map)
    })

    // ── Restricted airspace polygons ──────────────────────────────────────────
    const RESTRICTED: Array<{ id: string; coords: [number, number][]; color: string; label: string }> = [
      { id:'R-UAE1', label:'UAE R/A', color:'#FF3D57',
        coords:[[24.5,54.0],[25.5,54.0],[25.5,56.5],[24.5,56.5]] },
      { id:'R-IST1', label:'IST TMA', color:'#ffab00',
        coords:[[40.2,28.0],[41.5,28.0],[41.5,30.0],[40.2,30.0]] },
      { id:'R-JFK1', label:'JFK TMA', color:'#ffab00',
        coords:[[40.0,-74.5],[41.2,-74.5],[41.2,-72.5],[40.0,-72.5]] },
      { id:'R-SIN1', label:'SIN TRA', color:'#FF3D57',
        coords:[[1.0,103.5],[2.0,103.5],[2.0,104.5],[1.0,104.5]] },
      { id:'R-DEL1', label:'DEL R/A', color:'#FF3D57',
        coords:[[28.0,76.5],[29.0,76.5],[29.0,78.0],[28.0,78.0]] },
    ]
    RESTRICTED.forEach(ra => {
      L.polygon(ra.coords as [number, number][], {
        color: ra.color, weight: 1, fillColor: ra.color,
        fillOpacity: 0.06, dashArray: '4,3', interactive: false,
      }).addTo(map)
      const midLat = (Math.min(...ra.coords.map(c => c[0])) + Math.max(...ra.coords.map(c => c[0]))) / 2
      const midLon = (Math.min(...ra.coords.map(c => c[1])) + Math.max(...ra.coords.map(c => c[1]))) / 2
      L.marker([midLat, midLon], {
        icon: L.divIcon({
          html: `<div style="color:${ra.color};font-size:7px;font-family:'JetBrains Mono',monospace;white-space:nowrap;opacity:0.7">${ra.label}</div>`,
          iconSize: [0, 0], className: '',
        }), interactive: false,
      }).addTo(map)
    })

    const canvas = document.createElement('canvas')
    const { x: cw, y: ch } = map.getSize()
    canvas.width = cw; canvas.height = ch
    canvas.style.cssText = 'position:absolute;top:0;left:0;z-index:600;pointer-events:none'
    container.appendChild(canvas)
    canvasRef.current = canvas

    map.on('resize', () => {
      const { x: nx, y: ny } = map.getSize()
      canvas.width = nx; canvas.height = ny
    })

    // Single click → select aircraft
    map.on('click', (e) => {
      const cp = map.latLngToContainerPoint(e.latlng)
      let best: LiveAC | null = null; let bestD = 16
      for (const ac of acRef.current) {
        const pt = map.latLngToContainerPoint([ac.lat, ac.lon])
        const d  = Math.hypot(cp.x - pt.x, cp.y - pt.y)
        if (d < bestD) { bestD = d; best = ac }
      }
      onSelectAC(best ? best.id : null)
    })

    // Double-click → zoom to aircraft, or zoom-in if no aircraft nearby
    map.on('dblclick', (e) => {
      const cp = map.latLngToContainerPoint(e.latlng)
      let best: LiveAC | null = null; let bestD = 28
      for (const ac of acRef.current) {
        const pt = map.latLngToContainerPoint([ac.lat, ac.lon])
        const d  = Math.hypot(cp.x - pt.x, cp.y - pt.y)
        if (d < bestD) { bestD = d; best = ac }
      }
      if (best) {
        onSelectAC(best.id)
        map.setView([best.lat, best.lon], Math.max(map.getZoom() + 2, 8), { animate: true })
      } else {
        map.setView(e.latlng, map.getZoom() + 1, { animate: true })
      }
    })

    // ── Animation loop ──────────────────────────────────────────────────────
    let lastT = performance.now()

    function loop(time: number) {
      const dt = Math.min(time - lastT, 100); lastT = time

      acRef.current = updateFleet(acRef.current, dt)

      colTimerRef.current += dt
      if (colTimerRef.current > 3000) {
        collisionRef.current = findCollisions(acRef.current)
        colTimerRef.current  = 0
      }

      if (onFleetUpdate) onFleetUpdate(acRef.current)

      const ctx = canvas.getContext('2d')
      const m   = mapRef.current
      if (!ctx || !m) { rafRef.current = requestAnimationFrame(loop); return }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const selId     = selectedRef.current
      const filt      = filterRef.current
      const showWx    = showWxRef.current
      const altFilt   = altRef.current
      const now       = Date.now()
      const collides  = collisionRef.current
      const zoom      = m.getZoom()

      // ── Weather cells ──────────────────────────────────────────────────────
      if (showWx) {
        WEATHER_CELLS.forEach(cell => {
          const pt  = m.latLngToContainerPoint([cell.lat, cell.lon])
          const rpt = m.latLngToContainerPoint([cell.lat, cell.lon + cell.radiusKm / 111])
          const rpx = Math.abs(rpt.x - pt.x)
          const WCOLS: Record<string, string> = { storm: '#FF3D57', rain: '#4488FF', fog: '#AAAAAA' }
          const col   = WCOLS[cell.type] ?? '#888'
          const pulse = (Math.sin(now * 0.0008 + cell.lat) + 1) * 0.5
          const aHex  = Math.round(cell.intensity * (0.15 + pulse * 0.07) * 255).toString(16).padStart(2, '0')
          const aFade = Math.round(parseInt(aHex, 16) * 0.4).toString(16).padStart(2, '0')
          const grad  = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, rpx)
          grad.addColorStop(0, `${col}${aHex}`); grad.addColorStop(0.6, `${col}${aFade}`); grad.addColorStop(1, `${col}00`)
          ctx.beginPath(); ctx.arc(pt.x, pt.y, rpx, 0, Math.PI * 2)
          ctx.fillStyle = grad; ctx.fill()
          ctx.setLineDash([4, 4]); ctx.strokeStyle = `${col}44`; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([])
          if (zoom >= 5) {
            ctx.font = '500 8px Inter, sans-serif'; ctx.fillStyle = `${col}cc`; ctx.textAlign = 'center'
            ctx.fillText(cell.type.toUpperCase(), pt.x, pt.y - rpx * 0.7)
          }
        })
      }

      // ── Aircraft ───────────────────────────────────────────────────────────
      for (const ac of acRef.current) {
        if (filt && ac.riskLevel !== filt) continue

        const pt = m.latLngToContainerPoint([ac.lat, ac.lon])
        const { x: ax, y: ay } = pt
        if (ax < -30 || ay < -30 || ax > canvas.width + 30 || ay > canvas.height + 30) continue

        let alpha = 1
        if (altFilt !== null) {
          const diff = Math.abs(ac.altFt - altFilt)
          if (diff > 2200) alpha = 0.06
          else alpha = Math.max(0.15, 1 - diff / 2200 * 0.85)
        }
        ctx.globalAlpha = alpha

        const color      = devColor(ac.devProb)
        const isSelected = ac.id === selId
        const isDeviated = ac.devProb >= 0.2
        const isCritical = ac.devProb >= 0.65
        const inConflict = collides.has(ac.id)
        const sz = isSelected ? 7 : (ac.acType === 'A380' || ac.acType === 'B747') ? 6 :
                   (ac.acType === 'B777' || ac.acType === 'A330') ? 5.5 : ac.isCargo ? 5 : 4

        // Trail
        if (ac.trail.length > 1) {
          ctx.beginPath(); let first = true
          for (const [tlat, tlon] of ac.trail) {
            const tp = m.latLngToContainerPoint([tlat, tlon])
            if (first) { ctx.moveTo(tp.x, tp.y); first = false } else ctx.lineTo(tp.x, tp.y)
          }
          ctx.lineTo(ax, ay)
          ctx.strokeStyle = color; ctx.lineWidth = 0.8; ctx.globalAlpha = alpha * 0.28; ctx.stroke()
          ctx.globalAlpha = alpha
        }

        // ── Deviation circle (all deviated aircraft) ──────────────────────────
        if (isDeviated && !isSelected) {
          const blink = isCritical ? Math.sin(now * 0.004) > 0 : Math.sin(now * 0.002) > 0
          if (blink || !isCritical) {
            ctx.beginPath(); ctx.arc(ax, ay, isCritical ? 11 : 9, 0, Math.PI * 2)
            ctx.strokeStyle = color; ctx.lineWidth = isCritical ? 1.8 : 1.2
            ctx.globalAlpha = alpha * (isCritical ? 0.85 : 0.6); ctx.stroke()
            ctx.globalAlpha = alpha
          }
        }

        // Collision warning ring
        if (inConflict) {
          const cp = (Math.sin(now * 0.005) + 1) * 0.5
          ctx.beginPath(); ctx.arc(ax, ay, 18 + cp * 6, 0, Math.PI * 2)
          ctx.strokeStyle = '#FF3D57'; ctx.lineWidth = 2
          ctx.globalAlpha = alpha * (0.9 - cp * 0.5); ctx.setLineDash([4, 3]); ctx.stroke()
          ctx.setLineDash([]); ctx.globalAlpha = alpha
        }

        // Selection rings
        if (isSelected) {
          ctx.globalAlpha = 0.55
          ctx.beginPath(); ctx.arc(ax, ay, 16, 0, Math.PI * 2)
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke()
          ctx.setLineDash([3, 3]); ctx.globalAlpha = 0.35
          ctx.beginPath(); ctx.arc(ax, ay, 22, 0, Math.PI * 2)
          ctx.strokeStyle = color; ctx.lineWidth = 0.8; ctx.stroke()
          ctx.setLineDash([]); ctx.globalAlpha = alpha
        }

        drawACIcon(ctx, ax, ay, ac.heading, color, sz, isSelected, ac.acType)
        ctx.globalAlpha = alpha

        // ── Labels ─────────────────────────────────────────────────────────────
        const showLabel = isSelected || (isCritical && zoom >= 5) || (inConflict && zoom >= 5) || (isDeviated && zoom >= 7)
        if (showLabel) {
          const fl    = `FL${Math.round(ac.altFt / 100).toString().padStart(3, '0')}`
          const km    = deviationKm(ac.devProb)
          const conf  = confidence(ac.devProb)
          const reason = deviationReason(ac)
          // Line 1: callsign + FL
          const line1 = `${ac.id}  ${fl}`
          // Line 2: deviation stats (distance + percentage)
          const line2 = isDeviated ? `${(ac.devProb * 100).toFixed(0)}%  ${km}km off-route` : `${ac.speedKts}kt`
          // Line 3 (selected deviated only): confidence + reason
          const line3 = (isSelected && isDeviated) ? `CONF:${conf}%  ${reason}` : ''

          ctx.font = `600 9px "JetBrains Mono", monospace`; ctx.textAlign = 'left'
          const lw   = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width, ctx.measureText(line3).width)
          const rows = line3 ? 3 : isDeviated ? 2 : 1
          ctx.fillStyle = 'rgba(4,9,16,0.88)'
          ctx.fillRect(ax + 10, ay - 9, lw + 10, rows * 12 + 3)
          // Callsign line
          ctx.fillStyle = isSelected ? '#ffffff' : color
          ctx.font = `600 9px "JetBrains Mono", monospace`
          ctx.fillText(line1, ax + 13, ay + 1)
          // Deviation line
          if (isDeviated) {
            ctx.font = '9px "JetBrains Mono", monospace'
            ctx.fillStyle = color
            ctx.fillText(line2, ax + 13, ay + 12)
          }
          // Confidence + reason line
          if (line3) {
            ctx.font = '8px "JetBrains Mono", monospace'
            ctx.fillStyle = '#7aacc0'
            ctx.fillText(line3, ax + 13, ay + 23)
          }
          // Speed + route for selected non-deviated
          if (isSelected && !isDeviated) {
            const sub = `${ac.speedKts}kt  ${ac.depCode}→${ac.arrCode}`
            ctx.font = '9px "JetBrains Mono", monospace'
            ctx.fillStyle = 'rgba(4,9,16,0.78)'; ctx.fillRect(ax + 10, ay + 4, ctx.measureText(sub).width + 6, 11)
            ctx.fillStyle = '#7aacc0'; ctx.fillText(sub, ax + 13, ay + 13)
          }
        }

        // ── Blinking ⚠ warning icon ────────────────────────────────────────────
        if (ac.devProb >= 0.4) {
          const blink = Math.sin(now * (isCritical ? 0.005 : 0.003)) > 0
          if (blink) {
            ctx.font = `bold ${isCritical ? 10 : 8}px sans-serif`
            ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
            ctx.fillStyle = color; ctx.globalAlpha = alpha * 0.9
            ctx.fillText('⚠', ax, ay - (isDeviated ? 10 : 8))
            ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = alpha
          }
        }

        // TCAS label
        if (inConflict && !isSelected) {
          ctx.font = '700 8px "JetBrains Mono", monospace'
          ctx.fillStyle = 'rgba(4,9,16,0.85)'; ctx.fillRect(ax + 10, ay + 4, 36, 10)
          ctx.fillStyle = '#FF3D57'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
          ctx.fillText('⚠ TCAS', ax + 12, ay + 12)
        }

        ctx.globalAlpha = 1
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Route overlay for selected aircraft ───────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    routeLayersRef.current.forEach(l => { try { map.removeLayer(l) } catch (_) {} })
    routeLayersRef.current = []
    if (!selectedAC) return
    const ac = acRef.current.find(a => a.id === selectedAC)
    if (!ac) return

    const rCol = devColor(ac.devProb)

    // Planned route — dashed BLUE
    const planned = L.polyline([[ac.depLat, ac.depLon], [ac.arrLat, ac.arrLon]], {
      color: '#4488FF', weight: 1.5, dashArray: '7,5', opacity: 0.55, interactive: false,
    }).addTo(map)

    // Flown route — WHITE solid
    const actual  = L.polyline([[ac.depLat, ac.depLon], [ac.lat, ac.lon]], {
      color: '#ffffff', weight: 2, opacity: 0.75, interactive: false,
    }).addTo(map)

    // Deviated section — thick risk-coloured solid (from midpoint to current if deviated)
    let devLayer: L.Polyline | null = null
    if (ac.devProb >= 0.2) {
      const midLat = (ac.depLat + ac.lat) / 2
      const midLon = (ac.depLon + ac.lon) / 2
      devLayer = L.polyline([[midLat, midLon], [ac.lat, ac.lon]], {
        color: rCol, weight: 3.5, opacity: 0.85, interactive: false,
      }).addTo(map)
    }

    // Predicted path — risk-coloured dashed
    const pred  = L.polyline([[ac.lat, ac.lon], [ac.arrLat, ac.arrLon]], {
      color: rCol, weight: 1.5, dashArray: '4,4', opacity: 0.7, interactive: false,
    }).addTo(map)

    // Alternate route — purple dotted
    const midLat = (ac.lat + ac.arrLat) / 2 + 2.0
    const midLon = (ac.lon + ac.arrLon) / 2 + 2.0
    const alt    = L.polyline([[ac.lat, ac.lon], [midLat, midLon], [ac.arrLat, ac.arrLon]], {
      color: '#bf7fff', weight: 1, dashArray: '2,5', opacity: 0.4, interactive: false,
    }).addTo(map)

    const mk = (lat: number, lon: number, col: string, lbl: string) =>
      L.marker([lat, lon], {
        icon: L.divIcon({
          html: `<div style="width:9px;height:9px;background:#060b14;border:2px solid ${col};border-radius:50%;margin:-4px 0 0 -4px"></div>
                 <div style="position:absolute;top:6px;left:6px;color:${col};font-size:8px;font-family:'JetBrains Mono',monospace;white-space:nowrap">${lbl}</div>`,
          iconSize: [0, 0], className: '',
        }), interactive: false,
      }).addTo(map)

    const dm = mk(ac.depLat, ac.depLon, '#4488FF', ac.depCode)
    const am = mk(ac.arrLat, ac.arrLon, rCol, ac.arrCode)

    routeLayersRef.current = [planned, actual, pred, alt, dm, am, ...(devLayer ? [devLayer] : [])]
    map.panTo([ac.lat, ac.lon], { animate: true, duration: 0.5 })
  }, [selectedAC])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#060b14', position: 'relative' }} />
  )
})

export default ATCMap

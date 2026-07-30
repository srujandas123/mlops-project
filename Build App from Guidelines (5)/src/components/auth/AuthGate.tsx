import { useState, useEffect, useRef } from 'react'

export interface AuthUser {
  username: string
  name: string
  email: string
  role: string
  token: string
}

interface Props {
  onAuth: (user: AuthUser) => void
}

// ── Animated radar SVG ────────────────────────────────────────────────────────
function RadarViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef  = useRef<number>(0)
  const angleRef  = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    const obs = new ResizeObserver(resize)
    obs.observe(canvas)

    const draw = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const W = canvas.width, H = canvas.height
      const cx = W / 2, cy = H / 2
      const R = Math.min(W, H) * 0.42

      ctx.clearRect(0, 0, W, H)

      // rings
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath()
        ctx.arc(cx, cy, R * i / 4, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(0,180,220,${0.06 + i * 0.02})`
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // cross-hairs
      ctx.strokeStyle = 'rgba(0,180,220,0.08)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke()

      // sweep gradient
      const sweep = angleRef.current
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(sweep)
      const sg = ctx.createLinearGradient(0, 0, R, 0)
      sg.addColorStop(0,   'rgba(0,212,255,0.28)')
      sg.addColorStop(0.7, 'rgba(0,212,255,0.04)')
      sg.addColorStop(1,   'rgba(0,212,255,0)')
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, R, -0.45, 0.45)
      ctx.closePath()
      ctx.fillStyle = sg
      ctx.fill()
      // sweep line
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R, 0)
      ctx.strokeStyle = 'rgba(0,212,255,0.6)'; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.restore()

      // blips — fixed positions
      const blips = [
        { a: 1.1,  r: 0.55, col: '#ff3d57', sz: 3.5 },
        { a: 2.4,  r: 0.38, col: '#ff3d57', sz: 2.5 },
        { a: 0.6,  r: 0.72, col: '#ffab00', sz: 2.5 },
        { a: 3.9,  r: 0.61, col: '#00e676', sz: 2   },
        { a: 5.1,  r: 0.44, col: '#00e676', sz: 2   },
        { a: 4.4,  r: 0.80, col: '#00e676', sz: 2   },
        { a: 2.9,  r: 0.50, col: '#ffab00', sz: 2.5 },
        { a: 1.7,  r: 0.85, col: '#00e676', sz: 2   },
        { a: 0.2,  r: 0.31, col: '#ff3d57', sz: 3   },
        { a: 3.2,  r: 0.70, col: '#00e676', sz: 2   },
      ]

      blips.forEach(b => {
        const bx = cx + Math.cos(b.a) * R * b.r
        const by = cy + Math.sin(b.a) * R * b.r
        const diff = ((b.a - sweep) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
        const glow = diff < 0.6 ? 1 - diff / 0.6 : 0
        const alpha = 0.5 + glow * 0.5
        ctx.beginPath()
        ctx.arc(bx, by, b.sz + glow * 1.5, 0, Math.PI * 2)
        ctx.fillStyle = b.col.replace(')', `,${alpha})`)
          .replace('#ff3d57', `rgba(255,61,87,${alpha})`)
          .replace('#ffab00', `rgba(255,171,0,${alpha})`)
          .replace('#00e676', `rgba(0,230,118,${alpha})`)
        ctx.fill()
        if (glow > 0.1) {
          ctx.beginPath()
          ctx.arc(bx, by, b.sz * 2.5, 0, Math.PI * 2)
          ctx.strokeStyle = b.col.includes('3d57')
            ? `rgba(255,61,87,${glow * 0.3})`
            : b.col.includes('ab00')
            ? `rgba(255,171,0,${glow * 0.3})`
            : `rgba(0,230,118,${glow * 0.3})`
          ctx.lineWidth = 1; ctx.stroke()
        }
      })

      angleRef.current = (sweep + 0.008) % (Math.PI * 2)
      frameRef.current = requestAnimationFrame(draw)
    }

    frameRef.current = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(frameRef.current); obs.disconnect() }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}

// ── Form field ────────────────────────────────────────────────────────────────
function Field({
  label, value, onChange, type = 'text', placeholder, error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  error?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5a8aaa', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          background: '#040c18',
          border: `1px solid ${error ? '#ff3d57' : focused ? '#00D4FF' : '#1a2d44'}`,
          borderRadius: 4,
          padding: '9px 12px',
          color: '#e2e8f0',
          fontSize: 13,
          fontFamily: 'Inter, system-ui, sans-serif',
          outline: 'none',
          transition: 'border-color 0.15s',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
      {error && (
        <span style={{ fontSize: 10, color: '#ff3d57', fontFamily: 'JetBrains Mono, monospace' }}>
          ⚠ {error}
        </span>
      )}
    </div>
  )
}

// ── Main AuthGate ─────────────────────────────────────────────────────────────
export default function AuthGate({ onAuth }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')

  // Login state
  const [loginUsername, setLoginUsername]     = useState('')
  const [loginPassword, setLoginPassword]     = useState('')
  const [loginError, setLoginError]           = useState('')
  const [loginLoading, setLoginLoading]       = useState(false)

  // Register state
  const [regName, setRegName]                 = useState('')
  const [regEmail, setRegEmail]               = useState('')
  const [regUsername, setRegUsername]         = useState('')
  const [regPassword, setRegPassword]         = useState('')
  const [regConfirm, setRegConfirm]           = useState('')
  const [regRole, setRegRole]                 = useState<'operator' | 'viewer'>('operator')
  const [regErrors, setRegErrors]             = useState<Record<string, string>>({})
  const [regLoading, setRegLoading]           = useState(false)
  const [regSuccess, setRegSuccess]           = useState(false)

  // UTC clock
  const [utc, setUtc] = useState('')
  useEffect(() => {
    const t = setInterval(() => setUtc(new Date().toUTCString().slice(5, 25) + ' UTC'), 1000)
    setUtc(new Date().toUTCString().slice(5, 25) + ' UTC')
    return () => clearInterval(t)
  }, [])

  // ── Demo login (offline) — always available ─────────────────────────────────
  function demoLogin(role: 'admin' | 'operator' | 'viewer') {
    const names: Record<string, string> = { admin: 'Admin User', operator: 'ATC Operator', viewer: 'Observer' }
    const user: AuthUser = {
      username: role,
      name: names[role],
      email: `${role}@airways.atc`,
      role,
      token: `demo-${role}-${Date.now()}`,
    }
    localStorage.setItem('atc_auth', JSON.stringify(user))
    onAuth(user)
  }

  // ── Login submit ─────────────────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!loginUsername.trim()) return setLoginError('Username is required')
    if (!loginPassword)        return setLoginError('Password is required')
    setLoginError('')
    setLoginLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername.trim(), password: loginPassword }),
      })
      if (res.ok) {
        const data = await res.json()
        const user: AuthUser = {
          username: data.username,
          name: data.name || data.username,
          email: data.email || '',
          role: data.role,
          token: data.token,
        }
        localStorage.setItem('atc_auth', JSON.stringify(user))
        onAuth(user)
      } else {
        const data = await res.json().catch(() => ({}))
        setLoginError(data.detail || 'Invalid credentials')
      }
    } catch {
      // backend offline — try demo login
      if (loginUsername === 'admin' && loginPassword === 'admin123') {
        demoLogin('admin')
      } else if (loginUsername === 'operator' && loginPassword === 'atc2024') {
        demoLogin('operator')
      } else {
        setLoginError('Backend offline. Use admin/admin123 or operator/atc2024')
      }
    } finally {
      setLoginLoading(false)
    }
  }

  // ── Register submit ──────────────────────────────────────────────────────────
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!regName.trim())     errs.name     = 'Full name is required'
    if (!regEmail.includes('@')) errs.email = 'Valid email required'
    if (regUsername.length < 3)  errs.username = 'Min 3 characters'
    if (regPassword.length < 6)  errs.password = 'Min 6 characters'
    if (regPassword !== regConfirm) errs.confirm = 'Passwords do not match'
    setRegErrors(errs)
    if (Object.keys(errs).length) return

    setRegLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          email: regEmail.trim(),
          username: regUsername.trim(),
          password: regPassword,
          role: regRole,
        }),
      })
      if (res.ok) {
        setRegSuccess(true)
        setTimeout(() => { setMode('login'); setRegSuccess(false) }, 2000)
      } else {
        const data = await res.json().catch(() => ({}))
        setRegErrors({ username: data.detail || 'Registration failed' })
      }
    } catch {
      setRegErrors({ username: 'Backend offline. Registration requires the server.' })
    } finally {
      setRegLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      background: '#040910',
      overflow: 'hidden',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>

      {/* ── Left panel — radar visualization ──────────────────────────────── */}
      <div style={{
        flex: 1,
        position: 'relative',
        background: 'linear-gradient(160deg, #040d1a 0%, #060b14 60%, #030810 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRight: '1px solid #0e1e2e',
        overflow: 'hidden',
      }}>
        {/* radar canvas */}
        <div style={{ width: '80%', maxWidth: 420, aspectRatio: '1', position: 'relative' }}>
          <RadarViz />
          {/* center dot */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            width: 8, height: 8, borderRadius: '50%',
            background: '#00D4FF',
            boxShadow: '0 0 12px #00D4FF',
          }} />
        </div>

        {/* branding below radar */}
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.35em', color: '#00D4FF', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, opacity: 0.8 }}>
            AIRWAYS
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.06em', color: '#e2e8f0', marginTop: 4 }}>
            ATC OPERATIONS
          </div>
          <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#3a5870', marginTop: 6, fontFamily: 'JetBrains Mono, monospace' }}>
            CONTROL CENTER v2.0
          </div>
        </div>

        {/* status strip */}
        <div style={{
          position: 'absolute', bottom: 20, left: 0, right: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
          padding: '0 24px',
        }}>
          {[
            { col: '#ff3d57', label: 'CRITICAL', val: '3' },
            { col: '#ffab00', label: 'HIGH',     val: '8' },
            { col: '#00e676', label: 'ACTIVE',   val: '60' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.col, boxShadow: `0 0 6px ${s.col}` }} />
              <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#3a5870' }}>{s.label}:</span>
              <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: s.col, fontWeight: 700 }}>{s.val}</span>
            </div>
          ))}
        </div>

        {/* UTC clock */}
        <div style={{ position: 'absolute', top: 16, right: 20, fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#2a4860' }}>
          {utc}
        </div>
      </div>

      {/* ── Right panel — form ─────────────────────────────────────────────── */}
      <div style={{
        width: 420,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 40px',
        background: '#050d18',
        overflowY: 'auto',
      }}>

        {/* header */}
        <div style={{ width: '100%', marginBottom: 28, textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 48, height: 48, borderRadius: 12,
            background: 'linear-gradient(135deg, #00a8d6 0%, #004880 100%)',
            fontSize: 22, marginBottom: 14,
            boxShadow: '0 4px 20px rgba(0,212,255,0.2)',
          }}>✈</div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.04em', color: '#e2e8f0' }}>
            {mode === 'login' ? 'Operator Login' : 'Register Account'}
          </div>
          <div style={{ fontSize: 11, color: '#3a5870', marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>
            {mode === 'login' ? 'Access ATC Operations Center' : 'Create New Operator Account'}
          </div>
        </div>

        {/* mode tabs */}
        <div style={{
          display: 'flex', width: '100%', marginBottom: 24,
          background: '#040c18', border: '1px solid #0e1e2e', borderRadius: 6, padding: 3, gap: 3,
        }}>
          {(['login', 'register'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '7px 0',
              background: mode === m ? '#0a1628' : 'transparent',
              border: mode === m ? '1px solid #1a3050' : '1px solid transparent',
              borderRadius: 4,
              color: mode === m ? '#00D4FF' : '#3a5870',
              fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace',
              transition: 'all 0.15s',
            }}>
              {m}
            </button>
          ))}
        </div>

        {/* ── Login form ──────────────────────────────────────────────────── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Username" value={loginUsername} onChange={setLoginUsername} placeholder="Enter username" />
            <Field label="Password" value={loginPassword} onChange={setLoginPassword} type="password" placeholder="Enter password" />

            {loginError && (
              <div style={{ padding: '8px 12px', background: '#ff3d5712', border: '1px solid #ff3d5740', borderRadius: 4, fontSize: 11, color: '#ff3d57', fontFamily: 'JetBrains Mono, monospace' }}>
                ⚠ {loginError}
              </div>
            )}

            <button type="submit" disabled={loginLoading} style={{
              marginTop: 4, padding: '11px 0',
              background: loginLoading ? '#0a1628' : 'linear-gradient(90deg, #0070a8, #00a8d6)',
              border: '1px solid #00D4FF44',
              borderRadius: 5, color: '#fff', fontSize: 12, fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              cursor: loginLoading ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.15s', opacity: loginLoading ? 0.6 : 1,
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {loginLoading ? 'AUTHENTICATING...' : 'LOGIN →'}
            </button>

            {/* demo access */}
            <div style={{ borderTop: '1px solid #0e1e2e', paddingTop: 14 }}>
              <div style={{ fontSize: 9.5, color: '#2a4860', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace', marginBottom: 8, textAlign: 'center' }}>
                Quick Demo Access
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['admin', 'operator', 'viewer'] as const).map(r => (
                  <button key={r} type="button" onClick={() => demoLogin(r)} style={{
                    flex: 1, padding: '6px 0',
                    background: 'transparent', border: '1px solid #1a3050', borderRadius: 4,
                    color: '#4a7090', fontSize: 9.5, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace',
                    letterSpacing: '0.05em', textTransform: 'uppercase',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { (e.target as HTMLButtonElement).style.borderColor = '#00D4FF44'; (e.target as HTMLButtonElement).style.color = '#00D4FF' }}
                  onMouseLeave={e => { (e.target as HTMLButtonElement).style.borderColor = '#1a3050'; (e.target as HTMLButtonElement).style.color = '#4a7090' }}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 9, color: '#1a3050', marginTop: 6, textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }}>
                admin/admin123 · operator/atc2024
              </div>
            </div>
          </form>
        )}

        {/* ── Register form ────────────────────────────────────────────────── */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {regSuccess && (
              <div style={{ padding: '10px 14px', background: '#00e67614', border: '1px solid #00e67640', borderRadius: 4, fontSize: 11, color: '#00e676', fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }}>
                ✓ Account created! Redirecting to login…
              </div>
            )}

            <Field label="Full Name" value={regName} onChange={setRegName} placeholder="e.g. John Smith" error={regErrors.name} />
            <Field label="Email Address" value={regEmail} onChange={setRegEmail} type="email" placeholder="user@airways.atc" error={regErrors.email} />
            <Field label="Username" value={regUsername} onChange={setRegUsername} placeholder="Min 3 characters" error={regErrors.username} />
            <Field label="Password" value={regPassword} onChange={setRegPassword} type="password" placeholder="Min 6 characters" error={regErrors.password} />
            <Field label="Confirm Password" value={regConfirm} onChange={setRegConfirm} type="password" placeholder="Repeat password" error={regErrors.confirm} />

            {/* role selector */}
            <div>
              <label style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5a8aaa', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Role
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['operator', 'viewer'] as const).map(r => (
                  <button key={r} type="button" onClick={() => setRegRole(r)} style={{
                    flex: 1, padding: '8px 0',
                    background: regRole === r ? '#0a1628' : '#040c18',
                    border: `1px solid ${regRole === r ? '#00D4FF44' : '#1a2d44'}`,
                    borderRadius: 4,
                    color: regRole === r ? '#00D4FF' : '#4a7090',
                    fontSize: 10.5, cursor: 'pointer',
                    fontFamily: 'JetBrains Mono, monospace',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    transition: 'all 0.15s',
                  }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={regLoading} style={{
              marginTop: 4, padding: '11px 0',
              background: regLoading ? '#0a1628' : 'linear-gradient(90deg, #005080, #00a8d6)',
              border: '1px solid #00D4FF44',
              borderRadius: 5, color: '#fff', fontSize: 12, fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              cursor: regLoading ? 'not-allowed' : 'pointer',
              opacity: regLoading ? 0.6 : 1,
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {regLoading ? 'REGISTERING...' : 'CREATE ACCOUNT →'}
            </button>
          </form>
        )}

        {/* footer */}
        <div style={{ marginTop: 24, fontSize: 9, color: '#1a3050', fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }}>
          AIRWAYS ATC OPERATIONS CENTER · SECURE ACCESS SYSTEM
        </div>
      </div>
    </div>
  )
}

// ─── Live Aircraft Simulation — 300+ flights worldwide ──────────────────────

export type AircraftType =
  | 'A320' | 'A321' | 'A330' | 'A350' | 'A380'
  | 'B737' | 'B767' | 'B777' | 'B787' | 'B747'
  | 'B747F' | 'B777F' | 'ERJ190' | 'ATR72'
  | 'Helicopter' | 'PrivateJet'

export type FlightPhase = 'climb' | 'cruise' | 'descent' | 'approach'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface LiveAC {
  id: string
  callsign: string
  airline: string
  airlineCode: string
  acType: AircraftType
  lat: number
  lon: number
  heading: number
  speedKts: number
  altFt: number
  vspeed: number
  phase: FlightPhase
  depCode: string
  arrCode: string
  depLat: number; depLon: number
  arrLat: number; arrLon: number
  progress: number
  trail: [number, number][]
  devProb: number
  riskLevel: RiskLevel
  delayMin: number
  fuelPct: number
  windSpeed: number
  storm: boolean
  visibility: number
  temperature: number
  etaMin: number
  technicalIssue: boolean
  distanceNm: number
  isCargo: boolean
}

export interface WeatherCell {
  id: string
  lat: number; lon: number
  radiusKm: number
  type: 'storm' | 'rain' | 'fog'
  intensity: number
}

interface AP { name: string; lat: number; lon: number; country: string }

export const AIRPORTS: Record<string, AP> = {
  DXB: { name: 'Dubai Intl',       lat: 25.2532,  lon: 55.3657,   country: 'UAE' },
  AUH: { name: 'Abu Dhabi',        lat: 24.4428,  lon: 54.6510,   country: 'UAE' },
  DOH: { name: 'Hamad Intl',       lat: 25.2731,  lon: 51.6080,   country: 'QAT' },
  IST: { name: 'Istanbul',         lat: 41.2753,  lon: 28.7519,   country: 'TUR' },
  CAI: { name: 'Cairo',            lat: 30.1219,  lon: 31.4056,   country: 'EGY' },
  AMM: { name: 'Amman',            lat: 31.7226,  lon: 35.9932,   country: 'JOR' },
  LHR: { name: 'Heathrow',         lat: 51.4700,  lon: -0.4543,   country: 'GBR' },
  FRA: { name: 'Frankfurt',        lat: 50.0379,  lon: 8.5622,    country: 'DEU' },
  CDG: { name: 'Paris CDG',        lat: 49.0097,  lon: 2.5479,    country: 'FRA' },
  AMS: { name: 'Amsterdam',        lat: 52.3105,  lon: 4.7683,    country: 'NLD' },
  MUC: { name: 'Munich',           lat: 48.3538,  lon: 11.7861,   country: 'DEU' },
  BCN: { name: 'Barcelona',        lat: 41.2974,  lon: 2.0833,    country: 'ESP' },
  JFK: { name: 'JFK',              lat: 40.6413,  lon: -73.7781,  country: 'USA' },
  ORD: { name: 'Chicago O\'Hare',  lat: 41.9742,  lon: -87.9073,  country: 'USA' },
  LAX: { name: 'Los Angeles',      lat: 33.9425,  lon: -118.4081, country: 'USA' },
  SIN: { name: 'Changi',           lat: 1.3644,   lon: 103.9915,  country: 'SGP' },
  BKK: { name: 'Suvarnabhumi',     lat: 13.6900,  lon: 100.7501,  country: 'THA' },
  KUL: { name: 'KLIA',             lat: 2.7456,   lon: 101.7099,  country: 'MYS' },
  HKG: { name: 'Hong Kong',        lat: 22.3080,  lon: 113.9185,  country: 'HKG' },
  NRT: { name: 'Narita',           lat: 35.7720,  lon: 140.3929,  country: 'JPN' },
  ICN: { name: 'Incheon',          lat: 37.4602,  lon: 126.4407,  country: 'KOR' },
  SYD: { name: 'Sydney',           lat: -33.9399, lon: 151.1753,  country: 'AUS' },
  DEL: { name: 'Delhi',            lat: 28.5562,  lon: 77.1000,   country: 'IND' },
  BOM: { name: 'Mumbai',           lat: 19.0896,  lon: 72.8656,   country: 'IND' },
  JNB: { name: 'Johannesburg',     lat: -26.1392, lon: 28.2460,   country: 'ZAF' },
}

const ROUTE_PAIRS: [string, string][] = [
  ['DXB','LHR'],['DXB','FRA'],['DXB','CDG'],['DXB','AMS'],['DXB','MUC'],
  ['DOH','LHR'],['DOH','FRA'],['DOH','AMS'],['DOH','SIN'],['DOH','DEL'],
  ['AUH','LHR'],['AUH','FRA'],['AUH','SIN'],
  ['IST','LHR'],['IST','FRA'],['IST','CDG'],['IST','JFK'],
  ['LHR','JFK'],['LHR','ORD'],['LHR','LAX'],['LHR','DEL'],['LHR','SIN'],
  ['FRA','JFK'],['FRA','SIN'],['FRA','NRT'],['FRA','DEL'],
  ['CDG','JFK'],['CDG','SIN'],['AMS','JFK'],['MUC','JFK'],['BCN','JFK'],
  ['LHR','FRA'],['LHR','CDG'],['FRA','CDG'],['FRA','AMS'],['FRA','BCN'],
  ['DXB','SIN'],['DXB','BKK'],['DXB','DEL'],['DXB','BOM'],['DXB','KUL'],
  ['SIN','BKK'],['SIN','KUL'],['SIN','HKG'],['SIN','NRT'],['SIN','ICN'],
  ['BKK','HKG'],['BKK','NRT'],['HKG','NRT'],['HKG','ICN'],['NRT','ICN'],
  ['SYD','SIN'],['SYD','HKG'],['SYD','NRT'],['LAX','NRT'],['LAX','SYD'],
  ['JNB','DXB'],['JNB','LHR'],['CAI','DXB'],['CAI','IST'],['CAI','LHR'],
  ['DEL','LHR'],['DEL','FRA'],['DEL','SIN'],['BOM','LHR'],['BOM','SIN'],
  ['DXB','DOH'],['DXB','IST'],['DXB','CAI'],['DXB','NRT'],['DXB','HKG'],
  ['JFK','ORD'],['JFK','LAX'],['ORD','LAX'],
]

const AIRLINE_DATA = [
  { code:'EK', name:'Emirates',           types:['B777','A380','A350'] as AircraftType[], cargo:false },
  { code:'QR', name:'Qatar Airways',      types:['A350','B777','A380'] as AircraftType[], cargo:false },
  { code:'EY', name:'Etihad',             types:['A320','A350','B787'] as AircraftType[], cargo:false },
  { code:'TK', name:'Turkish Airlines',   types:['A320','A321','A330','B777'] as AircraftType[], cargo:false },
  { code:'LH', name:'Lufthansa',          types:['A320','A321','A350','A330'] as AircraftType[], cargo:false },
  { code:'BA', name:'British Airways',    types:['A320','A350','B777','B787'] as AircraftType[], cargo:false },
  { code:'AF', name:'Air France',         types:['A320','A350','B777'] as AircraftType[], cargo:false },
  { code:'KL', name:'KLM',                types:['B737','B777','B787'] as AircraftType[], cargo:false },
  { code:'SQ', name:'Singapore Airlines', types:['A350','A380','B777'] as AircraftType[], cargo:false },
  { code:'CX', name:'Cathay Pacific',     types:['A350','B777'] as AircraftType[], cargo:false },
  { code:'NH', name:'ANA',                types:['B787','B777','A321'] as AircraftType[], cargo:false },
  { code:'KE', name:'Korean Air',         types:['A380','B777'] as AircraftType[], cargo:false },
  { code:'JL', name:'Japan Airlines',     types:['B787','B777'] as AircraftType[], cargo:false },
  { code:'QF', name:'Qantas',             types:['A380','B787'] as AircraftType[], cargo:false },
  { code:'TG', name:'Thai Airways',       types:['A350','B777'] as AircraftType[], cargo:false },
  { code:'UA', name:'United Airlines',    types:['B737','B787','B777'] as AircraftType[], cargo:false },
  { code:'DL', name:'Delta',              types:['A321','B737','B767','A330'] as AircraftType[], cargo:false },
  { code:'FZ', name:'FlyDubai',           types:['B737'] as AircraftType[], cargo:false },
  { code:'G9', name:'Air Arabia',         types:['A320','A321'] as AircraftType[], cargo:false },
  { code:'FX', name:'FedEx',              types:['B777F','B747F'] as AircraftType[], cargo:true },
  { code:'5X', name:'UPS Airlines',       types:['B777F','B747F'] as AircraftType[], cargo:true },
  { code:'PJ', name:'Private Jet',        types:['PrivateJet'] as AircraftType[], cargo:false },
  { code:'HC', name:'Helicopter Charter', types:['Helicopter'] as AircraftType[], cargo:false },
]

const CRUISE_ALT: Partial<Record<AircraftType, number>> = {
  A380:40000, B777:39000, B747:39000, B747F:37000, B777F:37000,
  A350:38000, B787:38000, A330:37000, A320:36000, A321:37000,
  B737:35000, B767:37000, ERJ190:37000, ATR72:22000,
  Helicopter:3500, PrivateJet:41000,
}

const CRUISE_SPD: Partial<Record<AircraftType, number>> = {
  A380:492, B777:488, B747:488, B747F:480, B777F:482,
  A350:488, B787:488, A330:476, A320:450, A321:452,
  B737:445, B767:464, ERJ190:430, ATR72:280,
  Helicopter:140, PrivateJet:470,
}

function rn(a: number, b: number) { return a + Math.random() * (b - a) }
function ri<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

function brng(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180
  const φ1 = lat1 * r, φ2 = lat2 * r, Δλ = (lon2 - lon1) * r
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
}

function ipos(dLat: number, dLon: number, aLat: number, aLon: number, t: number): [number, number] {
  return [dLat + (aLat - dLat) * t, dLon + (aLon - dLon) * t]
}

function dnm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function phase(p: number): FlightPhase {
  if (p < 0.07) return 'climb'
  if (p > 0.92) return 'approach'
  if (p > 0.85) return 'descent'
  return 'cruise'
}

function alt(p: number, t: AircraftType): number {
  const c = CRUISE_ALT[t] ?? 36000
  if (p < 0.07) return Math.round(8000 + (c - 8000) * (p / 0.07))
  if (p > 0.92) return Math.round(Math.max(2500, c - (c - 2500) * ((p - 0.92) / 0.08)))
  if (p > 0.85) return Math.round(c - (c - 8000) * ((p - 0.85) / 0.07) * 0.3)
  return c
}

function vspd(p: number): number {
  if (p < 0.07) return 1800
  if (p > 0.92) return -1500
  if (p > 0.85) return -700
  return 0
}

function risk(storm: boolean, tech: boolean, cong: number, wind: number): [number, RiskLevel] {
  let p = (storm ? 0.35 : 0) + (tech ? 0.25 : 0) + (cong > 80 ? 0.15 : 0) + (wind > 60 ? 0.1 : 0) + Math.random() * 0.08
  p = Math.min(p, 0.97)
  return [p, p > 0.6 ? 'critical' : p > 0.35 ? 'high' : p > 0.15 ? 'medium' : 'low']
}

function makeAC(dep: string, arr: string, prog?: number): LiveAC {
  const d = AIRPORTS[dep], a = AIRPORTS[arr]
  const al = ri(AIRLINE_DATA)
  const ac = ri(al.types)
  const t = prog !== undefined ? prog : Math.random()
  const [lat, lon] = ipos(d.lat, d.lon, a.lat, a.lon, t)
  const hdg = brng(lat, lon, a.lat, a.lon)
  const cr = CRUISE_ALT[ac] ?? 36000
  const spd = CRUISE_SPD[ac] ?? 450
  const dNm = dnm(d.lat, d.lon, a.lat, a.lon)
  const storm = Math.random() < 0.07
  const tech = Math.random() < 0.05
  const cong = Math.floor(rn(20, 90))
  const wind = Math.floor(rn(5, 80))
  const [dp, rl] = risk(storm, tech, cong, wind)
  const num = Math.floor(rn(100, 999))
  const ph = phase(t)
  const curSpd = ph === 'cruise' ? spd : ph === 'climb' ? Math.round(spd * 0.82) : Math.round(spd * 0.72)
  return {
    id: `${al.code}${num}`,
    callsign: `${al.code}${num}`,
    airline: al.name,
    airlineCode: al.code,
    acType: ac,
    lat, lon, heading: hdg,
    speedKts: curSpd,
    altFt: alt(t, ac),
    vspeed: vspd(t),
    phase: ph,
    depCode: dep, arrCode: arr,
    depLat: d.lat, depLon: d.lon,
    arrLat: a.lat, arrLon: a.lon,
    progress: t, trail: [],
    devProb: dp, riskLevel: rl,
    delayMin: Math.floor(rn(0, 50)),
    fuelPct: Math.round(rn(25, 92)),
    windSpeed: wind,
    storm, visibility: Math.floor(rn(800, 10000)),
    temperature: Math.floor(rn(-60, 40)),
    etaMin: Math.round((1 - t) * dNm / spd * 60),
    technicalIssue: tech,
    distanceNm: Math.round(dNm),
    isCargo: al.cargo,
  }
}

// Short-haul routes used by helicopters + private jets
const SHORT_ROUTES: [string, string][] = [
  ['DXB','AUH'],['DXB','DOH'],['LHR','CDG'],['LHR','AMS'],['FRA','CDG'],
  ['JFK','ORD'],['SIN','KUL'],['HKG','SIN'],['NRT','ICN'],['DEL','BOM'],
]

function makeSpecialAC(dep: string, arr: string, t: AircraftType, prog?: number): LiveAC {
  const d = AIRPORTS[dep], a = AIRPORTS[arr]
  if (!d || !a) return makeAC(dep, arr, prog)
  const code = t === 'PrivateJet' ? 'PJ' : 'HC'
  const name = t === 'PrivateJet' ? 'Private Jet' : 'Helicopter Charter'
  const p    = prog !== undefined ? prog : Math.random()
  const [lat, lon] = ipos(d.lat, d.lon, a.lat, a.lon, p)
  const hdg  = brng(lat, lon, a.lat, a.lon)
  const dNm  = dnm(d.lat, d.lon, a.lat, a.lon)
  const spd  = CRUISE_SPD[t] ?? 200
  const num  = Math.floor(rn(10, 99))
  const storm = Math.random() < 0.04
  const tech  = Math.random() < 0.03
  const wind  = Math.floor(rn(5, 50))
  const [dp, rl] = risk(storm, tech, 30, wind)
  return {
    id: `${code}${num}`, callsign: `${code}${num}`,
    airline: name, airlineCode: code, acType: t,
    lat, lon, heading: hdg,
    speedKts: spd, altFt: CRUISE_ALT[t] ?? 5000,
    vspeed: 0, phase: 'cruise',
    depCode: dep, arrCode: arr,
    depLat: d.lat, depLon: d.lon, arrLat: a.lat, arrLon: a.lon,
    progress: p, trail: [],
    devProb: dp, riskLevel: rl,
    delayMin: Math.floor(rn(0, 15)),
    fuelPct: Math.round(rn(40, 90)),
    windSpeed: wind, storm,
    visibility: Math.floor(rn(2000, 10000)),
    temperature: Math.floor(rn(15, 40)),
    etaMin: Math.round((1 - p) * dNm / spd * 60),
    technicalIssue: tech,
    distanceNm: Math.round(dNm),
    isCargo: false,
  }
}

export function generateLiveFleet(): LiveAC[] {
  const fleet: LiveAC[] = []
  for (const [dep, arr] of ROUTE_PAIRS) {
    const n = 4 + Math.floor(Math.random() * 3)
    for (let i = 0; i < n; i++) fleet.push(makeAC(dep, arr, (i + Math.random()) / n))
  }
  // Reverse routes (some)
  for (const [arr, dep] of ROUTE_PAIRS.slice(0, 25)) {
    fleet.push(makeAC(dep, arr, Math.random()))
  }
  // Private jets
  for (let i = 0; i < 18; i++) {
    const [dep, arr] = SHORT_ROUTES[i % SHORT_ROUTES.length]
    if (AIRPORTS[dep] && AIRPORTS[arr]) fleet.push(makeSpecialAC(dep, arr, 'PrivateJet'))
  }
  // Helicopters
  for (let i = 0; i < 10; i++) {
    const [dep, arr] = SHORT_ROUTES[i % SHORT_ROUTES.length]
    if (AIRPORTS[dep] && AIRPORTS[arr]) fleet.push(makeSpecialAC(dep, arr, 'Helicopter'))
  }
  return fleet
}

// Advance fleet by dt milliseconds
const PPM = 0.000038  // progress per ms ≈ route completes in ~26s real time (sim speed)

export function updateFleet(fleet: LiveAC[], dt: number): LiveAC[] {
  return fleet.map(ac => {
    const np = ac.progress + PPM * dt
    if (np >= 1) return makeAC(ac.arrCode, ac.depCode, 0.01)

    const [nlat, nlon] = ipos(ac.depLat, ac.depLon, ac.arrLat, ac.arrLon, np)
    const hdg = brng(nlat, nlon, ac.arrLat, ac.arrLon)
    const nAlt = alt(np, ac.acType)
    const last = ac.trail[ac.trail.length - 1]
    const addTrail = !last || Math.hypot(nlat - last[0], nlon - last[1]) > 0.45
    return {
      ...ac,
      lat: nlat, lon: nlon, heading: hdg,
      altFt: nAlt,
      vspeed: vspd(np),
      phase: phase(np),
      progress: np,
      trail: addTrail ? ([...ac.trail.slice(-7), [nlat, nlon]] as [number,number][]) : ac.trail,
      etaMin: Math.max(0, Math.round((1 - np) * ac.distanceNm / ac.speedKts * 60)),
    }
  })
}

export const WEATHER_CELLS: WeatherCell[] = [
  { id:'wx1',  lat:28,   lon:47,  radiusKm:220, type:'storm', intensity:0.80 },
  { id:'wx2',  lat:25,   lon:62,  radiusKm:150, type:'rain',  intensity:0.60 },
  { id:'wx3',  lat:50,   lon:10,  radiusKm:300, type:'rain',  intensity:0.50 },
  { id:'wx4',  lat:14,   lon:76,  radiusKm:180, type:'storm', intensity:0.72 },
  { id:'wx5',  lat:39,   lon:22,  radiusKm:120, type:'fog',   intensity:0.45 },
  { id:'wx6',  lat:4,    lon:106, radiusKm:200, type:'storm', intensity:0.90 },
  { id:'wx7',  lat:35,   lon:-5,  radiusKm:160, type:'rain',  intensity:0.55 },
  { id:'wx8',  lat:-28,  lon:28,  radiusKm:240, type:'rain',  intensity:0.40 },
  { id:'wx9',  lat:55,   lon:30,  radiusKm:180, type:'fog',   intensity:0.60 },
  { id:'wx10', lat:22,   lon:92,  radiusKm:140, type:'storm', intensity:0.70 },
]

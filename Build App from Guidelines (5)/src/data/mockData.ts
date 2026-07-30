export type Flight = {
  flight_id: string
  airline: string
  aircraft_type: string
  departure_airport: string
  arrival_airport: string
  scheduled_departure: string
  actual_departure: string
  scheduled_arrival: string
  actual_arrival: string
  temperature: number
  visibility: number
  wind_speed: number
  rainfall: number
  storm: boolean
  airport_congestion: number
  runway_status: string
  technical_issue: boolean
  fuel_load: number
  distance: number
  altitude: number
  delay_minutes: number
  deviation: 0 | 1
}

const airlines = ['Emirates', 'Qatar Airways', 'Turkish Airlines', 'Lufthansa', 'British Airways', 'Air Arabia', 'FlyDubai', 'Etihad']
const aircraft = ['Boeing 737', 'Airbus A320', 'Boeing 777', 'Airbus A380', 'Boeing 787', 'Airbus A350']
const airports = ['DXB', 'AUH', 'DOH', 'IST', 'LHR', 'FRA', 'CDG', 'JFK', 'SIN', 'KUL', 'BKK']
const runwayStatuses = ['Operational', 'Partially Closed', 'Maintenance', 'Wet', 'Dry']

function rnd(min: number, max: number, dec = 0) {
  const v = Math.random() * (max - min) + min
  return dec ? parseFloat(v.toFixed(dec)) : Math.round(v)
}

function addMinutes(isoStr: string, mins: number) {
  const d = new Date(isoStr)
  d.setMinutes(d.getMinutes() + mins)
  return d.toISOString().slice(0, 16).replace('T', ' ')
}

function genFlight(i: number): Flight {
  const dep = airports[rnd(0, airports.length - 1)]
  let arr = airports[rnd(0, airports.length - 1)]
  while (arr === dep) arr = airports[rnd(0, airports.length - 1)]

  const base = new Date(2024, rnd(0, 11), rnd(1, 28), rnd(0, 23), rnd(0, 59))
  const schedDep = base.toISOString().slice(0, 16).replace('T', ' ')
  const delay = rnd(0, 120)
  const storm = Math.random() < 0.15
  const techIssue = Math.random() < 0.1
  const congestion = rnd(10, 95)
  const windSpeed = rnd(0, 80)
  const rainfall = rnd(0, 50)
  const visibility = rnd(200, 10000)

  const deviationProb =
    (storm ? 0.35 : 0) +
    (techIssue ? 0.25 : 0) +
    (congestion > 80 ? 0.15 : 0) +
    (windSpeed > 60 ? 0.1 : 0) +
    (visibility < 500 ? 0.1 : 0) +
    (delay > 60 ? 0.05 : 0)

  const deviation = (Math.random() < Math.min(deviationProb, 0.85) ? 1 : 0) as 0 | 1
  const distance = rnd(200, 8000)
  const flightTime = Math.round(distance / 8)

  return {
    flight_id: `FL${String(1000 + i).padStart(4, '0')}`,
    airline: airlines[rnd(0, airlines.length - 1)],
    aircraft_type: aircraft[rnd(0, aircraft.length - 1)],
    departure_airport: dep,
    arrival_airport: arr,
    scheduled_departure: schedDep,
    actual_departure: addMinutes(schedDep, delay),
    scheduled_arrival: addMinutes(schedDep, flightTime),
    actual_arrival: addMinutes(schedDep, flightTime + delay + rnd(-10, 30)),
    temperature: rnd(-20, 45, 1),
    visibility,
    wind_speed: windSpeed,
    rainfall: rnd(0, 50, 1),
    storm,
    airport_congestion: congestion,
    runway_status: runwayStatuses[rnd(0, runwayStatuses.length - 1)],
    technical_issue: techIssue,
    fuel_load: rnd(40, 100, 1),
    distance,
    altitude: rnd(28000, 41000),
    delay_minutes: delay,
    deviation,
  }
}

export const FLIGHTS: Flight[] = Array.from({ length: 120 }, (_, i) => genFlight(i))

export const MODEL_RESULTS = {
  models: [
    { name: 'Logistic Regression', accuracy: 0.812, precision: 0.796, recall: 0.821, f1: 0.808 },
    { name: 'Decision Tree', accuracy: 0.851, precision: 0.843, recall: 0.858, f1: 0.850 },
    { name: 'Random Forest', accuracy: 0.924, precision: 0.918, recall: 0.931, f1: 0.924 },
    { name: 'XGBoost', accuracy: 0.941, precision: 0.937, recall: 0.945, f1: 0.941 },
    { name: 'Gradient Boosting', accuracy: 0.935, precision: 0.929, recall: 0.940, f1: 0.934 },
    { name: 'SVM', accuracy: 0.887, precision: 0.879, recall: 0.894, f1: 0.886 },
  ],
  bestModel: 'XGBoost',
  featureImportance: [
    { feature: 'Storm', importance: 0.287 },
    { feature: 'Technical Issue', importance: 0.198 },
    { feature: 'Airport Congestion', importance: 0.142 },
    { feature: 'Visibility', importance: 0.118 },
    { feature: 'Wind Speed', importance: 0.094 },
    { feature: 'Delay Minutes', importance: 0.071 },
    { feature: 'Rainfall', importance: 0.048 },
    { feature: 'Temperature', importance: 0.025 },
    { feature: 'Fuel Load', importance: 0.017 },
  ],
  confusionMatrix: { tp: 847, fp: 53, fn: 49, tn: 1051 },
  rocPoints: Array.from({ length: 20 }, (_, i) => {
    const t = i / 19
    return { fpr: parseFloat((t * t * 0.15).toFixed(3)), tpr: parseFloat((1 - (1 - t) * (1 - t) * 0.08).toFixed(3)) }
  }),
  auc: 0.967,
}

export const TRAINING_LOG = [
  { epoch: 1, train_loss: 0.682, val_loss: 0.641, accuracy: 0.601 },
  { epoch: 2, train_loss: 0.521, val_loss: 0.498, accuracy: 0.724 },
  { epoch: 3, train_loss: 0.412, val_loss: 0.389, accuracy: 0.801 },
  { epoch: 4, train_loss: 0.334, val_loss: 0.318, accuracy: 0.851 },
  { epoch: 5, train_loss: 0.278, val_loss: 0.265, accuracy: 0.884 },
  { epoch: 6, train_loss: 0.231, val_loss: 0.222, accuracy: 0.908 },
  { epoch: 7, train_loss: 0.196, val_loss: 0.191, accuracy: 0.921 },
  { epoch: 8, train_loss: 0.168, val_loss: 0.165, accuracy: 0.934 },
  { epoch: 9, train_loss: 0.148, val_loss: 0.147, accuracy: 0.939 },
  { epoch: 10, train_loss: 0.133, val_loss: 0.134, accuracy: 0.941 },
]

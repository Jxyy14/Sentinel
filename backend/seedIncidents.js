// Run this script to populate sample incident data for demonstration
// Usage: node seedIncidents.js

import db from './database.js'

const sampleIncidents = [
  // New York area sample incidents (centered around 40.7128, -74.0060)
  {
    type: 'theft',
    severity: 'medium',
    title: 'Bike stolen from rack',
    description: 'Mountain bike was taken from outside the coffee shop',
    latitude: 40.7138,
    longitude: -74.0070,
    status: 'active'
  },
  {
    type: 'suspicious',
    severity: 'low',
    title: 'Suspicious person near park',
    description: 'Individual seen looking into parked cars',
    latitude: 40.7118,
    longitude: -74.0050,
    status: 'active'
  },
  {
    type: 'harassment',
    severity: 'high',
    title: 'Verbal harassment incident',
    description: 'Person was verbally harassed near subway entrance',
    latitude: 40.7145,
    longitude: -74.0080,
    status: 'active'
  },
  {
    type: 'assault',
    severity: 'critical',
    title: 'Physical altercation reported',
    description: 'Two individuals involved in a physical fight',
    latitude: 40.7108,
    longitude: -74.0040,
    status: 'investigating'
  },
  {
    type: 'vandalism',
    severity: 'low',
    title: 'Graffiti on building',
    description: 'Fresh graffiti spray painted on storefront',
    latitude: 40.7155,
    longitude: -74.0090,
    status: 'active'
  },
  {
    type: 'robbery',
    severity: 'critical',
    title: 'Phone snatched on street',
    description: 'Phone was grabbed from hand while walking',
    latitude: 40.7125,
    longitude: -74.0055,
    status: 'active'
  },
  {
    type: 'accident',
    severity: 'medium',
    title: 'Minor car accident',
    description: 'Fender bender at intersection, no injuries',
    latitude: 40.7132,
    longitude: -74.0065,
    status: 'resolved'
  }
]

// Historical data patterns (simulating past incidents for pattern analysis)
const historicalPatterns = []

// Generate historical data for the past 30 days
const incidentTypes = ['theft', 'assault', 'harassment', 'suspicious', 'robbery', 'vandalism']
const severities = ['low', 'medium', 'high', 'critical']

for (let day = 0; day < 30; day++) {
  // More incidents on weekends (day 0 = Sunday, 6 = Saturday)
  const date = new Date()
  date.setDate(date.getDate() - day)
  const dayOfWeek = date.getDay()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  
  const incidentsPerDay = isWeekend ? Math.floor(Math.random() * 5) + 3 : Math.floor(Math.random() * 3) + 1
  
  for (let i = 0; i < incidentsPerDay; i++) {
    // More incidents at night (10 PM - 3 AM)
    const hourWeights = [3, 4, 3, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 4, 5, 4]
    const totalWeight = hourWeights.reduce((a, b) => a + b, 0)
    let random = Math.random() * totalWeight
    let hour = 0
    for (let h = 0; h < 24; h++) {
      random -= hourWeights[h]
      if (random <= 0) {
        hour = h
        break
      }
    }
    
    const type = incidentTypes[Math.floor(Math.random() * incidentTypes.length)]
    const severity = severities[Math.floor(Math.random() * severities.length)]
    
    // Random location within ~2km of center
    const latOffset = (Math.random() - 0.5) * 0.02
    const lngOffset = (Math.random() - 0.5) * 0.02
    
    historicalPatterns.push({
      latitude: 40.7128 + latOffset,
      longitude: -74.0060 + lngOffset,
      type,
      severity,
      hour_of_day: hour,
      day_of_week: dayOfWeek,
      month: date.getMonth(),
      count: 1
    })
  }
}

// Insert sample incidents
console.log('Seeding sample incidents...')

const insertIncident = db.prepare(`
  INSERT INTO incidents (type, severity, title, description, latitude, longitude, status, reported_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' hours'))
`)

sampleIncidents.forEach((incident, index) => {
  const hoursAgo = Math.floor(Math.random() * 12) // Random time within last 12 hours
  insertIncident.run(
    incident.type,
    incident.severity,
    incident.title,
    incident.description,
    incident.latitude,
    incident.longitude,
    incident.status,
    hoursAgo
  )
})

console.log(`Inserted ${sampleIncidents.length} sample incidents`)

// Insert historical patterns
console.log('Seeding historical patterns...')

const insertHistory = db.prepare(`
  INSERT INTO incident_history (latitude, longitude, type, severity, hour_of_day, day_of_week, month, count)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)

historicalPatterns.forEach(pattern => {
  insertHistory.run(
    pattern.latitude,
    pattern.longitude,
    pattern.type,
    pattern.severity,
    pattern.hour_of_day,
    pattern.day_of_week,
    pattern.month,
    pattern.count
  )
})

console.log(`Inserted ${historicalPatterns.length} historical patterns`)

console.log('Done! Sample data has been seeded.')

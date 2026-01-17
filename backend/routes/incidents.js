import express from 'express'
import db from '../database.js'
import { authenticateToken as auth } from '../middleware/auth.js'

const router = express.Router()

// Incident types with severity weights
const INCIDENT_TYPES = {
  theft: { label: 'Theft', weight: 0.7 },
  assault: { label: 'Assault', weight: 1.0 },
  harassment: { label: 'Harassment', weight: 0.8 },
  vandalism: { label: 'Vandalism', weight: 0.4 },
  suspicious: { label: 'Suspicious Activity', weight: 0.5 },
  robbery: { label: 'Robbery', weight: 0.9 },
  carbreak: { label: 'Car Break-in', weight: 0.6 },
  shooting: { label: 'Shooting', weight: 1.0 },
  accident: { label: 'Accident', weight: 0.5 },
  other: { label: 'Other', weight: 0.3 }
}

const SEVERITY_WEIGHTS = {
  low: 0.3,
  medium: 0.6,
  high: 0.9,
  critical: 1.0
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000 // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Get all incident types
router.get('/types', (req, res) => {
  res.json({ types: INCIDENT_TYPES })
})

// Get nearby incidents
router.get('/nearby', auth, (req, res) => {
  try {
    const { latitude, longitude, radius = 2000 } = req.query

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude required' })
    }

    const lat = parseFloat(latitude)
    const lng = parseFloat(longitude)
    const radiusMeters = parseInt(radius)

    // Approximate degree offset for query optimization
    const latOffset = radiusMeters / 111000
    const lngOffset = radiusMeters / (111000 * Math.cos(lat * Math.PI / 180))

    const incidents = db.prepare(`
      SELECT * FROM incidents
      WHERE latitude BETWEEN ? AND ?
        AND longitude BETWEEN ? AND ?
        AND status IN ('active', 'verified')
        AND reported_at > datetime('now', '-7 days')
      ORDER BY reported_at DESC
    `).all(
      lat - latOffset,
      lat + latOffset,
      lng - lngOffset,
      lng + lngOffset
    )

    // Filter by actual distance and add distance to each incident
    const nearbyIncidents = incidents
      .map(incident => ({
        ...incident,
        distance: calculateDistance(lat, lng, incident.latitude, incident.longitude)
      }))
      .filter(incident => incident.distance <= radiusMeters)
      .sort((a, b) => a.distance - b.distance)

    res.json({ incidents: nearbyIncidents })
  } catch (err) {
    console.error('Error getting nearby incidents:', err)
    res.status(500).json({ error: 'Failed to get nearby incidents' })
  }
})

// Calculate safety score for a location
router.get('/safety-score', auth, (req, res) => {
  try {
    const { latitude, longitude } = req.query

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude required' })
    }

    const lat = parseFloat(latitude)
    const lng = parseFloat(longitude)
    const now = new Date()
    const currentHour = now.getHours()
    const currentDay = now.getDay()

    // Get incidents within 1km for the past 30 days
    const latOffset = 1000 / 111000
    const lngOffset = 1000 / (111000 * Math.cos(lat * Math.PI / 180))

    const recentIncidents = db.prepare(`
      SELECT * FROM incidents
      WHERE latitude BETWEEN ? AND ?
        AND longitude BETWEEN ? AND ?
        AND reported_at > datetime('now', '-30 days')
    `).all(
      lat - latOffset,
      lat + latOffset,
      lng - lngOffset,
      lng + lngOffset
    )

    // Filter by actual distance
    const nearbyIncidents = recentIncidents
      .map(incident => ({
        ...incident,
        distance: calculateDistance(lat, lng, incident.latitude, incident.longitude)
      }))
      .filter(incident => incident.distance <= 1000)

    // Calculate base score from recent incidents
    let incidentScore = 100

    nearbyIncidents.forEach(incident => {
      const typeWeight = INCIDENT_TYPES[incident.type]?.weight || 0.5
      const severityWeight = SEVERITY_WEIGHTS[incident.severity] || 0.5
      const distanceFactor = 1 - (incident.distance / 1000) // Closer = more impact
      const ageFactor = calculateAgeFactor(incident.reported_at)

      const impact = typeWeight * severityWeight * distanceFactor * ageFactor * 10
      incidentScore -= impact
    })

    // Get active incidents (within last 24 hours)
    const activeIncidents = nearbyIncidents.filter(i => {
      const reportedAt = new Date(i.reported_at)
      const hoursSince = (now - reportedAt) / (1000 * 60 * 60)
      return hoursSince <= 24 && i.status === 'active'
    })

    // Additional penalty for active incidents
    activeIncidents.forEach(incident => {
      incidentScore -= 5
    })

    // Historical pattern analysis
    const historicalData = getHistoricalPattern(lat, lng, currentHour, currentDay)
    if (historicalData) {
      incidentScore -= historicalData.risk_factor * 15
    }

    // Time-based adjustments (night time is generally riskier)
    const isNightTime = currentHour >= 22 || currentHour <= 5
    const isLateNight = currentHour >= 0 && currentHour <= 4
    if (isLateNight) {
      incidentScore -= 10
    } else if (isNightTime) {
      incidentScore -= 5
    }

    // Clamp score between 0 and 100
    incidentScore = Math.max(0, Math.min(100, Math.round(incidentScore)))

    // Determine risk level
    let riskLevel, riskLabel, riskColor
    if (incidentScore >= 80) {
      riskLevel = 'safe'
      riskLabel = 'Safe Area'
      riskColor = '#00e676'
    } else if (incidentScore >= 60) {
      riskLevel = 'moderate'
      riskLabel = 'Moderate Risk'
      riskColor = '#ffc400'
    } else if (incidentScore >= 40) {
      riskLevel = 'elevated'
      riskLabel = 'Elevated Risk'
      riskColor = '#ff9100'
    } else if (incidentScore >= 20) {
      riskLevel = 'high'
      riskLabel = 'High Risk'
      riskColor = '#ff5252'
    } else {
      riskLevel = 'critical'
      riskLabel = 'Critical Risk'
      riskColor = '#ff1744'
    }

    // Generate alerts
    const alerts = []

    if (activeIncidents.length > 0) {
      alerts.push({
        type: 'active_incidents',
        severity: 'high',
        message: `${activeIncidents.length} active incident${activeIncidents.length > 1 ? 's' : ''} reported nearby in the last 24 hours`,
        incidents: activeIncidents.slice(0, 3)
      })
    }

    if (historicalData && historicalData.risk_factor > 0.5) {
      alerts.push({
        type: 'historical_pattern',
        severity: 'warning',
        message: `This area historically has elevated incident rates at this time`
      })
    }

    if (isLateNight && incidentScore < 70) {
      alerts.push({
        type: 'time_warning',
        severity: 'info',
        message: 'Late night hours - exercise extra caution'
      })
    }

    res.json({
      score: incidentScore,
      riskLevel,
      riskLabel,
      riskColor,
      alerts,
      stats: {
        totalIncidents30Days: nearbyIncidents.length,
        activeIncidents: activeIncidents.length,
        currentHour,
        isNightTime
      }
    })
  } catch (err) {
    console.error('Error calculating safety score:', err)
    res.status(500).json({ error: 'Failed to calculate safety score' })
  }
})

function calculateAgeFactor(reportedAt) {
  const now = new Date()
  const reported = new Date(reportedAt)
  const daysSince = (now - reported) / (1000 * 60 * 60 * 24)

  if (daysSince <= 1) return 1.0
  if (daysSince <= 3) return 0.8
  if (daysSince <= 7) return 0.6
  if (daysSince <= 14) return 0.4
  if (daysSince <= 30) return 0.2
  return 0.1
}

function getHistoricalPattern(lat, lng, hour, day) {
  // Check for historical patterns in this area at this time
  const latOffset = 500 / 111000
  const lngOffset = 500 / (111000 * Math.cos(lat * Math.PI / 180))

  const pattern = db.prepare(`
    SELECT AVG(incident_count) as avg_count, AVG(avg_severity) as severity
    FROM historical_incident_patterns
    WHERE latitude BETWEEN ? AND ?
      AND longitude BETWEEN ? AND ?
      AND (hour_of_day = ? OR hour_of_day IS NULL)
      AND (day_of_week = ? OR day_of_week IS NULL)
  `).get(
    lat - latOffset,
    lat + latOffset,
    lng - lngOffset,
    lng + lngOffset,
    hour,
    day
  )

  if (pattern && pattern.avg_count > 0) {
    return {
      incident_count: pattern.avg_count,
      severity: pattern.severity,
      risk_factor: Math.min(1, (pattern.avg_count * pattern.severity) / 10)
    }
  }

  return null
}

// Report a new incident
router.post('/', auth, (req, res) => {
  try {
    const { latitude, longitude, type, severity, title, description, address } = req.body

    if (!latitude || !longitude || !type || !title) {
      return res.status(400).json({ error: 'Latitude, longitude, type, and title are required' })
    }

    if (!INCIDENT_TYPES[type]) {
      return res.status(400).json({ error: 'Invalid incident type' })
    }

    const result = db.prepare(`
      INSERT INTO incidents (user_id, latitude, longitude, type, severity, title, description, address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      latitude,
      longitude,
      type,
      severity || 'medium',
      title,
      description || null,
      address || null
    )

    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(result.lastInsertRowid)

    // Update historical patterns
    updateHistoricalPattern(latitude, longitude, type, severity || 'medium')

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit('new-incident', {
        incident,
        message: 'New incident reported nearby'
      })
    }

    res.json({ incident })
  } catch (err) {
    console.error('Error reporting incident:', err)
    res.status(500).json({ error: 'Failed to report incident' })
  }
})

function updateHistoricalPattern(lat, lng, type, severity) {
  const now = new Date()
  const hour = now.getHours()
  const day = now.getDay()
  const severityValue = SEVERITY_WEIGHTS[severity] || 0.5

  // Check if pattern exists
  const latOffset = 500 / 111000
  const lngOffset = 500 / (111000 * Math.cos(lat * Math.PI / 180))

  const existing = db.prepare(`
    SELECT * FROM historical_incident_patterns
    WHERE latitude BETWEEN ? AND ?
      AND longitude BETWEEN ? AND ?
      AND hour_of_day = ?
      AND day_of_week = ?
  `).get(
    lat - latOffset,
    lat + latOffset,
    lng - lngOffset,
    lng + lngOffset,
    hour,
    day
  )

  if (existing) {
    db.prepare(`
      UPDATE historical_incident_patterns
      SET incident_count = incident_count + 1,
          avg_severity = (avg_severity * incident_count + ?) / (incident_count + 1),
          last_updated = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(severityValue, existing.id)
  } else {
    db.prepare(`
      INSERT INTO historical_incident_patterns (latitude, longitude, hour_of_day, day_of_week, incident_count, avg_severity)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(lat, lng, hour, day, severityValue)
  }
}

// Vote on an incident (verify/dispute)
router.post('/:id/vote', auth, (req, res) => {
  try {
    const { id } = req.params
    const { voteType } = req.body

    if (!['upvote', 'downvote'].includes(voteType)) {
      return res.status(400).json({ error: 'Invalid vote type' })
    }

    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id)
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' })
    }

    // Check for existing vote
    const existingVote = db.prepare(`
      SELECT * FROM incident_votes WHERE incident_id = ? AND user_id = ?
    `).get(id, req.user.id)

    if (existingVote) {
      if (existingVote.vote_type === voteType) {
        // Remove vote
        db.prepare('DELETE FROM incident_votes WHERE id = ?').run(existingVote.id)
        db.prepare(`
          UPDATE incidents SET ${voteType}s = ${voteType}s - 1 WHERE id = ?
        `).run(id)
      } else {
        // Change vote
        db.prepare(`
          UPDATE incident_votes SET vote_type = ? WHERE id = ?
        `).run(voteType, existingVote.id)
        const oldVoteType = existingVote.vote_type
        db.prepare(`
          UPDATE incidents SET ${oldVoteType}s = ${oldVoteType}s - 1, ${voteType}s = ${voteType}s + 1 WHERE id = ?
        `).run(id)
      }
    } else {
      // New vote
      db.prepare(`
        INSERT INTO incident_votes (incident_id, user_id, vote_type) VALUES (?, ?, ?)
      `).run(id, req.user.id, voteType)
      db.prepare(`
        UPDATE incidents SET ${voteType}s = ${voteType}s + 1 WHERE id = ?
      `).run(id)
    }

    // Auto-verify if enough upvotes
    const updated = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id)
    if (updated.upvotes >= 3 && !updated.verified) {
      db.prepare('UPDATE incidents SET verified = 1, status = ? WHERE id = ?').run('verified', id)
    }

    // Auto-dismiss if too many downvotes
    if (updated.downvotes >= 5 && updated.downvotes > updated.upvotes * 2) {
      db.prepare('UPDATE incidents SET status = ? WHERE id = ?').run('dismissed', id)
    }

    const finalIncident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id)
    res.json({ incident: finalIncident })
  } catch (err) {
    console.error('Error voting on incident:', err)
    res.status(500).json({ error: 'Failed to vote on incident' })
  }
})

// Get incident details
router.get('/:id', auth, (req, res) => {
  try {
    const { id } = req.params
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id)

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' })
    }

    // Get user's vote if any
    const userVote = db.prepare(`
      SELECT vote_type FROM incident_votes WHERE incident_id = ? AND user_id = ?
    `).get(id, req.user.id)

    res.json({
      incident: {
        ...incident,
        userVote: userVote?.vote_type || null
      }
    })
  } catch (err) {
    console.error('Error getting incident:', err)
    res.status(500).json({ error: 'Failed to get incident' })
  }
})

// Update incident status (resolve/dismiss)
router.put('/:id/status', auth, (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id)
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' })
    }

    // Only reporter or admin can update
    if (incident.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this incident' })
    }

    const validStatuses = ['active', 'resolved', 'dismissed']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const resolvedAt = status === 'resolved' ? new Date().toISOString() : null

    db.prepare(`
      UPDATE incidents SET status = ?, resolved_at = ? WHERE id = ?
    `).run(status, resolvedAt, id)

    const updated = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id)
    res.json({ incident: updated })
  } catch (err) {
    console.error('Error updating incident status:', err)
    res.status(500).json({ error: 'Failed to update incident status' })
  }
})

// Get all incidents for map (with filters)
router.get('/', auth, (req, res) => {
  try {
    const { status, type, days = 7 } = req.query

    let query = `
      SELECT * FROM incidents
      WHERE reported_at > datetime('now', '-${parseInt(days)} days')
    `

    if (status) {
      query += ` AND status = '${status}'`
    }

    if (type) {
      query += ` AND type = '${type}'`
    }

    query += ' ORDER BY reported_at DESC LIMIT 500'

    const incidents = db.prepare(query).all()
    res.json({ incidents })
  } catch (err) {
    console.error('Error getting incidents:', err)
    res.status(500).json({ error: 'Failed to get incidents' })
  }
})

// Get heatmap data for visualization
router.get('/heatmap/data', auth, (req, res) => {
  try {
    const { latitude, longitude, radius = 5000 } = req.query

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude required' })
    }

    const lat = parseFloat(latitude)
    const lng = parseFloat(longitude)
    const radiusMeters = parseInt(radius)

    const latOffset = radiusMeters / 111000
    const lngOffset = radiusMeters / (111000 * Math.cos(lat * Math.PI / 180))

    // Get incident density for heatmap
    const incidents = db.prepare(`
      SELECT latitude, longitude, type, severity, reported_at
      FROM incidents
      WHERE latitude BETWEEN ? AND ?
        AND longitude BETWEEN ? AND ?
        AND reported_at > datetime('now', '-30 days')
    `).all(
      lat - latOffset,
      lat + latOffset,
      lng - lngOffset,
      lng + lngOffset
    )

    // Create heatmap points with intensity based on severity and recency
    const heatmapData = incidents.map(incident => {
      const severityWeight = SEVERITY_WEIGHTS[incident.severity] || 0.5
      const ageFactor = calculateAgeFactor(incident.reported_at)

      return {
        lat: incident.latitude,
        lng: incident.longitude,
        intensity: severityWeight * ageFactor
      }
    })

    res.json({ heatmapData })
  } catch (err) {
    console.error('Error getting heatmap data:', err)
    res.status(500).json({ error: 'Failed to get heatmap data' })
  }
})

export default router

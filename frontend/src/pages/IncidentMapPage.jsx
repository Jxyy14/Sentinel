import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Map, AlertTriangle, Shield, Clock, ChevronLeft, Plus, X, Check,
  ThumbsUp, ThumbsDown, MapPin, Navigation, RefreshCw, Bell, Eye,
  AlertCircle, Zap, TrendingUp, Filter, ChevronDown, Crosshair
} from 'lucide-react'
import api from '../services/api'
import './IncidentMapPage.css'

const INCIDENT_TYPES = {
  theft: { label: 'Theft', icon: '💰', color: '#ff9100' },
  assault: { label: 'Assault', icon: '⚠️', color: '#ff1744' },
  harassment: { label: 'Harassment', icon: '🚨', color: '#ff5252' },
  vandalism: { label: 'Vandalism', icon: '🔨', color: '#ffc400' },
  suspicious: { label: 'Suspicious Activity', icon: '👁️', color: '#7c4dff' },
  robbery: { label: 'Robbery', icon: '🔪', color: '#ff1744' },
  carbreak: { label: 'Car Break-in', icon: '🚗', color: '#ff9100' },
  shooting: { label: 'Shooting', icon: '🔫', color: '#d50000' },
  accident: { label: 'Accident', icon: '💥', color: '#2979ff' },
  other: { label: 'Other', icon: '📍', color: '#78909c' }
}

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low', color: '#ffc400' },
  { value: 'medium', label: 'Medium', color: '#ff9100' },
  { value: 'high', label: 'High', color: '#ff5252' },
  { value: 'critical', label: 'Critical', color: '#ff1744' }
]

export default function IncidentMapPage() {
  const navigate = useNavigate()
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const userMarkerRef = useRef(null)

  const [location, setLocation] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [safetyScore, setSafetyScore] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const [showIncidentDetail, setShowIncidentDetail] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({ type: 'all', timeRange: '7' })
  const [refreshing, setRefreshing] = useState(false)

  // Report form state
  const [reportForm, setReportForm] = useState({
    type: 'suspicious',
    severity: 'medium',
    title: '',
    description: ''
  })
  const [reporting, setReporting] = useState(false)

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          })
        },
        (err) => {
          console.error('Geolocation error:', err)
          setError('Unable to get your location. Please enable location services.')
          setLoading(false)
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    } else {
      setError('Geolocation is not supported by your browser')
      setLoading(false)
    }
  }, [])

  // Load data when location is available
  useEffect(() => {
    if (location) {
      loadData()
    }
  }, [location])

  // Initialize map
  useEffect(() => {
    if (!location || !mapRef.current) return

    // Load Leaflet CSS
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    // Load Leaflet JS
    const loadLeaflet = async () => {
      if (!window.L) {
        const script = document.createElement('script')
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
        script.onload = initMap
        document.head.appendChild(script)
      } else {
        initMap()
      }
    }

    const initMap = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
      }

      const map = window.L.map(mapRef.current, {
        zoomControl: false
      }).setView([location.latitude, location.longitude], 15)

      // Dark theme tiles
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19
      }).addTo(map)

      // Add zoom control to bottom right
      window.L.control.zoom({ position: 'bottomright' }).addTo(map)

      // User location marker
      const userIcon = window.L.divIcon({
        className: 'user-marker',
        html: `<div class="user-marker-dot"><div class="user-marker-pulse"></div></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })

      userMarkerRef.current = window.L.marker([location.latitude, location.longitude], { icon: userIcon })
        .addTo(map)
        .bindPopup('You are here')

      // Safety radius circle
      window.L.circle([location.latitude, location.longitude], {
        color: safetyScore?.riskColor || '#00e676',
        fillColor: safetyScore?.riskColor || '#00e676',
        fillOpacity: 0.1,
        radius: 500,
        weight: 2
      }).addTo(map)

      mapInstanceRef.current = map
      setLoading(false)
    }

    loadLeaflet()

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [location])

  // Update incident markers
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove())
    markersRef.current = []

    // Add incident markers
    incidents.forEach(incident => {
      const typeInfo = INCIDENT_TYPES[incident.type] || INCIDENT_TYPES.other
      const severityColor = SEVERITY_OPTIONS.find(s => s.value === incident.severity)?.color || '#ff9100'

      const icon = window.L.divIcon({
        className: 'incident-marker',
        html: `
          <div class="incident-marker-inner" style="background: ${severityColor}">
            <span>${typeInfo.icon}</span>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      })

      const marker = window.L.marker([incident.latitude, incident.longitude], { icon })
        .addTo(mapInstanceRef.current)
        .on('click', () => setShowIncidentDetail(incident))

      markersRef.current.push(marker)
    })
  }, [incidents])

  const loadData = async () => {
    try {
      const [incidentsRes, scoreRes] = await Promise.all([
        api.getNearbyIncidents(location.latitude, location.longitude, 2000),
        api.getSafetyScore(location.latitude, location.longitude)
      ])

      setIncidents(incidentsRes.incidents || [])
      setSafetyScore(scoreRes)
    } catch (err) {
      console.error('Failed to load incident data:', err)
      setError('Failed to load incident data')
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const handleCenterOnUser = () => {
    if (mapInstanceRef.current && location) {
      mapInstanceRef.current.setView([location.latitude, location.longitude], 15)
    }
  }

  const handleReportSubmit = async (e) => {
    e.preventDefault()
    if (!reportForm.title.trim()) return

    setReporting(true)
    try {
      await api.reportIncident({
        latitude: location.latitude,
        longitude: location.longitude,
        ...reportForm
      })
      setShowReportModal(false)
      setReportForm({ type: 'suspicious', severity: 'medium', title: '', description: '' })
      await loadData()
    } catch (err) {
      console.error('Failed to report incident:', err)
    }
    setReporting(false)
  }

  const handleVote = async (incidentId, voteType) => {
    try {
      await api.voteOnIncident(incidentId, voteType)
      const updated = await api.getIncident(incidentId)
      setShowIncidentDetail(updated.incident)
      await loadData()
    } catch (err) {
      console.error('Failed to vote:', err)
    }
  }

  const formatTimeAgo = (dateStr) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const formatDistance = (meters) => {
    if (meters < 1000) return `${Math.round(meters)}m away`
    return `${(meters / 1000).toFixed(1)}km away`
  }

  const filteredIncidents = incidents.filter(incident => {
    if (filters.type !== 'all' && incident.type !== filters.type) return false
    return true
  })

  if (error && !location) {
    return (
      <div className="page incident-map-page">
        <header className="page-header">
          <button className="btn-ghost" onClick={() => navigate(-1)}>
            <ChevronLeft size={24} />
          </button>
          <h1>INCIDENT MAP</h1>
        </header>
        <div className="error-state">
          <AlertCircle size={48} />
          <p>{error}</p>
          <button className="btn btn-outline" onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page incident-map-page">
      <header className="incident-map-header">
        <button className="btn-ghost" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <h1>INCIDENT MAP</h1>
        <div className="header-actions">
          <button className="btn-ghost" onClick={() => setShowFilters(!showFilters)}>
            <Filter size={20} />
          </button>
          <button className={`btn-ghost ${refreshing ? 'spinning' : ''}`} onClick={handleRefresh}>
            <RefreshCw size={20} />
          </button>
        </div>
      </header>

      {/* Safety Score Card */}
      {safetyScore && (
        <div className="safety-score-card" style={{ borderColor: safetyScore.riskColor }}>
          <div className="score-main">
            <div className="score-circle" style={{ 
              background: `conic-gradient(${safetyScore.riskColor} ${safetyScore.score * 3.6}deg, var(--bg-tertiary) 0deg)` 
            }}>
              <div className="score-inner">
                <span className="score-number">{safetyScore.score}</span>
                <span className="score-label">SAFETY</span>
              </div>
            </div>
            <div className="score-info">
              <div className="risk-badge" style={{ background: safetyScore.riskColor }}>
                <Shield size={14} />
                <span>{safetyScore.riskLabel}</span>
              </div>
              <div className="score-stats">
                <div className="stat">
                  <AlertTriangle size={14} />
                  <span>{safetyScore.stats?.totalIncidents30Days || 0} incidents (30d)</span>
                </div>
                <div className="stat">
                  <Zap size={14} />
                  <span>{safetyScore.stats?.activeIncidents || 0} active now</span>
                </div>
              </div>
            </div>
          </div>

          {/* Alerts */}
          {safetyScore.alerts && safetyScore.alerts.length > 0 && (
            <div className="alerts-section">
              {safetyScore.alerts.map((alert, idx) => (
                <div key={idx} className={`alert-item alert-${alert.severity}`}>
                  <Bell size={16} />
                  <span>{alert.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="filters-bar">
          <div className="filter-group">
            <label>Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))}
            >
              <option value="all">All Types</option>
              {Object.entries(INCIDENT_TYPES).map(([key, val]) => (
                <option key={key} value={key}>{val.icon} {val.label}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Time Range</label>
            <select
              value={filters.timeRange}
              onChange={(e) => setFilters(f => ({ ...f, timeRange: e.target.value }))}
            >
              <option value="1">Last 24 hours</option>
              <option value="3">Last 3 days</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div className="map-container">
        {loading && (
          <div className="map-loading">
            <div className="loading-spinner" />
            <span>Loading map...</span>
          </div>
        )}
        <div ref={mapRef} className="map" />

        {/* Map Controls */}
        <div className="map-controls">
          <button className="map-control-btn" onClick={handleCenterOnUser}>
            <Crosshair size={20} />
          </button>
        </div>

        {/* Report Button */}
        <button className="report-fab" onClick={() => setShowReportModal(true)}>
          <Plus size={24} />
          <span>REPORT</span>
        </button>
      </div>

      {/* Incident List */}
      <div className="incidents-section">
        <div className="section-header">
          <h2>
            <AlertTriangle size={18} />
            NEARBY INCIDENTS
          </h2>
          <span className="incident-count">{filteredIncidents.length}</span>
        </div>

        {filteredIncidents.length === 0 ? (
          <div className="no-incidents">
            <Shield size={32} />
            <p>No incidents reported nearby</p>
            <span>This area appears to be safe</span>
          </div>
        ) : (
          <div className="incidents-list">
            {filteredIncidents.slice(0, 10).map(incident => {
              const typeInfo = INCIDENT_TYPES[incident.type] || INCIDENT_TYPES.other
              return (
                <button
                  key={incident.id}
                  className="incident-card"
                  onClick={() => setShowIncidentDetail(incident)}
                >
                  <div className="incident-icon" style={{ background: typeInfo.color }}>
                    <span>{typeInfo.icon}</span>
                  </div>
                  <div className="incident-info">
                    <div className="incident-title">{incident.title}</div>
                    <div className="incident-meta">
                      <span className="incident-type">{typeInfo.label}</span>
                      <span className="incident-time">
                        <Clock size={12} />
                        {formatTimeAgo(incident.reported_at)}
                      </span>
                      {incident.distance && (
                        <span className="incident-distance">
                          <MapPin size={12} />
                          {formatDistance(incident.distance)}
                        </span>
                      )}
                    </div>
                  </div>
                  {incident.verified ? (
                    <div className="verified-badge">
                      <Check size={12} />
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Historical Pattern Info */}
      {safetyScore?.stats?.isNightTime && (
        <div className="historical-info">
          <TrendingUp size={18} />
          <div>
            <strong>Historical Pattern</strong>
            <p>Incident rates tend to be higher during nighttime hours in this area. Stay vigilant.</p>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal report-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Report Incident</h2>
              <button className="btn-ghost" onClick={() => setShowReportModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleReportSubmit}>
              <div className="form-group">
                <label>Incident Type</label>
                <div className="type-grid">
                  {Object.entries(INCIDENT_TYPES).map(([key, val]) => (
                    <button
                      key={key}
                      type="button"
                      className={`type-option ${reportForm.type === key ? 'selected' : ''}`}
                      onClick={() => setReportForm(f => ({ ...f, type: key }))}
                      style={{ '--type-color': val.color }}
                    >
                      <span className="type-icon">{val.icon}</span>
                      <span className="type-label">{val.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Severity</label>
                <div className="severity-options">
                  {SEVERITY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`severity-option ${reportForm.severity === opt.value ? 'selected' : ''}`}
                      onClick={() => setReportForm(f => ({ ...f, severity: opt.value }))}
                      style={{ '--severity-color': opt.color }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Brief description of the incident"
                  value={reportForm.title}
                  onChange={e => setReportForm(f => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Details (optional)</label>
                <textarea
                  className="input textarea"
                  placeholder="Additional details about the incident..."
                  value={reportForm.description}
                  onChange={e => setReportForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="location-preview">
                <MapPin size={16} />
                <span>Reporting at your current location</span>
              </div>

              <button
                type="submit"
                className="btn btn-danger btn-block"
                disabled={reporting || !reportForm.title.trim()}
              >
                {reporting ? 'Submitting...' : 'Submit Report'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Incident Detail Modal */}
      {showIncidentDetail && (
        <div className="modal-overlay" onClick={() => setShowIncidentDetail(null)}>
          <div className="modal incident-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="detail-type">
                <span className="detail-icon" style={{ 
                  background: INCIDENT_TYPES[showIncidentDetail.type]?.color 
                }}>
                  {INCIDENT_TYPES[showIncidentDetail.type]?.icon || '📍'}
                </span>
                <span>{INCIDENT_TYPES[showIncidentDetail.type]?.label || 'Incident'}</span>
              </div>
              <button className="btn-ghost" onClick={() => setShowIncidentDetail(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="detail-content">
              <h3>{showIncidentDetail.title}</h3>
              
              {showIncidentDetail.description && (
                <p className="detail-description">{showIncidentDetail.description}</p>
              )}

              <div className="detail-meta">
                <div className="meta-item">
                  <Clock size={16} />
                  <span>{formatTimeAgo(showIncidentDetail.reported_at)}</span>
                </div>
                {showIncidentDetail.distance && (
                  <div className="meta-item">
                    <MapPin size={16} />
                    <span>{formatDistance(showIncidentDetail.distance)}</span>
                  </div>
                )}
                <div className={`meta-item severity-${showIncidentDetail.severity}`}>
                  <AlertTriangle size={16} />
                  <span>{showIncidentDetail.severity?.toUpperCase()} SEVERITY</span>
                </div>
              </div>

              {showIncidentDetail.verified && (
                <div className="verified-banner">
                  <Check size={16} />
                  <span>Verified by community</span>
                </div>
              )}

              <div className="vote-section">
                <span className="vote-label">Is this report accurate?</span>
                <div className="vote-buttons">
                  <button
                    className={`vote-btn upvote ${showIncidentDetail.userVote === 'upvote' ? 'active' : ''}`}
                    onClick={() => handleVote(showIncidentDetail.id, 'upvote')}
                  >
                    <ThumbsUp size={18} />
                    <span>{showIncidentDetail.upvotes || 0}</span>
                  </button>
                  <button
                    className={`vote-btn downvote ${showIncidentDetail.userVote === 'downvote' ? 'active' : ''}`}
                    onClick={() => handleVote(showIncidentDetail.id, 'downvote')}
                  >
                    <ThumbsDown size={18} />
                    <span>{showIncidentDetail.downvotes || 0}</span>
                  </button>
                </div>
              </div>

              <button
                className="btn btn-outline btn-block"
                onClick={() => {
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.setView(
                      [showIncidentDetail.latitude, showIncidentDetail.longitude],
                      17
                    )
                  }
                  setShowIncidentDetail(null)
                }}
              >
                <Eye size={18} />
                View on Map
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Map, AlertTriangle, Shield, Clock, TrendingUp, TrendingDown,
  ChevronDown, ChevronUp, MapPin, Plus, X, Check, ThumbsUp, ThumbsDown,
  Bell, History, Activity, Eye, Navigation, RefreshCw, Loader, Info
} from 'lucide-react'
import api from '../services/api'
import './IncidentMapPage.css'

const INCIDENT_COLORS = {
  theft: '#ff9800',
  assault: '#f44336',
  robbery: '#d32f2f',
  harassment: '#e91e63',
  suspicious: '#9c27b0',
  vandalism: '#607d8b',
  accident: '#2196f3',
  fire: '#ff5722',
  medical: '#4caf50',
  other: '#757575'
}

const INCIDENT_ICONS = {
  theft: '💰',
  assault: '⚠️',
  robbery: '🚨',
  harassment: '😰',
  suspicious: '👀',
  vandalism: '🔨',
  accident: '🚗',
  fire: '🔥',
  medical: '🏥',
  other: '📍'
}

export default function IncidentMapPage() {
  const [location, setLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [safetyScore, setSafetyScore] = useState(null)
  const [historicalData, setHistoricalData] = useState(null)
  const [incidentTypes, setIncidentTypes] = useState({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('map')
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const [expandedAlerts, setExpandedAlerts] = useState(true)
  const [newIncident, setNewIncident] = useState({
    type: 'suspicious',
    title: '',
    description: '',
    severity: 'medium'
  })
  
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const userMarkerRef = useRef(null)

  // Get user location
  useEffect(() => {
    getCurrentLocation()
    loadIncidentTypes()
  }, [])

  // Load data when location is available
  useEffect(() => {
    if (location) {
      loadAllData()
    }
  }, [location])

  // Initialize map when location is available and tab is map
  useEffect(() => {
    if (location && activeTab === 'map' && mapRef.current && !mapInstanceRef.current) {
      initializeMap()
    }
  }, [location, activeTab])

  // Update map markers when incidents change
  useEffect(() => {
    if (mapInstanceRef.current && incidents.length > 0) {
      updateMapMarkers()
    }
  }, [incidents])

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser')
      setLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        })
        setLocationError(null)
      },
      (error) => {
        setLocationError('Unable to get your location. Please enable location services.')
        setLoading(false)
        // Use a default location for demo purposes
        setLocation({
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 100
        })
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  const loadIncidentTypes = async () => {
    try {
      const response = await api.getIncidentTypes()
      setIncidentTypes(response.types || {})
    } catch (err) {
      console.error('Failed to load incident types:', err)
    }
  }

  const loadAllData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        loadIncidents(),
        loadSafetyScore(),
        loadHistoricalData()
      ])
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  const refreshData = async () => {
    setRefreshing(true)
    await loadAllData()
    setRefreshing(false)
  }

  const loadIncidents = async () => {
    try {
      const response = await api.getNearbyIncidents(location.latitude, location.longitude, 5)
      setIncidents(response.incidents || [])
    } catch (err) {
      console.error('Failed to load incidents:', err)
    }
  }

  const loadSafetyScore = async () => {
    try {
      const response = await api.getSafetyScore(location.latitude, location.longitude)
      setSafetyScore(response)
    } catch (err) {
      console.error('Failed to load safety score:', err)
    }
  }

  const loadHistoricalData = async () => {
    try {
      const response = await api.getHistoricalData(location.latitude, location.longitude, 2)
      setHistoricalData(response)
    } catch (err) {
      console.error('Failed to load historical data:', err)
    }
  }

  const initializeMap = () => {
    // Create map using Leaflet (loaded via CDN in index.html)
    if (!window.L) {
      // Leaflet not loaded, add it dynamically
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)

      const script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = () => createMap()
      document.head.appendChild(script)
    } else {
      createMap()
    }
  }

  const createMap = () => {
    if (!window.L || !mapRef.current || mapInstanceRef.current) return

    const map = window.L.map(mapRef.current).setView(
      [location.latitude, location.longitude],
      15
    )

    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      maxZoom: 19
    }).addTo(map)

    // Add user location marker
    const userIcon = window.L.divIcon({
      className: 'user-marker',
      html: `<div class="user-marker-inner"><div class="user-marker-pulse"></div></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    })

    userMarkerRef.current = window.L.marker([location.latitude, location.longitude], { icon: userIcon })
      .addTo(map)
      .bindPopup('Your Location')

    // Add accuracy circle
    window.L.circle([location.latitude, location.longitude], {
      radius: location.accuracy || 50,
      color: '#2979ff',
      fillColor: '#2979ff',
      fillOpacity: 0.1,
      weight: 1
    }).addTo(map)

    mapInstanceRef.current = map
    updateMapMarkers()
  }

  const updateMapMarkers = () => {
    if (!mapInstanceRef.current || !window.L) return

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove())
    markersRef.current = []

    // Add incident markers
    incidents.forEach(incident => {
      const color = INCIDENT_COLORS[incident.type] || INCIDENT_COLORS.other
      const icon = INCIDENT_ICONS[incident.type] || INCIDENT_ICONS.other

      const markerIcon = window.L.divIcon({
        className: 'incident-marker',
        html: `
          <div class="incident-marker-inner" style="background: ${color}; border-color: ${color}">
            <span class="incident-marker-icon">${icon}</span>
          </div>
          ${incident.severity === 'critical' || incident.severity === 'high' ? '<div class="incident-marker-pulse" style="border-color: ' + color + '"></div>' : ''}
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      })

      const marker = window.L.marker([incident.latitude, incident.longitude], { icon: markerIcon })
        .addTo(mapInstanceRef.current)
        .on('click', () => setSelectedIncident(incident))

      const popupContent = `
        <div class="incident-popup">
          <strong>${incident.title}</strong>
          <p>${incident.typeInfo?.label || incident.type}</p>
          <small>${formatTimeAgo(incident.reported_at)}</small>
        </div>
      `
      marker.bindPopup(popupContent)

      markersRef.current.push(marker)
    })
  }

  const handleReportIncident = async () => {
    if (!newIncident.title || !location) return

    try {
      await api.reportIncident({
        ...newIncident,
        latitude: location.latitude,
        longitude: location.longitude,
        address: 'Current Location'
      })
      setShowReportModal(false)
      setNewIncident({ type: 'suspicious', title: '', description: '', severity: 'medium' })
      await loadIncidents()
      await loadSafetyScore()
    } catch (err) {
      console.error('Failed to report incident:', err)
    }
  }

  const handleVote = async (incidentId, vote) => {
    try {
      await api.updateIncident(incidentId, { vote })
      await loadIncidents()
    } catch (err) {
      console.error('Failed to vote:', err)
    }
  }

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = Math.floor((now - date) / 1000)

    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  const formatHour = (hour) => {
    if (hour === 0) return '12 AM'
    if (hour === 12) return '12 PM'
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`
  }

  const getScoreColor = (score) => {
    if (score >= 80) return 'var(--safe-primary)'
    if (score >= 60) return 'var(--warning-primary)'
    if (score >= 40) return '#ff9800'
    return 'var(--danger-primary)'
  }

  if (loading && !location) {
    return (
      <div className="page incident-map-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Getting your location...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page incident-map-page">
      <div className="page-header">
        <Map size={28} />
        <h1>SAFETY MAP</h1>
        <button className="btn-icon refresh-btn" onClick={refreshData} disabled={refreshing}>
          {refreshing ? <Loader size={20} className="spin" /> : <RefreshCw size={20} />}
        </button>
      </div>

      {locationError && (
        <div className="info-banner warning">
          <AlertTriangle size={18} />
          <span>{locationError}</span>
        </div>
      )}

      {/* Safety Score Card */}
      {safetyScore && (
        <div className={`safety-score-card ${safetyScore.riskColor}`}>
          <div className="score-main">
            <div className="score-circle" style={{ '--score-color': getScoreColor(safetyScore.score) }}>
              <svg viewBox="0 0 100 100">
                <circle
                  className="score-bg"
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  strokeWidth="8"
                />
                <circle
                  className="score-progress"
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  strokeWidth="8"
                  strokeDasharray={`${safetyScore.score * 2.83} 283`}
                  style={{ stroke: getScoreColor(safetyScore.score) }}
                />
              </svg>
              <div className="score-value">
                <span className="score-number">{safetyScore.score}</span>
                <span className="score-label">SAFETY</span>
              </div>
            </div>
            <div className="score-info">
              <h3 className={`risk-level ${safetyScore.riskColor}`}>{safetyScore.riskLevel}</h3>
              <div className="score-stats">
                <div className="stat">
                  <Activity size={14} />
                  <span>{safetyScore.recentIncidentCount} active nearby</span>
                </div>
                <div className="stat">
                  <History size={14} />
                  <span>{safetyScore.historicalIncidentCount} historical</span>
                </div>
              </div>
            </div>
          </div>

          {safetyScore.alerts && safetyScore.alerts.length > 0 && (
            <div className="alerts-section">
              <button 
                className="alerts-toggle"
                onClick={() => setExpandedAlerts(!expandedAlerts)}
              >
                <Bell size={16} />
                <span>{safetyScore.alerts.length} Alert{safetyScore.alerts.length > 1 ? 's' : ''}</span>
                {expandedAlerts ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {expandedAlerts && (
                <div className="alerts-list">
                  {safetyScore.alerts.map((alert, idx) => (
                    <div key={idx} className={`alert-item ${alert.severity}`}>
                      <AlertTriangle size={14} />
                      <span>{alert.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tab-nav">
        <button 
          className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
          onClick={() => setActiveTab('map')}
        >
          <Map size={18} />
          <span>Map</span>
        </button>
        <button 
          className={`tab-btn ${activeTab === 'incidents' ? 'active' : ''}`}
          onClick={() => setActiveTab('incidents')}
        >
          <AlertTriangle size={18} />
          <span>Incidents ({incidents.length})</span>
        </button>
        <button 
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={18} />
          <span>Patterns</span>
        </button>
      </div>

      {/* Map Tab */}
      {activeTab === 'map' && (
        <div className="map-container">
          <div ref={mapRef} className="incident-map" />
          <button className="report-fab" onClick={() => setShowReportModal(true)}>
            <Plus size={24} />
          </button>
          <div className="map-legend">
            <div className="legend-title">Incident Types</div>
            <div className="legend-items">
              {Object.entries(INCIDENT_ICONS).slice(0, 5).map(([type, icon]) => (
                <div key={type} className="legend-item">
                  <span className="legend-icon">{icon}</span>
                  <span className="legend-label">{incidentTypes[type]?.label || type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Incidents List Tab */}
      {activeTab === 'incidents' && (
        <div className="incidents-list">
          {incidents.length === 0 ? (
            <div className="empty-state">
              <Shield size={48} />
              <h3>No Active Incidents</h3>
              <p>No incidents reported in your area in the last 24 hours.</p>
            </div>
          ) : (
            incidents.map(incident => (
              <div 
                key={incident.id} 
                className={`incident-card ${incident.severity}`}
                onClick={() => setSelectedIncident(incident)}
              >
                <div className="incident-header">
                  <span className="incident-icon">{INCIDENT_ICONS[incident.type] || '📍'}</span>
                  <div className="incident-info">
                    <h4>{incident.title}</h4>
                    <span className="incident-type">{incident.typeInfo?.label || incident.type}</span>
                  </div>
                  <div className="incident-meta">
                    <span className={`severity-badge ${incident.severity}`}>{incident.severity}</span>
                    <span className="distance">{incident.distance}m</span>
                  </div>
                </div>
                {incident.description && (
                  <p className="incident-description">{incident.description}</p>
                )}
                <div className="incident-footer">
                  <span className="time">{formatTimeAgo(incident.reported_at)}</span>
                  <div className="vote-buttons">
                    <button 
                      className="vote-btn up"
                      onClick={(e) => { e.stopPropagation(); handleVote(incident.id, 'up') }}
                    >
                      <ThumbsUp size={14} />
                      <span>{incident.upvotes}</span>
                    </button>
                    <button 
                      className="vote-btn down"
                      onClick={(e) => { e.stopPropagation(); handleVote(incident.id, 'down') }}
                    >
                      <ThumbsDown size={14} />
                      <span>{incident.downvotes}</span>
                    </button>
                  </div>
                  {incident.verified && (
                    <span className="verified-badge">
                      <Check size={12} /> Verified
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
          <button className="btn btn-danger report-btn" onClick={() => setShowReportModal(true)}>
            <Plus size={18} />
            Report Incident
          </button>
        </div>
      )}

      {/* Historical Patterns Tab */}
      {activeTab === 'history' && historicalData && (
        <div className="history-tab">
          <div className="history-section">
            <h3 className="section-title">
              <Clock size={18} />
              HOURLY PATTERNS
            </h3>
            <p className="section-desc">Incident frequency by time of day in this area</p>
            <div className="hourly-chart">
              {historicalData.hourlyData.map((data, idx) => {
                const maxTotal = Math.max(...historicalData.hourlyData.map(d => d.total), 1)
                const height = (data.total / maxTotal) * 100
                const isNow = new Date().getHours() === idx
                return (
                  <div key={idx} className={`hour-bar ${isNow ? 'current' : ''}`}>
                    <div 
                      className="bar-fill"
                      style={{ 
                        height: `${Math.max(height, 5)}%`,
                        background: data.total > maxTotal * 0.7 ? 'var(--danger-primary)' : 
                                   data.total > maxTotal * 0.4 ? 'var(--warning-primary)' : 
                                   'var(--safe-primary)'
                      }}
                    />
                    <span className="hour-label">{idx % 6 === 0 ? formatHour(idx) : ''}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {historicalData.peakHours && historicalData.peakHours.length > 0 && (
            <div className="peak-hours">
              <h4>Peak Risk Hours</h4>
              <div className="peak-list">
                {historicalData.peakHours.filter(p => p.count > 0).map((peak, idx) => (
                  <div key={idx} className="peak-item">
                    <AlertTriangle size={14} />
                    <span>{formatHour(peak.hour)} - {formatHour((peak.hour + 1) % 24)}</span>
                    <span className="peak-count">{peak.count} incidents</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="history-section">
            <h3 className="section-title">
              <TrendingUp size={18} />
              DAILY PATTERNS
            </h3>
            <div className="daily-chart">
              {historicalData.dailyData.map((data, idx) => {
                const maxTotal = Math.max(...historicalData.dailyData.map(d => d.total), 1)
                const width = (data.total / maxTotal) * 100
                const isToday = new Date().getDay() === idx
                return (
                  <div key={idx} className={`day-row ${isToday ? 'current' : ''}`}>
                    <span className="day-name">{data.dayName.slice(0, 3)}</span>
                    <div className="day-bar-container">
                      <div 
                        className="day-bar-fill"
                        style={{ 
                          width: `${Math.max(width, 5)}%`,
                          background: data.total > maxTotal * 0.7 ? 'var(--danger-primary)' : 
                                     data.total > maxTotal * 0.4 ? 'var(--warning-primary)' : 
                                     'var(--safe-primary)'
                        }}
                      />
                    </div>
                    <span className="day-count">{data.total}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {historicalData.commonTypes && historicalData.commonTypes.length > 0 && (
            <div className="history-section">
              <h3 className="section-title">
                <Eye size={18} />
                COMMON INCIDENTS
              </h3>
              <div className="type-list">
                {historicalData.commonTypes.map((type, idx) => (
                  <div key={idx} className="type-item">
                    <span className="type-icon">{INCIDENT_ICONS[type.type] || '📍'}</span>
                    <span className="type-label">{type.label}</span>
                    <span className="type-count">{type.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {historicalData.totalHistoricalIncidents === 0 && (
            <div className="empty-state">
              <Shield size={48} />
              <h3>No Historical Data</h3>
              <p>Not enough incident data in this area to show patterns.</p>
            </div>
          )}
        </div>
      )}

      {/* Report Incident Modal */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">REPORT INCIDENT</h2>
            
            <div className="form-group">
              <label className="label">Incident Type</label>
              <div className="type-grid">
                {Object.entries(incidentTypes).map(([key, type]) => (
                  <button
                    key={key}
                    className={`type-btn ${newIncident.type === key ? 'active' : ''}`}
                    onClick={() => setNewIncident({ ...newIncident, type: key })}
                  >
                    <span className="type-emoji">{INCIDENT_ICONS[key] || '📍'}</span>
                    <span>{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="label">Title</label>
              <input
                type="text"
                className="input"
                value={newIncident.title}
                onChange={e => setNewIncident({ ...newIncident, title: e.target.value })}
                placeholder="Brief description of what happened"
              />
            </div>

            <div className="form-group">
              <label className="label">Details (Optional)</label>
              <textarea
                className="input textarea"
                value={newIncident.description}
                onChange={e => setNewIncident({ ...newIncident, description: e.target.value })}
                placeholder="Additional details..."
                rows={3}
              />
            </div>

            <div className="form-group">
              <label className="label">Severity</label>
              <div className="severity-options">
                {['low', 'medium', 'high', 'critical'].map(sev => (
                  <button
                    key={sev}
                    className={`severity-btn ${sev} ${newIncident.severity === sev ? 'active' : ''}`}
                    onClick={() => setNewIncident({ ...newIncident, severity: sev })}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            <div className="location-info">
              <MapPin size={16} />
              <span>Reporting at your current location</span>
            </div>

            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowReportModal(false)}>
                Cancel
              </button>
              <button 
                className="btn btn-danger" 
                onClick={handleReportIncident}
                disabled={!newIncident.title}
              >
                Report Incident
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <div className="modal-overlay" onClick={() => setSelectedIncident(null)}>
          <div className="modal incident-detail" onClick={e => e.stopPropagation()}>
            <div className="incident-detail-header">
              <span className="detail-icon">{INCIDENT_ICONS[selectedIncident.type] || '📍'}</span>
              <div>
                <h2>{selectedIncident.title}</h2>
                <span className="detail-type">{selectedIncident.typeInfo?.label || selectedIncident.type}</span>
              </div>
              <button className="close-btn" onClick={() => setSelectedIncident(null)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="detail-badges">
              <span className={`severity-badge ${selectedIncident.severity}`}>
                {selectedIncident.severity}
              </span>
              <span className="status-badge">{selectedIncident.status}</span>
              {selectedIncident.verified && (
                <span className="verified-badge">
                  <Check size={12} /> Verified
                </span>
              )}
            </div>

            {selectedIncident.description && (
              <p className="detail-description">{selectedIncident.description}</p>
            )}

            <div className="detail-info">
              <div className="detail-row">
                <Clock size={16} />
                <span>Reported {formatTimeAgo(selectedIncident.reported_at)}</span>
              </div>
              <div className="detail-row">
                <Navigation size={16} />
                <span>{selectedIncident.distance}m from your location</span>
              </div>
              {selectedIncident.address && (
                <div className="detail-row">
                  <MapPin size={16} />
                  <span>{selectedIncident.address}</span>
                </div>
              )}
            </div>

            <div className="detail-votes">
              <span>Is this report accurate?</span>
              <div className="vote-buttons large">
                <button 
                  className="vote-btn up"
                  onClick={() => handleVote(selectedIncident.id, 'up')}
                >
                  <ThumbsUp size={18} />
                  <span>{selectedIncident.upvotes}</span>
                </button>
                <button 
                  className="vote-btn down"
                  onClick={() => handleVote(selectedIncident.id, 'down')}
                >
                  <ThumbsDown size={18} />
                  <span>{selectedIncident.downvotes}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

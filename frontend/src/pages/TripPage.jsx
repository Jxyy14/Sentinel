import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Navigation, MapPin, Clock, Users, AlertTriangle, CheckCircle,
    Play, Square, Share2, Bell, ChevronRight, Trash2, Plus
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { callSafetyContacts, CallReasons } from '../services/safetyContactCalls'
import './TripPage.css'

export default function TripPage() {
    const navigate = useNavigate()
    const { settings } = useAuth()

    const [activeTrip, setActiveTrip] = useState(null)
    const [trips, setTrips] = useState([])
    const [contacts, setContacts] = useState([])
    const [showNewTrip, setShowNewTrip] = useState(false)
    const [loading, setLoading] = useState(true)

    // New trip form
    const [destination, setDestination] = useState('')
    const [expectedMinutes, setExpectedMinutes] = useState(30)
    const [selectedContacts, setSelectedContacts] = useState([])
    const [bufferMinutes, setBufferMinutes] = useState(10)
    const [showCustomExpected, setShowCustomExpected] = useState(false)
    const [showCustomBuffer, setShowCustomBuffer] = useState(false)
    const [customExpected, setCustomExpected] = useState('')
    const [customBuffer, setCustomBuffer] = useState('')

    useEffect(() => {
        loadData()
        checkActiveTrip()
    }, [])

    const loadData = async () => {
        try {
            const contactsRes = await api.getContacts()
            setContacts(contactsRes.contacts || [])

            // Load trip history from localStorage for now
            const storedTrips = localStorage.getItem('tripHistory')
            if (storedTrips) {
                setTrips(JSON.parse(storedTrips))
            }
        } catch (err) {
            console.error('Failed to load data:', err)
        } finally {
            setLoading(false)
        }
    }

    const checkActiveTrip = () => {
        const stored = localStorage.getItem('activeTrip')
        if (stored) {
            const trip = JSON.parse(stored)
            if (new Date(trip.expectedArrival) > new Date()) {
                setActiveTrip(trip)
            } else {
                // Trip expired - trigger alert if not arrived
                if (!trip.arrived) {
                    handleTripExpired(trip)
                }
                localStorage.removeItem('activeTrip')
            }
        }
    }

    const handleTripExpired = async (trip) => {
        // Call safety contacts instead of starting recording
        console.log('Trip expired without arrival confirmation:', trip)
        try {
            // Get user's location
            let location = null
            try {
                const position = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 5000
                    })
                })
                const lat = position.coords.latitude
                const lng = position.coords.longitude
                let address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
                try {
                    const geoResponse = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
                    )
                    const geoData = await geoResponse.json()
                    if (geoData.display_name) address = geoData.display_name
                } catch (e) {}
                location = { lat, lng, address }
            } catch (e) {
                location = { address: 'Location unknown' }
            }

            await callSafetyContacts({
                reason: `${CallReasons.TRIP_EXPIRED}. Trip to ${trip.destination || 'destination'} expected ${trip.expectedMinutes || 30} minutes ago.`,
                location,
                additionalInfo: `Expected arrival time was ${new Date(trip.expectedArrival).toLocaleTimeString()}. User has not confirmed arrival.`
            })
        } catch (error) {
            console.error('Failed to call safety contacts on trip expiration:', error)
        }
    }

    const startTrip = () => {
        if (!destination.trim()) return

        const now = new Date()
        const expectedArrival = new Date(now.getTime() + expectedMinutes * 60 * 1000)
        const alertTime = new Date(expectedArrival.getTime() + bufferMinutes * 60 * 1000)

        const newTrip = {
            id: Date.now(),
            destination: destination.trim(),
            startTime: now.toISOString(),
            expectedArrival: expectedArrival.toISOString(),
            alertTime: alertTime.toISOString(),
            expectedMinutes,
            bufferMinutes,
            sharedWith: selectedContacts,
            status: 'active',
            arrived: false
        }

        localStorage.setItem('activeTrip', JSON.stringify(newTrip))
        setActiveTrip(newTrip)
        closeTripModal()

        // Start countdown timer
        scheduleAlerts(newTrip)
    }

    const closeTripModal = () => {
        setShowNewTrip(false)
        setDestination('')
        setSelectedContacts([])
        setExpectedMinutes(30)
        setBufferMinutes(10)
        setShowCustomExpected(false)
        setShowCustomBuffer(false)
        setCustomExpected('')
        setCustomBuffer('')
    }

    const scheduleAlerts = (trip) => {
        const timeUntilExpected = new Date(trip.expectedArrival).getTime() - Date.now()
        const timeUntilAlert = new Date(trip.alertTime).getTime() - Date.now()

        // Reminder at expected arrival time
        if (timeUntilExpected > 0) {
            setTimeout(() => {
                if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200])
                }
                // Show notification
            }, timeUntilExpected)
        }

        // Alert contacts if no check-in by alert time
        if (timeUntilAlert > 0) {
            setTimeout(async () => {
                const currentTrip = localStorage.getItem('activeTrip')
                if (currentTrip) {
                    const parsed = JSON.parse(currentTrip)
                    if (!parsed.arrived) {
                        // Call safety contacts instead of starting recording
                        handleTripExpired(parsed)
                    }
                }
            }, timeUntilAlert)
        }
    }

    const confirmArrival = () => {
        if (!activeTrip) return

        const completedTrip = {
            ...activeTrip,
            arrived: true,
            arrivalTime: new Date().toISOString(),
            status: 'completed'
        }

        // Save to history
        const history = [...trips, completedTrip]
        setTrips(history)
        localStorage.setItem('tripHistory', JSON.stringify(history))

        // Clear active trip
        localStorage.removeItem('activeTrip')
        setActiveTrip(null)

        // Track for safety score
        const count = parseInt(localStorage.getItem('tripCount') || '0')
        localStorage.setItem('tripCount', (count + 1).toString())
    }

    const cancelTrip = () => {
        localStorage.removeItem('activeTrip')
        setActiveTrip(null)
    }

    const toggleContact = (contactId) => {
        setSelectedContacts(prev =>
            prev.includes(contactId)
                ? prev.filter(id => id !== contactId)
                : [...prev, contactId]
        )
    }

    const formatTime = (dateString) => {
        return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString([], { month: 'short', day: 'numeric' })
    }

    const getTimeRemaining = () => {
        if (!activeTrip) return null
        const remaining = new Date(activeTrip.expectedArrival).getTime() - Date.now()
        if (remaining <= 0) return 'Overdue'

        const mins = Math.floor(remaining / 60000)
        if (mins < 60) return `${mins} min`
        const hours = Math.floor(mins / 60)
        return `${hours}h ${mins % 60}m`
    }

    if (loading) {
        return (
            <div className="page flex-center" style={{ minHeight: '50vh' }}>
                <div className="loading-spinner" />
            </div>
        )
    }

    return (
        <div className="page trip-page">
            <div className="page-header">
                <Navigation size={28} />
                <h1>TRIP TRACKER</h1>
            </div>

            {activeTrip ? (
                <div className="active-trip-card">
                    <div className="trip-status">
                        <span className="status-badge active">
                            <span className="pulse-dot" />
                            ACTIVE TRIP
                        </span>
                        <span className="time-remaining">{getTimeRemaining()}</span>
                    </div>

                    <div className="trip-destination">
                        <MapPin size={20} />
                        <span>{activeTrip.destination}</span>
                    </div>

                    <div className="trip-times">
                        <div className="time-item">
                            <span className="time-label">Started</span>
                            <span className="time-value">{formatTime(activeTrip.startTime)}</span>
                        </div>
                        <div className="time-item">
                            <span className="time-label">Expected</span>
                            <span className="time-value">{formatTime(activeTrip.expectedArrival)}</span>
                        </div>
                        <div className="time-item">
                            <span className="time-label">Alert at</span>
                            <span className="time-value danger">{formatTime(activeTrip.alertTime)}</span>
                        </div>
                    </div>

                    {activeTrip.sharedWith.length > 0 && (
                        <div className="trip-shared">
                            <Users size={16} />
                            <span>Shared with {activeTrip.sharedWith.length} contact(s)</span>
                        </div>
                    )}

                    <div className="trip-actions">
                        <button className="btn btn-safe" onClick={confirmArrival}>
                            <CheckCircle size={18} />
                            I'VE ARRIVED SAFELY
                        </button>
                        <button className="btn btn-outline" onClick={cancelTrip}>
                            <Square size={18} />
                            CANCEL TRIP
                        </button>
                    </div>

                    <div className="info-banner warning" style={{ marginTop: '16px' }}>
                        <AlertTriangle size={16} />
                        <span>If you don't confirm arrival by {formatTime(activeTrip.alertTime)}, your emergency contacts will be notified automatically.</span>
                    </div>
                </div>
            ) : showNewTrip ? (
                <div className="new-trip-form">
                    <h3>NEW TRIP</h3>

                    <div className="form-group">
                        <label className="label">DESTINATION</label>
                        <input
                            type="text"
                            className="input"
                            placeholder="Where are you going?"
                            value={destination}
                            onChange={(e) => setDestination(e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label className="label">EXPECTED TRAVEL TIME</label>
                        <div className="time-options">
                            {[15, 30, 45, 60, 90, 120].map(mins => (
                                <button
                                    key={mins}
                                    className={`option-btn ${expectedMinutes === mins && !showCustomExpected ? 'active' : ''}`}
                                    onClick={() => {
                                        setShowCustomExpected(false)
                                        setExpectedMinutes(mins)
                                    }}
                                >
                                    {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                                </button>
                            ))}
                            <button
                                className={`option-btn custom ${showCustomExpected ? 'active' : ''}`}
                                onClick={() => {
                                    setShowCustomExpected(true)
                                    if (customExpected) {
                                        setExpectedMinutes(parseInt(customExpected) || 30)
                                    }
                                }}
                            >
                                Custom
                            </button>
                        </div>
                        {showCustomExpected && (
                            <div className="custom-input-group">
                                <input
                                    type="number"
                                    min="1"
                                    max="1440"
                                    placeholder="Minutes"
                                    value={customExpected}
                                    onChange={(e) => {
                                        const val = e.target.value
                                        setCustomExpected(val)
                                        const minutes = parseInt(val) || 0
                                        if (minutes > 0) {
                                            setExpectedMinutes(minutes)
                                        }
                                    }}
                                    className="custom-time-input"
                                />
                                <span className="input-hint">minutes (1-1440)</span>
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="label">BUFFER TIME (before alert)</label>
                        <div className="time-options">
                            {[5, 10, 15, 30].map(mins => (
                                <button
                                    key={mins}
                                    className={`option-btn ${bufferMinutes === mins && !showCustomBuffer ? 'active' : ''}`}
                                    onClick={() => {
                                        setShowCustomBuffer(false)
                                        setBufferMinutes(mins)
                                    }}
                                >
                                    +{mins}m
                                </button>
                            ))}
                            <button
                                className={`option-btn custom ${showCustomBuffer ? 'active' : ''}`}
                                onClick={() => {
                                    setShowCustomBuffer(true)
                                    if (customBuffer) {
                                        setBufferMinutes(parseInt(customBuffer) || 10)
                                    }
                                }}
                            >
                                Custom
                            </button>
                        </div>
                        {showCustomBuffer && (
                            <div className="custom-input-group">
                                <input
                                    type="number"
                                    min="1"
                                    max="120"
                                    placeholder="Minutes"
                                    value={customBuffer}
                                    onChange={(e) => {
                                        const val = e.target.value
                                        setCustomBuffer(val)
                                        const minutes = parseInt(val) || 0
                                        if (minutes > 0) {
                                            setBufferMinutes(minutes)
                                        }
                                    }}
                                    className="custom-time-input"
                                />
                                <span className="input-hint">minutes (1-120)</span>
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="label">SHARE WITH CONTACTS</label>
                        <div className="contact-list">
                            {contacts.length === 0 ? (
                                <p className="text-muted">No contacts added yet</p>
                            ) : (
                                contacts.map(contact => (
                                    <button
                                        key={contact.id}
                                        className={`contact-item ${selectedContacts.includes(contact.id) ? 'selected' : ''}`}
                                        onClick={() => toggleContact(contact.id)}
                                    >
                                        <span>{contact.name}</span>
                                        {selectedContacts.includes(contact.id) && <CheckCircle size={16} />}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="form-actions">
                        <button className="btn btn-outline" onClick={closeTripModal}>
                            CANCEL
                        </button>
                        <button
                            className="btn btn-danger"
                            onClick={startTrip}
                            disabled={!destination.trim()}
                        >
                            <Play size={18} />
                            START TRIP
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <button className="start-trip-btn" onClick={() => setShowNewTrip(true)}>
                        <div className="btn-content">
                            <Navigation size={32} />
                            <span className="btn-title">START A TRIP</span>
                            <span className="btn-desc">Track your journey and auto-alert if you don't arrive</span>
                        </div>
                        <ChevronRight size={24} />
                    </button>

                    <div className="info-banner info" style={{ marginTop: '16px' }}>
                        <Bell size={16} />
                        <span>Trip tracking automatically alerts your emergency contacts if you don't confirm arrival on time.</span>
                    </div>
                </>
            )}

            {trips.length > 0 && !showNewTrip && (
                <section className="trip-history">
                    <h3 className="section-title">RECENT TRIPS</h3>
                    {trips.slice(-5).reverse().map(trip => (
                        <div key={trip.id} className="history-item">
                            <div className="history-info">
                                <MapPin size={16} />
                                <div>
                                    <span className="history-dest">{trip.destination}</span>
                                    <span className="history-date">{formatDate(trip.startTime)}</span>
                                </div>
                            </div>
                            <span className={`history-status ${trip.arrived ? 'arrived' : 'missed'}`}>
                                {trip.arrived ? 'Arrived' : 'Missed'}
                            </span>
                        </div>
                    ))}
                </section>
            )}
        </div>
    )
}

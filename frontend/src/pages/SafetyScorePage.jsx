import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Award, CheckCircle, Users, Heart, MapPin, Video, Shield, Zap, ArrowLeft, AlertTriangle } from 'lucide-react'
import api from '../services/api'
import './SafetyScorePage.css'

const achievements = [
    {
        id: 'contacts',
        label: 'Emergency Contacts',
        description: 'Add at least 2 emergency contacts',
        icon: Users,
        points: 20,
        check: (data) => data.contacts >= 2,
        action: '/contacts',
        actionLabel: 'Add Contacts'
    },
    {
        id: 'medical',
        label: 'Medical Profile',
        description: 'Complete your medical information',
        icon: Heart,
        points: 15,
        check: (data) => data.hasMedical,
        action: '/medical',
        actionLabel: 'Update Medical ID'
    },
    {
        id: 'location',
        label: 'Safe Locations',
        description: 'Set up safe zones (Home/Work)',
        icon: MapPin,
        points: 15,
        check: (data) => data.safeLocations >= 1,
        action: '/location',
        actionLabel: 'Manage Locations'
    },
    {
        id: 'practice',
        label: 'Practice Run',
        description: 'Test the SOS feature in practice mode',
        icon: Video,
        points: 20,
        check: (data) => data.practiceRuns >= 1,
        action: '/settings', // Placeholder
        actionLabel: 'Go to Settings'
    },
    {
        id: 'checkin',
        label: 'Check-In System',
        description: 'Use the Check-In feature at least once',
        icon: Shield,
        points: 15,
        check: (data) => data.checkIns >= 1,
        action: '/safety?tab=checkin',
        actionLabel: 'Try Check-In'
    },
    {
        id: 'trip',
        label: 'Trip Monitoring',
        description: 'Complete a monitored trip',
        icon: Zap,
        points: 15,
        check: (data) => data.trips >= 1,
        action: '/trip',
        actionLabel: 'Start Trip'
    }
]

export default function SafetyScorePage() {
    const navigate = useNavigate()
    const [score, setScore] = useState(0)
    const [data, setData] = useState({
        contacts: 0,
        hasMedical: false,
        safeLocations: 0,
        practiceRuns: 0,
        checkIns: 0,
        trips: 0
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            const [contactsRes, medicalRes] = await Promise.all([
                api.getContacts().catch(() => ({ contacts: [] })),
                api.getMedicalInfo().catch(() => null)
            ])

            const safetyData = {
                contacts: contactsRes.contacts?.length || 0,
                hasMedical: !!medicalRes?.medical,
                safeLocations: 0, // Placeholder
                practiceRuns: 0, // Placeholder
                checkIns: parseInt(localStorage.getItem('checkInCount') || '0'),
                trips: 0 // Placeholder
            }

            setData(safetyData)
            calculateScore(safetyData)
        } catch (error) {
            console.error('Failed to load safety data:', error)
        } finally {
            setLoading(false)
        }
    }

    const calculateScore = (safetyData) => {
        let totalScore = 0
        for (const achievement of achievements) {
            if (achievement.check(safetyData)) {
                totalScore += achievement.points
            }
        }
        setScore(totalScore)
    }

    const getScoreColor = () => {
        if (score >= 80) return 'var(--safe-primary)'
        if (score >= 50) return 'var(--warning-primary)'
        return 'var(--danger-primary)'
    }

    const getScoreLabel = () => {
        if (score >= 80) return 'Excellent'
        if (score >= 50) return 'Good'
        if (score >= 25) return 'Fair'
        return 'Needs Work'
    }

    if (loading) {
        return (
            <div className="page flex-center">
                <div className="loading-spinner" />
            </div>
        )
    }

    return (
        <div className="page safety-score-page">
            <div className="page-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={24} />
                </button>
                <h1>SAFETY SCORE</h1>
            </div>

            <div className="score-hero">
                <div className="score-circle-container">
                    <svg className="score-ring-svg" viewBox="0 0 120 120">
                        <circle
                            className="score-ring-bg"
                            cx="60"
                            cy="60"
                            r="52"
                            fill="none"
                            strokeWidth="8"
                        />
                        <circle
                            className="score-ring-progress"
                            cx="60"
                            cy="60"
                            r="52"
                            fill="none"
                            strokeWidth="8"
                            strokeDasharray={`${(score / 100) * 327} 327`}
                            style={{ stroke: getScoreColor() }}
                        />
                    </svg>
                    <div className="score-inner">
                        <div className="score-value-large" style={{ color: getScoreColor() }}>{score}</div>
                        <div className="score-label-large">{getScoreLabel()}</div>
                    </div>
                </div>
                <p className="score-description">
                    Your safety score reflects your preparedness. Complete the tasks below to improve your rating.
                </p>
            </div>

            <div className="achievements-grid">
                {achievements.map(achievement => {
                    const isCompleted = achievement.check(data)
                    return (
                        <div
                            key={achievement.id}
                            className={`achievement-card ${isCompleted ? 'completed' : ''}`}
                        >
                            <div className="achievement-header">
                                <div className="achievement-icon-wrapper">
                                    <achievement.icon size={20} />
                                </div>
                                <div className="achievement-points-badge">+{achievement.points}</div>
                            </div>
                            <h3 className="achievement-title">{achievement.label}</h3>
                            <p className="achievement-desc">{achievement.description}</p>

                            {isCompleted ? (
                                <div className="achievement-status completed">
                                    <CheckCircle size={16} />
                                    <span>Completed</span>
                                </div>
                            ) : (
                                <button
                                    className="achievement-action-btn"
                                    onClick={() => navigate(achievement.action)}
                                >
                                    {achievement.actionLabel}
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

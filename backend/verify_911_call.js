import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })

const JWT_SECRET = process.env.JWT_SECRET || 'safestream-secret-key-change-in-production'
const PORT = process.env.PORT || 3001

// Generate token for User 1
const token = jwt.sign(
    { id: 1, email: 'jaffer@example.com' },
    JWT_SECRET,
    { expiresIn: '1h' }
)

console.log('--- Verifying 911 Call ---')
console.log(`Target URL: http://localhost:${PORT}/api/emergency/call`)

try {
    const response = await fetch(`http://localhost:${PORT}/api/emergency/call`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            location: { lat: 43.6532, lng: -79.3832, address: 'Toronto, ON' },
            situation: 'Test 911 Call Verification'
        })
    })

    const data = await response.json()
    console.log('Response Status:', response.status)
    console.log('Response Data:', JSON.stringify(data, null, 2))
} catch (error) {
    console.error('Request failed:', error.message)
}

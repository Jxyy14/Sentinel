import express from 'express'
import { generateSpeech } from '../services/elevenlabs.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

router.post('/generate', authenticateToken, async (req, res) => {
    try {
        const { text, voiceId } = req.body
        const fileName = await generateSpeech(text, voiceId)

        if (!fileName) {
            return res.json({ url: null, mock: true, message: 'ElevenLabs API key missing' })
        }

        const url = `/uploads/${fileName}`
        res.json({ url, mock: false })
    } catch (error) {
        console.error('Voice generation error:', error)
        res.status(500).json({ error: 'Failed to generate voice' })
    }
})

export default router

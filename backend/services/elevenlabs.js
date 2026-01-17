import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = path.join(__dirname, '../uploads')

export const generateSpeech = async (text, voiceId = '21m00Tcm4TlvDq8ikWAM') => {
    try {
        const apiKey = process.env.ELEVENLABS_KEY
        if (!apiKey) {
            console.log('ElevenLabs key missing, using mock')
            return null
        }

        const response = await axios.post(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
                text,
                model_id: 'eleven_monolingual_v1',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.5
                }
            },
            {
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer'
            }
        )

        const fileName = `${uuidv4()}.mp3`
        const filePath = path.join(UPLOADS_DIR, fileName)

        fs.writeFileSync(filePath, response.data)
        return fileName
    } catch (error) {
        console.error('ElevenLabs generation error:', error.message)
        return null
    }
}

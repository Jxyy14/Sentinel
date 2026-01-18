import 'dotenv/config'
import { TwelveLabs } from 'twelvelabs-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import twilio from 'twilio'

console.log('🔍 Starting API Integration Verification...\n')

async function verifyTwelveLabs() {
    console.log('Testing TwelveLabs...')
    try {
        const client = new TwelveLabs({ apiKey: process.env.TWELVELABS_KEY })
        // Try listing tasks
        if (client.tasks) {
            const tasks = await client.tasks.list({ page: 1, page_limit: 1 })
            console.log('✅ TwelveLabs Success: Connected and listed tasks', tasks.data ? tasks.data.length : 0)
        } else {
            console.log('⚠️ TwelveLabs: client.tasks is undefined. Client keys:', Object.keys(client))
        }
    } catch (error) {
        console.error('❌ TwelveLabs Error:', error.message)
    }
}

async function verifyGemini() {
    console.log('\nTesting Gemini AI...')
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
        // List models
        /*
        // Note: listModels is not directly available on genAI instance in some versions, 
        // usually it's via API call or specific method. 
        // Let's try a known stable model 'gemini-pro' first if flash fails.
        */
        console.log('Attempting with gemma-3-4b-it...')
        const model = genAI.getGenerativeModel({ model: "gemma-3-4b-it" })
        const result = await model.generateContent("Hello")
        const response = await result.response
        console.log('✅ Gemini Success: Generated response with gemma-3-4b-it', response.text().substring(0, 20) + '...')
    } catch (error) {
        console.error('❌ Gemini Error (gemma-3-4b-it):', error.message)

        // Try listing models via fetch if SDK fails
        try {
            console.log('Fetching available models via REST...')
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`)
            const data = await response.json()
            if (data.models) {
                console.log('Available Models:', data.models.map(m => m.name))
            } else {
                console.log('Failed to list models:', data)
            }
        } catch (e) {
            console.error('Failed to fetch models:', e.message)
        }
    }
}

async function verifyTwilio() {
    console.log('\nTesting Twilio...')
    try {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
        const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch()
        console.log('✅ Twilio Success: Authenticated as', account.friendlyName)
    } catch (error) {
        console.error('❌ Twilio Error:', error.message)
    }
}

async function verifyElevenLabs() {
    console.log('\nTesting ElevenLabs...')
    try {
        const response = await fetch('https://api.elevenlabs.io/v1/user', {
            headers: {
                'xi-api-key': process.env.ELEVENLABS_API_KEY
            }
        })

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        console.log('✅ ElevenLabs Success: Authenticated as', data.subscription.tier)
    } catch (error) {
        console.error('❌ ElevenLabs Error:', error.message)
    }
}

async function run() {
    await verifyTwelveLabs()
    await verifyGemini()
    await verifyTwilio()
    await verifyElevenLabs()
    console.log('\n🏁 Verification Complete')
}

run()

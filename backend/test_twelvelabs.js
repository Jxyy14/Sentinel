import axios from 'axios'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })

const API_KEY = process.env.TWELVELABS_KEY

console.log('Testing TwelveLabs Connection...')
console.log('API Key:', API_KEY ? 'Present' : 'Missing')

async function testConnection() {
    const versions = ['v1.1', 'v1.2']

    for (const v of versions) {
        console.log(`\nTesting ${v}...`)
        try {
            const res = await axios.get(`https://api.twelvelabs.io/${v}/indexes`, {
                headers: { 'x-api-key': API_KEY }
            })
            console.log(`✅ ${v} Success! Indexes:`, res.data.data.length)
            res.data.data.forEach(i => console.log(` - ${i.index_name} (${i._id})`))
        } catch (error) {
            console.log(`❌ ${v} Failed:`, error.response?.status, error.response?.statusText)
            if (error.response?.data) console.log('   Error:', error.response.data)
        }
    }
}

testConnection()

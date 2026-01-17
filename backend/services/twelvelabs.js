import { TwelveLabs } from 'twelvelabs-js'
import fs from 'fs'

const apiKey = process.env.TWELVELABS_KEY
const client = apiKey ? new TwelveLabs({ apiKey }) : null

export const indexVideo = async (filePath, recordingId) => {
    try {
        if (!client) {
            console.log('TwelveLabs key missing, skipping indexing')
            return null
        }
        const indexId = process.env.TWELVELABS_INDEX_ID
        if (!indexId) {
            console.log('TwelveLabs Index ID missing')
            return null
        }

        console.log(`Indexing video for recording ${recordingId}...`)

        const task = await client.task.create({
            indexId,
            file: fs.createReadStream(filePath),
            language: 'en'
        })

        console.log('TwelveLabs task created:', task.id)
        return task.id
    } catch (error) {
        console.error('TwelveLabs indexing error:', error.message)
        return null
    }
}

export const getTaskStatus = async (taskId) => {
    try {
        if (!client) return null
        const task = await client.task.retrieve(taskId)

        // Map SDK status to our expected format
        // SDK usually returns status: 'pending', 'indexing', 'ready', 'failed'
        return {
            status: task.status,
            video_id: task.videoId // SDK usually provides this when ready
        }
    } catch (error) {
        console.error('TwelveLabs status error:', error.message)
        return null
    }
}

export const searchVideo = async (indexId, query) => {
    try {
        if (!client) return null

        const results = await client.search.query({
            indexId,
            queryText: query,
            options: ['visual', 'conversation']
        })

        // Map SDK results to our expected format (array of { start, end, score })
        return {
            data: results.data.map(item => ({
                start: item.start,
                end: item.end,
                score: item.score
            }))
        }
    } catch (error) {
        console.error('TwelveLabs search error:', error.message)
        return null
    }
}

export const generateSummary = async (videoId) => {
    try {
        if (!client) return null

        const result = await client.generate.text({
            videoId,
            prompt: "Generate a detailed description of what is happening in this video, focusing on any threats, weapons, or aggressive behavior. Provide a chronological summary."
        })

        return { summary: result.data }
    } catch (error) {
        console.error('TwelveLabs generate error:', error.message)
        return null
    }
}

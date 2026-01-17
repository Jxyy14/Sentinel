import twilio from 'twilio'

let client = null

const initClient = () => {
    if (!client && process.env.TWILIO_SID && process.env.TWILIO_TOKEN) {
        client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN)
    }
    return client
}

export const makeCall = async (to, messageUrl) => {
    const c = initClient()
    if (!c) {
        console.log('Twilio not configured, mocking call to', to)
        return { sid: 'mock-sid', status: 'queued' }
    }

    try {
        const call = await c.calls.create({
            url: messageUrl || 'http://demo.twilio.com/docs/voice.xml',
            to: to,
            from: process.env.TWILIO_PHONE_NUMBER
        })
        return call
    } catch (error) {
        console.error('Twilio call error:', error.message)
        throw error
    }
}

export const sendSms = async (to, body) => {
    const c = initClient()
    if (!c) {
        console.log('Twilio not configured, mocking SMS to', to)
        return { sid: 'mock-sid', status: 'sent' }
    }

    try {
        const message = await c.messages.create({
            body: body,
            to: to,
            from: process.env.TWILIO_PHONE_NUMBER
        })
        return message
    } catch (error) {
        console.error('Twilio SMS error:', error.message)
        throw error
    }
}

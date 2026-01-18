import db from './database.js'

console.log('--- Debugging Trip Tracker Contacts ---')

const users = db.prepare('SELECT * FROM users').all()
console.log(`Found ${users.length} users.`)

for (const user of users) {
    console.log(`\nUser: ${user.name} (ID: ${user.id}, Phone: ${user.phone})`)

    const contacts = db.prepare('SELECT * FROM contacts WHERE user_id = ?').all(user.id)
    console.log(`Total Contacts: ${contacts.length}`)

    const emergencyContacts = contacts.filter(c => c.notify_on_stream === 1 || c.type === 'emergency')
    console.log(`Emergency Contacts (notify_on_stream=1 OR type='emergency'): ${emergencyContacts.length}`)

    emergencyContacts.forEach(c => {
        console.log(`  - ${c.name}: ${c.phone} (Type: ${c.type}, Notify: ${c.notify_on_stream})`)
    })

    if (emergencyContacts.length === 0) {
        console.log('  WARNING: No contacts will be called for this user!')
    }
}

import db from './database.js'

try {
    db.exec("ALTER TABLE recordings ADD COLUMN twelvelabs_task_id TEXT")
    console.log("Added twelvelabs_task_id column")
} catch (e) {
    console.log("twelvelabs_task_id column likely exists")
}

try {
    db.exec("ALTER TABLE recordings ADD COLUMN ai_events TEXT DEFAULT '[]'")
    console.log("Added ai_events column")
} catch (e) {
    console.log("ai_events column likely exists")
}

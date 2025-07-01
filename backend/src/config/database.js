const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
    constructor() {
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            // Ensure data directory exists
            const dataDir = path.join(__dirname, '..', '..', 'data');
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
                console.log('Created data directory:', dataDir);
            }

            const dbPath = path.join(dataDir, 'cloudvault.db');
            console.log('Database path:', dbPath);
            
            this.db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    this.initTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async initTables() {
        const tables = [
            // Users table with storage preferences
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id TEXT UNIQUE NOT NULL,
                phone_number TEXT NOT NULL,
                first_name TEXT,
                last_name TEXT,
                username TEXT,
                session_string TEXT NOT NULL,
                storage_preference TEXT DEFAULT 'saved_messages',
                storage_config TEXT DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Auth sessions table
            `CREATE TABLE IF NOT EXISTS auth_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone_number TEXT NOT NULL,
                phone_code_hash TEXT NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Files table with storage method tracking
            `CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                file_name TEXT NOT NULL,
                file_type TEXT,
                file_size INTEGER,
                telegram_message_id TEXT NOT NULL,
                telegram_chat_id TEXT DEFAULT 'me',
                storage_method TEXT DEFAULT 'saved_messages',
                folder_path TEXT DEFAULT '',
                description TEXT DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`,

            // Folders table
            `CREATE TABLE IF NOT EXISTS folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                folder_name TEXT NOT NULL,
                folder_path TEXT DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`,

            // Storage channels table (for auto-created channels)
            `CREATE TABLE IF NOT EXISTS storage_channels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                channel_name TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                channel_type TEXT NOT NULL,
                category TEXT DEFAULT 'general',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`
        ];

        for (const table of tables) {
            await new Promise((resolve, reject) => {
                this.db.run(table, (err) => {
                    if (err) {
                        console.error('Error creating table:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }

        // Add new columns to existing tables if they don't exist
        const alterTableCommands = [
            'ALTER TABLE files ADD COLUMN telegram_chat_id TEXT DEFAULT "me"',
            'ALTER TABLE files ADD COLUMN storage_method TEXT DEFAULT "saved_messages"',
            'ALTER TABLE users ADD COLUMN storage_preference TEXT DEFAULT "saved_messages"',
            'ALTER TABLE users ADD COLUMN storage_config TEXT DEFAULT "{}"'
        ];

        for (const command of alterTableCommands) {
            try {
                await new Promise((resolve, reject) => {
                    this.db.run(command, (err) => {
                        if (err && !err.message.includes('duplicate column name')) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            } catch (error) {
                // Ignore errors for columns that already exist
                if (!error.message.includes('duplicate column name')) {
                    console.error('Error altering table:', error);
                }
            }
        }

        console.log('Database tables initialized');
    }

    getDb() {
        return this.db;
    }

    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log('Database connection closed');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = new Database();
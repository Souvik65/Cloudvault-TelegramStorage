const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let db;

const connectDatabase = async () => {
    try {
        console.log('🔍 Database configuration:');
        console.log('   NODE_ENV:', process.env.NODE_ENV);
        console.log('   DATABASE_URL exists:', !!process.env.DATABASE_URL);
        console.log('   DATABASE_URL value:', process.env.DATABASE_URL ? '[SET]' : '[NOT SET]');
        console.log('   Using PostgreSQL:', !!process.env.DATABASE_URL);

        console.log('Connecting to database...');

        if (process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
            // PostgreSQL for production (if needed later)
            const { Pool } = require('pg');
            const pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: { rejectUnauthorized: false }
            });

            const client = await pool.connect();
            console.log('✅ PostgreSQL connected successfully');
            client.release();
            
            return { pool, query: async (text, params) => pool.query(text, params) };
        } else {
            // SQLite for development
            console.log('🗃️ Using SQLite database for local development...');
            
            const dbDir = path.join(__dirname, '../../data');
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            const dbPath = path.join(dbDir, 'cloudvault.db');
            console.log('📍 Database path:', dbPath);

            db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error('❌ SQLite connection failed:', err);
                    throw err;
                } else {
                    console.log('✅ SQLite connected successfully');
                }
            });

            // Create tables
            await createTables();
            console.log('✅ SQLite tables created/verified');
            console.log('Database connected successfully');

            return db;
        }
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        throw error;
    }
};

const createTables = async () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Create users table
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id TEXT UNIQUE NOT NULL,
                    phone_number TEXT NOT NULL,
                    session_string TEXT NOT NULL,
                    storage_preference TEXT DEFAULT 'saved_messages',
                    storage_config TEXT DEFAULT '{}',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Create auth_sessions table (missing in original)
            db.run(`
                CREATE TABLE IF NOT EXISTS auth_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    phone_number TEXT NOT NULL,
                    phone_code_hash TEXT NOT NULL,
                    expires_at DATETIME NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Create files table
            db.run(`
                CREATE TABLE IF NOT EXISTS files (
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
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                );
            `);

            // Create folders table
            db.run(`
                CREATE TABLE IF NOT EXISTS folders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    folder_name TEXT NOT NULL,
                    folder_path TEXT DEFAULT '',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                );
            `);

            // Create storage_channels table for auto-created channels
            db.run(`
                CREATE TABLE IF NOT EXISTS storage_channels (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    channel_id TEXT NOT NULL,
                    channel_name TEXT NOT NULL,
                    category TEXT DEFAULT 'general',
                    access_hash TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                );
            `);

            // Create indexes for better performance
            db.run(`CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_files_folder_path ON files(folder_path);`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_files_storage_method ON files(storage_method);`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_files_user_folder ON files(user_id, folder_path);`);
            
            db.run(`CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_folders_path ON folders(folder_path);`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_folders_user_path ON folders(user_id, folder_path);`);
            
            db.run(`CREATE INDEX IF NOT EXISTS idx_storage_channels_user_id ON storage_channels(user_id);`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_storage_channels_channel_id ON storage_channels(channel_id);`);
            
            db.run(`CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);`);
            
            console.log('Database indexes created/verified');
            
            resolve();
        });
    });
};

const query = async (text, params = []) => {
    if (!db) {
        throw new Error('Database not connected');
    }

    return new Promise((resolve, reject) => {
        if (text.trim().toUpperCase().startsWith('SELECT')) {
            db.all(text, params, (err, rows) => {
                if (err) {
                    console.error('Database query error:', err);
                    reject(err);
                } else {
                    resolve({ rows });
                }
            });
        } else if (text.trim().toUpperCase().startsWith('INSERT')) {
            db.run(text, params, function(err) {
                if (err) {
                    console.error('Database query error:', err);
                    reject(err);
                } else {
                    resolve({ rows: [{ id: this.lastID }] });
                }
            });
        } else {
            db.run(text, params, function(err) {
                if (err) {
                    console.error('Database query error:', err);
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        }
    });
};

const getDb = () => db;

const close = async () => {
    if (db) {
        return new Promise((resolve) => {
            db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                } else {
                    console.log('SQLite connection closed');
                }
                resolve();
            });
        });
    }
};

module.exports = {
    connect: connectDatabase,
    query,
    getDb,
    close
};
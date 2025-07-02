const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let db = null;
let pool = null;

// Check if we should use PostgreSQL
const usePostgreSQL = process.env.DATABASE_URL && 
                     process.env.DATABASE_URL.trim() !== '' && 
                     process.env.DATABASE_URL.includes('postgres');

console.log('🔍 Database configuration:');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('   DATABASE_URL value:', process.env.DATABASE_URL ? '[SET]' : '[NOT SET]');
console.log('   Using PostgreSQL:', usePostgreSQL);

const connectDatabase = async () => {
    try {
        if (usePostgreSQL) {
            // PostgreSQL for production (Render)
            console.log('🐘 Using PostgreSQL database...');
            pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
            });

            const client = await pool.connect();
            console.log('✅ PostgreSQL connected successfully');
            client.release();

            await createPostgreSQLTables();
        } else {
            // SQLite for local development
            console.log('🗃️ Using SQLite database for local development...');
            
            // Ensure data directory exists
            const dataDir = path.join(__dirname, '../../data');
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
                console.log('📁 Created data directory');
            }

            return new Promise((resolve, reject) => {
                const dbPath = path.join(dataDir, 'cloudvault.db');
                console.log('📍 Database path:', dbPath);
                
                db = new sqlite3.Database(dbPath, (err) => {
                    if (err) {
                        console.error('❌ SQLite connection error:', err);
                        reject(err);
                    } else {
                        console.log('✅ SQLite connected successfully');
                        createSQLiteTables()
                            .then(() => resolve(db))
                            .catch(reject);
                    }
                });
            });
        }
        
        return usePostgreSQL ? pool : db;
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        
        // Provide helpful error messages
        if (error.code === 'ENOTFOUND') {
            console.error('💡 This usually means:');
            console.error('   1. You have DATABASE_URL set to a remote database');
            console.error('   2. The database is not accessible from your local machine');
            console.error('   3. For local development, comment out DATABASE_URL in your .env file');
        }
        
        throw error;
    }
};

const createPostgreSQLTables = async () => {
    try {
        // Create users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                telegram_id TEXT UNIQUE NOT NULL,
                phone_number TEXT NOT NULL,
                session_string TEXT NOT NULL,
                storage_preference TEXT DEFAULT 'saved_messages',
                storage_config TEXT DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create files table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS files (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                file_name TEXT NOT NULL,
                file_type TEXT,
                file_size BIGINT,
                telegram_message_id TEXT NOT NULL,
                telegram_chat_id TEXT DEFAULT 'me',
                storage_method TEXT DEFAULT 'saved_messages',
                folder_path TEXT DEFAULT '',
                description TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        `);

        // Create folders table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS folders (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                folder_name TEXT NOT NULL,
                folder_path TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        `);

        console.log('✅ PostgreSQL tables created/verified');
    } catch (error) {
        console.error('❌ Failed to create PostgreSQL tables:', error);
        throw error;
    }
};

const createSQLiteTables = async () => {
    return new Promise((resolve, reject) => {
        const queries = [
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id TEXT UNIQUE NOT NULL,
                phone_number TEXT NOT NULL,
                session_string TEXT NOT NULL,
                storage_preference TEXT DEFAULT 'saved_messages',
                storage_config TEXT DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
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
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                folder_name TEXT NOT NULL,
                folder_path TEXT DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`
        ];

        let completed = 0;
        queries.forEach((query, index) => {
            db.run(query, (err) => {
                if (err) {
                    console.error(`❌ Error creating table ${index + 1}:`, err);
                    reject(err);
                    return;
                }
                completed++;
                if (completed === queries.length) {
                    console.log('✅ SQLite tables created/verified');
                    resolve();
                }
            });
        });
    });
};

const query = async (text, params = []) => {
    if (usePostgreSQL) {
        // PostgreSQL query
        const client = await pool.connect();
        try {
            const result = await client.query(text, params);
            return result;
        } catch (error) {
            console.error('PostgreSQL query error:', error);
            throw error;
        } finally {
            client.release();
        }
    } else {
        // SQLite query
        return new Promise((resolve, reject) => {
            if (text.trim().toUpperCase().startsWith('SELECT')) {
                db.all(text, params, (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ rows });
                    }
                });
            } else {
                db.run(text, params, function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ 
                            rowCount: this.changes,
                            rows: [{ id: this.lastID }]
                        });
                    }
                });
            }
        });
    }
};

const close = async () => {
    if (usePostgreSQL && pool) {
        await pool.end();
        console.log('PostgreSQL connection closed');
    } else if (db) {
        return new Promise((resolve) => {
            db.close((err) => {
                if (err) {
                    console.error('Error closing SQLite:', err);
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
    close,
    isPostgreSQL: () => usePostgreSQL
};
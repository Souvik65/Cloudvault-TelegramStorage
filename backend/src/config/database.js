const { Pool } = require('pg');

let pool;

const connectDatabase = async () => {
    try {
        // PostgreSQL connection
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });

        // Test connection
        const client = await pool.connect();
        console.log('✅ PostgreSQL connected successfully');
        client.release();

        // Create tables if they don't exist
        await createTables();
        
        return pool;
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        throw error;
    }
};

const createTables = async () => {
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

        // Create indexes for better performance
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_files_user_id ON files (user_id);
            CREATE INDEX IF NOT EXISTS idx_files_folder_path ON files (folder_path);
            CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders (user_id);
        `);
        
        console.log('✅ Database tables created/verified');
    } catch (error) {
        console.error('❌ Failed to create tables:', error);
        throw error;
    }
};

const query = async (text, params = []) => {
    const client = await pool.connect();
    try {
        const result = await client.query(text, params);
        return result;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    } finally {
        client.release();
    }
};

const close = async () => {
    if (pool) {
        await pool.end();
        console.log('Database connection closed');
    }
};

module.exports = {
    connect: connectDatabase,
    query,
    close,
    pool: () => pool
};
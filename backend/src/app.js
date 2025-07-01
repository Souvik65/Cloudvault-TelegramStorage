// Move these to the top, before any other code
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const database = require('./config/database');
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const storageRoutes = require('./routes/storage');
// Remove these lines that are causing errors:
// const telegramService = require('./services/telegramService');
// const responseTime = require('./middleware/responseTime');
// const processManager = require('./utils/processManager');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize server variable at the top
let server = null;

// Trust proxy for accurate client IPs
app.set('trust proxy', 1);

// Simple response time middleware (instead of importing)
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
    });
    next();
});

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", process.env.RENDER_EXTERNAL_URL || "*"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb' 
}));

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '../../frontend')));

// Request timeout middleware
app.use((req, res, next) => {
    const timeout = req.url.includes('/upload') ? 60000 : 30000;
    
    req.setTimeout(timeout, () => {
        console.warn(`Request timeout: ${req.method} ${req.url} (${timeout}ms)`);
        if (!res.headersSent) {
            res.status(408).json({ 
                error: 'Request timeout. Please try again with a smaller file or check your connection.' 
            });
        }
    });
    
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/storage', storageRoutes);

// Health check with basic stats
app.get('/health', (req, res) => {
    try {
        res.json({ 
            status: 'OK', 
            timestamp: new Date().toISOString(),
            server: {
                uptime: Math.round(process.uptime()),
                pid: process.pid,
                nodeVersion: process.version,
                platform: process.platform,
                environment: process.env.NODE_ENV || 'development'
            },
            database: {
                type: 'PostgreSQL',
                connected: !!database
            }
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'ERROR', 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Serve frontend for all non-API routes
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API route not found' });
    }
    
    res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Express error handler:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
    });
    
    if (res.headersSent) {
        console.warn('Headers already sent, cannot send error response');
        return next(err);
    }
    
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ 
            error: 'File too large. Maximum file size is 10MB.' 
        });
    }
    
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ 
            error: 'Invalid JSON in request body.' 
        });
    }
    
    if (err.message && err.message.includes('timeout')) {
        return res.status(408).json({ 
            error: 'Operation timeout. Please try again.' 
        });
    }
    
    res.status(500).json({ 
        error: 'Internal server error. Please try again.',
        requestId: req.headers['x-request-id'] || 'unknown'
    });
});

// Graceful shutdown function (fixed)
async function gracefulShutdown(signal) {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
    
    try {
        // Stop accepting new connections
        if (server) {
            server.close(() => {
                console.log('HTTP server closed');
            });
        }
        
        // Close database connection
        if (database && database.close) {
            await database.close();
            console.log('Database connection closed');
        }
        
        console.log('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
}

// Global error handlers
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
    });
    
    // Don't exit for known errors
    if (error.message && (
        error.message.includes('Cannot find module') ||
        error.message.includes('responseTime is not defined') ||
        error.message.includes('server is not defined')
    )) {
        console.log('Attempting to continue after known error...');
        return;
    }
    
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', {
        reason: reason instanceof Error ? reason.message : reason,
        stack: reason instanceof Error ? reason.stack : 'No stack trace',
        timestamp: new Date().toISOString()
    });
});

// Handle shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start server function
async function start() {
    try {
        // Connect to database first
        console.log('Connecting to database...');
        await database.connect();
        console.log('Database connected successfully');
        
        // Then start the server
        server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 CloudVault Server running on port ${PORT}`);
            console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🆔 Process ID: ${process.pid}`);
            console.log(`🔗 Health check: http://localhost:${PORT}/health`);
            console.log(`🗄️ Database: PostgreSQL`);
            
            // Log configuration status
            console.log('📋 Configuration:');
            console.log(`   - Telegram API ID: ${process.env.TELEGRAM_API_ID ? '✅ Set' : '❌ Missing'}`);
            console.log(`   - Telegram API Hash: ${process.env.TELEGRAM_API_HASH ? '✅ Set' : '❌ Missing'}`);
            console.log(`   - JWT Secret: ${process.env.JWT_SECRET ? '✅ Set' : '❌ Missing'}`);
            console.log(`   - Database URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Missing'}`);
        });
        
        // Server configuration
        server.timeout = 65000;
        server.keepAliveTimeout = 5000;
        server.headersTimeout = 6000;
        
        server.on('error', (error) => {
            console.error('Server error:', error);
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${PORT} is already in use. Please try a different port.`);
                process.exit(1);
            }
        });
        
        server.on('clientError', (err, socket) => {
            console.warn('Client error:', err.message);
            if (socket.writable) {
                socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
            }
        });
        
        return server;
    } catch (error) {
        console.error('Failed to start server:', error);
        
        // Provide helpful error messages
        if (error.message.includes('ECONNREFUSED')) {
            console.error('Database connection failed. Please check your DATABASE_URL environment variable.');
        } else if (error.message.includes('Cannot find module')) {
            console.error('Missing dependencies. Please run: npm install');
        }
        
        process.exit(1);
    }
}

// Start the application
start().catch(error => {
    console.error('Server startup failed:', error);
    process.exit(1);
});
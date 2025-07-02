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

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize server variable at the top
let server = null;

// Trust proxy for accurate client IPs
app.set('trust proxy', 1);

// Simple response time middleware
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
                memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                pid: process.pid
            },
            database: {
                type: process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite',
                connected: true
            }
        });
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({ 
            status: 'ERROR', 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Catch-all route for frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    
    if (res.headersSent) {
        return next(error);
    }
    
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        timestamp: new Date().toISOString()
    });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        error: 'API endpoint not found',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

// Graceful shutdown handlers
const gracefulShutdown = async (signal) => {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
    
    try {
        // Close HTTP server
        if (server) {
            await new Promise((resolve) => {
                server.close(() => {
                    console.log('HTTP server closed');
                    resolve();
                });
            });
        }
        
        // Close database connection
        await database.close();
        console.log('Database connection closed');
        
        console.log('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
    });
    
    console.log('Received UNCAUGHT_EXCEPTION. Starting graceful shutdown...');
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', {
        reason: reason,
        stack: reason instanceof Error ? reason.stack : 'No stack trace available',
        timestamp: new Date().toISOString()
    });
    
    console.log('Received UNHANDLED_REJECTION. Starting graceful shutdown...');
    gracefulShutdown('UNHANDLED_REJECTION');
});

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
    try {
        // Connect to database first
        await database.connect();
        
        // Start HTTP server
        server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 CloudVault Server running on port ${PORT}`);
            console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🆔 Process ID: ${process.pid}`);
            console.log(`🔗 Health check: http://localhost:${PORT}/health`);
            console.log(`🗄️ Database: ${process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite'}`);
            console.log(`📋 Configuration:`);
            console.log(`   - Telegram API ID: ${process.env.TELEGRAM_API_ID ? '✅ Set' : '❌ Not Set'}`);
            console.log(`   - Telegram API Hash: ${process.env.TELEGRAM_API_HASH ? '✅ Set' : '❌ Not Set'}`);
            console.log(`   - JWT Secret: ${process.env.JWT_SECRET ? '✅ Set' : '❌ Not Set'}`);
            console.log(`   - Database URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Not Set (Using SQLite)'}`);
        });

        // Handle server errors
        server.on('error', (error) => {
            console.error('Server error:', error);
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${PORT} is already in use. Please choose a different port.`);
                process.exit(1);
            }
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Start the server
startServer();

module.exports = app;
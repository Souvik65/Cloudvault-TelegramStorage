// Add this at the top of app.js after require statements:

// Prevent unhandled rejections from crashing the server
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', {
        reason: reason instanceof Error ? reason.message : reason,
        stack: reason instanceof Error ? reason.stack : 'No stack trace',
        timestamp: new Date().toISOString()
    });
    
    // Don't exit immediately for Telegram client errors
    if (reason && reason.message && reason.message.includes('_log.canSend')) {
        console.log('Ignoring Telegram client logging error - this is expected');
        return;
    }
    
    if (reason && reason.message && reason.message.includes('_updateLoop')) {
        console.log('Ignoring Telegram update loop error - this is expected');
        return;
    }
    
    // For other critical errors, try graceful shutdown
    console.log('Attempting graceful shutdown due to unhandled rejection...');
    gracefulShutdown('UNHANDLED_REJECTION');
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
    });
    
    // Don't exit for Telegram client errors
    if (error.message && error.message.includes('_log.canSend')) {
        console.log('Ignoring Telegram client logging error - this is expected');
        return;
    }
    
    if (error.message && error.message.includes('headers after they are sent')) {
        console.log('Ignoring headers error - continuing operation');
        return;
    }
    
    // For other critical errors, try graceful shutdown
    console.log('Attempting graceful shutdown due to uncaught exception...');
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});




require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const database = require('./config/database');
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const storageRoutes = require('./routes/storage');
const telegramService = require('./services/telegramService');
const responseTime = require('./middleware/responseTime');
const processManager = require('./utils/processManager');

const app = express();
const PORT = process.env.PORT || 3001;
const path = require('path');

// Add this line to serve frontend files
app.use(express.static(path.join(__dirname, '../../frontend')));

// Trust proxy for accurate client IPs
app.set('trust proxy', 1);

// Response time tracking (before other middleware)
app.use(responseTime);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for development
}));

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

// Request timeout middleware
app.use((req, res, next) => {
    // Set timeout for requests
    const timeout = req.url.includes('/upload') ? 60000 : 30000; // 60s for uploads, 30s for others
    
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

// Health check with system stats
app.get('/health', (req, res) => {
    try {
        const stats = processManager.getStats();
        res.json({ 
            status: 'OK', 
            timestamp: new Date().toISOString(),
            server: {
                uptime: Math.round(process.uptime()),
                pid: process.pid,
                nodeVersion: process.version,
                platform: process.platform
            },
            performance: stats
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'ERROR', 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Express error handler:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        headers: req.headers
    });
    
    // Don't send response if headers already sent
    if (res.headersSent) {
        console.warn('Headers already sent, cannot send error response');
        return next(err);
    }
    
    // Handle specific error types
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
    
    // Generic error response
    res.status(500).json({ 
        error: 'Internal server error. Please try again.',
        requestId: req.headers['x-request-id'] || 'unknown'
    });
});

// Serve frontend for all non-API routes
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API route not found' });
    }
    
    res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method
    });
});

// Global error handlers
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
    });
    
    // Try graceful shutdown
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', {
        reason: reason,
        promise: promise,
        timestamp: new Date().toISOString()
    });
    
    // Try graceful shutdown
    gracefulShutdown('UNHANDLED_REJECTION');
});

// Graceful shutdown function
async function gracefulShutdown(signal) {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
    
    try {
        // Stop accepting new connections
        if (server) {
            server.close(() => {
                console.log('HTTP server closed');
            });
        }
        
        // Clean up process manager
        processManager.cleanup();
        
        // Clean up Telegram clients
        await telegramService.cleanup();
        
        // Close database connection
        await database.close();
        
        console.log('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
}

// Handle shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start server
let server;
async function start() {
    try {
        await database.connect();
        
        server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV}`);
            console.log(`Process ID: ${process.pid}`);
            console.log(`Health check: http://localhost:${PORT}/health`);
        });
        
        // Set server timeout
        server.timeout = 65000; // 65 seconds (longer than request timeouts)
        server.keepAliveTimeout = 5000; // 5 seconds
        server.headersTimeout = 6000; // 6 seconds
        
        // Handle server errors
        server.on('error', (error) => {
            console.error('Server error:', error);
        });
        
        server.on('clientError', (err, socket) => {
            console.warn('Client error:', err.message);
            socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        });
        
        return server;
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

start().catch(error => {
    console.error('Server startup failed:', error);
    process.exit(1);
});
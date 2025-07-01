const responseTime = (req, res, next) => {
    const startTime = Date.now();
    
    // Store original end method
    const originalEnd = res.end;
    
    // Override end method to capture timing
    res.end = function(...args) {
        const duration = Date.now() - startTime;
        
        // Only set headers if they haven't been sent yet
        if (!res.headersSent) {
            try {
                res.set('X-Response-Time', `${duration}ms`);
            } catch (error) {
                // Ignore header setting errors
                console.debug('Could not set response time header:', error.message);
            }
        }
        
        // Log slow requests
        if (duration > 5000) {
            console.warn(`Slow request: ${req.method} ${req.url} - ${duration}ms`);
        } else if (duration > 2000) {
            console.log(`Request: ${req.method} ${req.url} - ${duration}ms`);
        }
        
        // Call original end method
        originalEnd.apply(this, args);
    };
    
    next();
};

module.exports = responseTime;
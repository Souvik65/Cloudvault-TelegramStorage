const { spawn } = require('child_process');

class ProcessManager {
    constructor() {
        this.activeConnections = new Set();
        this.cleanupInterval = null;
        this.memoryCheckInterval = null;
        this.startMonitoring();
    }

    trackConnection(connectionId) {
        this.activeConnections.add(connectionId);
        console.debug(`Tracking connection: ${connectionId}`);
    }

    untrackConnection(connectionId) {
        this.activeConnections.delete(connectionId);
        console.debug(`Untracked connection: ${connectionId}`);
    }

    startMonitoring() {
        // Clean up hanging processes every 30 seconds
        this.cleanupInterval = setInterval(() => {
            this.cleanupHangingProcesses();
        }, 30000);

        // Check memory usage every minute
        this.memoryCheckInterval = setInterval(() => {
            this.checkMemoryUsage();
        }, 60000);

        console.log('Process monitoring started');
    }

    cleanupHangingProcesses() {
        try {
            const activeCount = this.activeConnections.size;
            if (activeCount > 10) {
                console.warn(`High number of active connections: ${activeCount}`);
            }

            // Force garbage collection if available
            if (global.gc && activeCount > 5) {
                global.gc();
                console.debug('Forced garbage collection due to high connection count');
            }
        } catch (error) {
            console.debug('Cleanup process error (non-critical):', error.message);
        }
    }

    checkMemoryUsage() {
        try {
            const usage = process.memoryUsage();
            const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
            const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);

            if (heapUsedMB > 200) {
                console.warn(`High memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB`);
                
                // Force garbage collection if available
                if (global.gc) {
                    global.gc();
                    const newUsage = process.memoryUsage();
                    const newHeapUsedMB = Math.round(newUsage.heapUsed / 1024 / 1024);
                    console.log(`Memory after GC: ${newHeapUsedMB}MB`);
                }
            }
        } catch (error) {
            console.debug('Memory check error (non-critical):', error.message);
        }
    }

    forceKillHangingTelegramProcesses() {
        // This is a more aggressive cleanup - use sparingly
        try {
            if (process.platform === 'win32') {
                // Windows - kill processes using too much CPU
                const child = spawn('wmic', [
                    'process', 'where', 
                    'name="node.exe" and PageFileUsage>104857600', 
                    'delete'
                ], {
                    stdio: 'ignore',
                    detached: true
                });
                child.unref();
            } else {
                // Linux/Mac - kill hanging node processes
                const child = spawn('pkill', ['-f', 'node.*telegram'], {
                    stdio: 'ignore',
                    detached: true
                });
                child.unref();
            }
            console.log('Attempted aggressive process cleanup');
        } catch (error) {
            console.debug('Aggressive cleanup failed (non-critical):', error.message);
        }
    }

    getStats() {
        const usage = process.memoryUsage();
        return {
            activeConnections: this.activeConnections.size,
            memoryUsage: {
                heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
                heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
                external: Math.round(usage.external / 1024 / 1024) + 'MB'
            },
            uptime: process.uptime()
        };
    }

    cleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        if (this.memoryCheckInterval) {
            clearInterval(this.memoryCheckInterval);
            this.memoryCheckInterval = null;
        }

        this.activeConnections.clear();
        console.log('Process manager cleanup completed');
    }
}

module.exports = new ProcessManager();
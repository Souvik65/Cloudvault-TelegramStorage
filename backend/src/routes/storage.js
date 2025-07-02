const express = require('express');
const authMiddleware = require('../middleware/auth');
const enhancedTelegramService = require('../services/enhancedTelegramService');
const database = require('../config/database');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get available storage options
router.get('/options', async (req, res) => {
    try {
        const user = req.user;
        console.log('Getting storage options for user:', user.id);
        
        const options = await enhancedTelegramService.getStorageOptions(user.session_string);
        
        // Get user's created storage channels
        const db = database.getDb();
        const userChannels = await new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM storage_channels WHERE user_id = ? ORDER BY created_at DESC',
                [user.id],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        // Add user's created channels to options
        userChannels.forEach(channel => {
            options.channels.push({
                id: channel.channel_id,
                name: channel.channel_name,
                type: 'channel',
                canPost: true,
                description: `Auto-created: ${channel.channel_name}`,
                category: channel.category,
                isAutoCreated: true
            });
        });

        res.json({
            success: true,
            options: options,
            currentPreference: user.storage_preference || 'saved_messages',
            currentConfig: JSON.parse(user.storage_config || '{}')
        });
    } catch (error) {
        console.error('Error getting storage options:', error);
        res.status(500).json({
            error: 'Failed to get storage options: ' + error.message
        });
    }
});

// Create a new storage channel
router.post('/create-channel', async (req, res) => {
    try {
        const user = req.user;
        const { channelName, category } = req.body;

        if (!channelName) {
            return res.status(400).json({ error: 'Channel name is required' });
        }

        console.log('Creating storage channel for user:', user.id);
        
        const channel = await enhancedTelegramService.createStorageChannel(
            user.session_string, 
            channelName, 
            category || 'general'
        );

        // Update database with user_id
        const db = database.getDb();
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE storage_channels SET user_id = ? WHERE channel_id = ?',
                [user.id, channel.id],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({
            success: true,
            channel: channel,
            message: 'Storage channel created successfully'
        });
    } catch (error) {
        console.error('Error creating storage channel:', error);
        res.status(500).json({
            error: 'Failed to create storage channel: ' + error.message
        });
    }
});

// Save storage settings
router.post('/settings', async (req, res) => {
    try {
        const user = req.user;
        const { method, chatId, autoCreateChannels, botUsername } = req.body;

        // Validate storage method
        const allowedMethods = ['saved_messages', 'private_channel', 'private_group', 'bot_storage'];
        if (!method || !allowedMethods.includes(method)) {
            return res.status(400).json({
                error: 'Invalid storage method',
                message: 'Method must be one of: ' + allowedMethods.join(', ')
            });
        }

        // Validate chatId for non-saved_messages methods
        if (method !== 'saved_messages') {
            if (!chatId || (chatId !== 'me' && !/^-?\d+$/.test(chatId.toString()))) {
                return res.status(400).json({
                    error: 'Invalid chat ID',
                    message: 'Chat ID is required for selected storage method'
                });
            }
        }

        // Validate botUsername for bot storage
        if (method === 'bot_storage') {
            if (!botUsername || typeof botUsername !== 'string' || botUsername.trim() === '') {
                return res.status(400).json({
                    error: 'Invalid bot username',
                    message: 'Bot username is required for bot storage method'
                });
            }
        }

        const storageConfig = {
            method: method,
            chatId: chatId,
            autoCreateChannels: autoCreateChannels || false,
            botUsername: botUsername
        };

        console.log('Saving storage settings for user:', user.id, storageConfig);

        // Verify the storage method is accessible before saving
        try {
            if (method !== 'saved_messages') {
                // Test access to the storage target
                await enhancedTelegramService.getStorageOptions(user.session_string);
                console.log('Storage method access verified');
            }
        } catch (accessError) {
            console.error('Storage method access verification failed:', accessError);
            return res.status(400).json({
                error: 'Storage method not accessible',
                message: 'Cannot access the selected storage method. Please check your settings and try again.'
            });
        }

        const db = database.getDb();
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET storage_preference = ?, storage_config = ? WHERE id = ?',
                [method, JSON.stringify(storageConfig), user.id],
                (err) => {
                    if (err) {
                        console.error('Database error saving storage settings:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });

        res.json({
            success: true,
            message: 'Storage settings saved successfully',
            settings: {
                method: method,
                chatId: chatId,
                autoCreateChannels: autoCreateChannels || false
            }
        });
    } catch (error) {
        console.error('Error saving storage settings:', error);
        res.status(500).json({
            error: 'Failed to save storage settings',
            message: error.message || 'An unexpected error occurred while saving settings'
        });
    }
});

// Migrate files between storage methods
router.post('/migrate', async (req, res) => {
    try {
        const user = req.user;
        const { fileIds, newStorageConfig } = req.body;

        // Enhanced validation
        if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
            return res.status(400).json({ 
                error: 'Invalid file IDs',
                message: 'File IDs must be provided as a non-empty array'
            });
        }

        if (fileIds.length > 50) {
            return res.status(400).json({ 
                error: 'Too many files',
                message: 'Cannot migrate more than 50 files at once'
            });
        }

        if (!newStorageConfig || !newStorageConfig.method) {
            return res.status(400).json({ 
                error: 'Invalid storage configuration',
                message: 'New storage configuration with method is required'
            });
        }

        // Validate storage configuration
        const allowedMethods = ['saved_messages', 'private_channel', 'private_group', 'bot_storage'];
        if (!allowedMethods.includes(newStorageConfig.method)) {
            return res.status(400).json({
                error: 'Invalid storage method',
                message: 'Method must be one of: ' + allowedMethods.join(', ')
            });
        }

        // Validate chatId for non-saved_messages methods
        if (newStorageConfig.method !== 'saved_messages') {
            if (!newStorageConfig.chatId || (newStorageConfig.chatId !== 'me' && !/^-?\d+$/.test(newStorageConfig.chatId.toString()))) {
                return res.status(400).json({
                    error: 'Invalid chat ID',
                    message: 'Chat ID is required for selected storage method'
                });
            }
        }

        console.log(`Starting migration of ${fileIds.length} files for user:`, user.id);
        console.log('Target storage config:', newStorageConfig);

        const db = database.getDb();
        const migratedFiles = [];
        const errors = [];
        let totalSize = 0;

        // First pass: validate all files and calculate total size
        const filesToMigrate = [];
        for (const fileId of fileIds) {
            try {
                const file = await new Promise((resolve, reject) => {
                    db.get(
                        'SELECT * FROM files WHERE id = ? AND user_id = ?',
                        [fileId, user.id],
                        (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        }
                    );
                });

                if (!file) {
                    errors.push({ 
                        fileId, 
                        error: 'File not found',
                        message: 'File does not exist or does not belong to user'
                    });
                    continue;
                }

                // Check if file is already in target storage
                if (file.storage_method === newStorageConfig.method && 
                    file.telegram_chat_id === (newStorageConfig.chatId || 'me')) {
                    errors.push({ 
                        fileId, 
                        error: 'Already in target storage',
                        message: `File "${file.file_name}" is already in the target storage location`
                    });
                    continue;
                }

                filesToMigrate.push(file);
                totalSize += file.file_size || 0;

            } catch (error) {
                console.error(`Error validating file ${fileId}:`, error);
                errors.push({ 
                    fileId, 
                    error: 'Validation failed',
                    message: error.message
                });
            }
        }

        if (filesToMigrate.length === 0) {
            return res.status(400).json({
                error: 'No files to migrate',
                message: 'All files either do not exist or are already in the target storage',
                errors: errors
            });
        }

        console.log(`Validated ${filesToMigrate.length} files for migration (${totalSize} bytes total)`);

        // Second pass: perform actual migration with integrity checks
        for (const file of filesToMigrate) {
            try {
                console.log(`Migrating file: ${file.file_name} (${file.file_size} bytes)`);

                // Perform migration with integrity verification
                const migrationResult = await enhancedTelegramService.migrateFile(
                    user.session_string,
                    file,
                    newStorageConfig
                );

                // Verify migration integrity
                if (!migrationResult.messageId || !migrationResult.chatId) {
                    throw new Error('Migration result incomplete - missing message ID or chat ID');
                }

                // Additional integrity check: verify file size if available
                if (migrationResult.fileSize && file.file_size) {
                    if (migrationResult.fileSize !== file.file_size) {
                        console.warn(`File size mismatch for ${file.file_name}: expected ${file.file_size}, got ${migrationResult.fileSize}`);
                    }
                }

                // Update database with new location
                await new Promise((resolve, reject) => {
                    db.run(
                        'UPDATE files SET telegram_message_id = ?, telegram_chat_id = ?, storage_method = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        [migrationResult.messageId, migrationResult.chatId, migrationResult.method, file.id],
                        (err) => {
                            if (err) {
                                console.error('Database update failed:', err);
                                reject(err);
                            } else {
                                resolve();
                            }
                        }
                    );
                });

                migratedFiles.push({
                    fileId: file.id,
                    fileName: file.file_name,
                    fileSize: file.file_size,
                    oldLocation: {
                        messageId: file.telegram_message_id,
                        chatId: file.telegram_chat_id,
                        method: file.storage_method
                    },
                    newLocation: {
                        messageId: migrationResult.messageId,
                        chatId: migrationResult.chatId,
                        method: migrationResult.method
                    },
                    migratedAt: new Date().toISOString()
                });

                console.log(`Successfully migrated file: ${file.file_name}`);

            } catch (error) {
                console.error(`Error migrating file ${file.id} (${file.file_name}):`, error);
                errors.push({ 
                    fileId: file.id, 
                    fileName: file.file_name,
                    error: 'Migration failed',
                    message: error.message
                });
            }
        }

        const successCount = migratedFiles.length;
        const errorCount = errors.length;

        res.json({
            success: successCount > 0,
            migratedFiles: migratedFiles,
            errors: errors,
            summary: {
                total: fileIds.length,
                successful: successCount,
                failed: errorCount,
                totalSizeMigrated: migratedFiles.reduce((sum, file) => sum + (file.fileSize || 0), 0)
            },
            message: successCount > 0 
                ? `Successfully migrated ${successCount} file${successCount === 1 ? '' : 's'}${errorCount > 0 ? ` (${errorCount} failed)` : ''}`
                : 'No files were migrated'
        });

    } catch (error) {
        console.error('Error in file migration:', error);
        res.status(500).json({
            error: 'Migration failed',
            message: error.message || 'An unexpected error occurred during file migration'
        });
    }
});

// Get migration status
router.get('/migration-status', async (req, res) => {
    try {
        const user = req.user;
        const db = database.getDb();

        // Get file count by storage method
        const storageStats = await new Promise((resolve, reject) => {
            db.all(
                `SELECT 
                    storage_method,
                    COUNT(*) as count,
                    SUM(file_size) as total_size
                FROM files 
                WHERE user_id = ? 
                GROUP BY storage_method`,
                [user.id],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        res.json({
            success: true,
            storageStats: storageStats
        });

// Refresh/Sync files with Telegram servers
router.post('/refresh', async (req, res) => {
    try {
        const user = req.user;
        const { storageMethod, fullSync } = req.body;

        console.log(`Starting refresh for user ${user.id}, method: ${storageMethod || 'all'}, fullSync: ${fullSync}`);

        const db = database.getDb();
        const syncResults = {
            verified: [],
            updated: [],
            missing: [],
            errors: []
        };

        // Get files to sync based on storage method filter
        let query = 'SELECT * FROM files WHERE user_id = ?';
        let params = [user.id];
        
        if (storageMethod && storageMethod !== 'all') {
            query += ' AND storage_method = ?';
            params.push(storageMethod);
        }
        
        const files = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        console.log(`Found ${files.length} files to sync`);

        // Sync with Telegram servers
        for (const file of files) {
            try {
                // Verify file exists in Telegram
                const exists = await enhancedTelegramService.verifyFileExists(
                    user.session_string,
                    file.telegram_message_id,
                    file.telegram_chat_id
                );

                if (exists) {
                    syncResults.verified.push({
                        fileId: file.id,
                        fileName: file.file_name,
                        status: 'verified'
                    });

                    // If full sync, also verify file integrity
                    if (fullSync) {
                        try {
                            const telegramFileInfo = await enhancedTelegramService.getFileInfo(
                                user.session_string,
                                file.telegram_message_id,
                                file.telegram_chat_id
                            );

                            // Update metadata if it has changed
                            let hasUpdates = false;
                            const updates = {};

                            if (telegramFileInfo.size && telegramFileInfo.size !== file.file_size) {
                                updates.file_size = telegramFileInfo.size;
                                hasUpdates = true;
                            }

                            if (hasUpdates) {
                                await new Promise((resolve, reject) => {
                                    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
                                    const values = Object.values(updates);
                                    values.push(file.id);

                                    db.run(
                                        `UPDATE files SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                                        values,
                                        (err) => {
                                            if (err) reject(err);
                                            else resolve();
                                        }
                                    );
                                });

                                syncResults.updated.push({
                                    fileId: file.id,
                                    fileName: file.file_name,
                                    updates: updates
                                });
                            }
                        } catch (integrityError) {
                            console.warn(`Integrity check failed for file ${file.id}:`, integrityError.message);
                        }
                    }
                } else {
                    // File not found in Telegram
                    syncResults.missing.push({
                        fileId: file.id,
                        fileName: file.file_name,
                        messageId: file.telegram_message_id,
                        chatId: file.telegram_chat_id,
                        reason: 'File not found in Telegram storage'
                    });

                    console.warn(`File not found in Telegram: ${file.file_name} (ID: ${file.id})`);
                }

            } catch (error) {
                console.error(`Error syncing file ${file.id}:`, error);
                syncResults.errors.push({
                    fileId: file.id,
                    fileName: file.file_name,
                    error: error.message
                });
            }
        }

        // Clear cache if requested
        if (fullSync) {
            // Clear any cached storage options
            console.log('Clearing storage cache for full sync');
        }

        const summary = {
            total: files.length,
            verified: syncResults.verified.length,
            updated: syncResults.updated.length,
            missing: syncResults.missing.length,
            errors: syncResults.errors.length
        };

        res.json({
            success: true,
            syncResults: syncResults,
            summary: summary,
            syncedAt: new Date().toISOString(),
            message: `Sync completed: ${summary.verified} verified, ${summary.updated} updated, ${summary.missing} missing, ${summary.errors} errors`
        });

    } catch (error) {
        console.error('Error in refresh operation:', error);
        res.status(500).json({
            error: 'Refresh failed',
            message: error.message || 'An unexpected error occurred during refresh'
        });
    }
});

// Get sync status
router.get('/sync-status', async (req, res) => {
    try {
        const user = req.user;

        const db = database.getDb();

        // Get last sync information (if we track it)
        const lastSync = await new Promise((resolve, reject) => {
            db.get(
                'SELECT MAX(updated_at) as lastUpdate FROM files WHERE user_id = ?',
                [user.id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        // Get files by storage method for status overview
        const storageStatus = await new Promise((resolve, reject) => {
            db.all(
                `SELECT 
                    storage_method,
                    COUNT(*) as count,
                    MAX(updated_at) as lastActivity
                FROM files 
                WHERE user_id = ? 
                GROUP BY storage_method`,
                [user.id],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        res.json({
            success: true,
            syncStatus: {
                lastUpdate: lastSync?.lastUpdate,
                storageStatus: storageStatus,
                needsSync: false, // Could implement logic to determine if sync is needed
                canSync: true
            }
        });

    } catch (error) {
        console.error('Error getting sync status:', error);
        res.status(500).json({
            error: 'Failed to get sync status',
            message: error.message
        });
    }
});
    } catch (error) {
        console.error('Error getting migration status:', error);
        res.status(500).json({
            error: 'Failed to get migration status: ' + error.message
        });
    }
});

module.exports = router;
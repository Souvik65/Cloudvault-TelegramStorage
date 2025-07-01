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
        const { method, chatId, autoCreateChannels } = req.body;

        const storageConfig = {
            method: method || 'saved_messages',
            chatId: chatId,
            autoCreateChannels: autoCreateChannels || false
        };

        console.log('Saving storage settings for user:', user.id, storageConfig);

        const db = database.getDb();
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET storage_preference = ?, storage_config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [method, JSON.stringify(storageConfig), user.id],
                (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });

        res.json({
            success: true,
            message: 'Storage settings saved successfully'
        });
    } catch (error) {
        console.error('Error saving storage settings:', error);
        res.status(500).json({
            error: 'Failed to save storage settings: ' + error.message
        });
    }
});

// Migrate files between storage methods
router.post('/migrate', async (req, res) => {
    try {
        const user = req.user;
        const { fileIds, newStorageConfig } = req.body;

        if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
            return res.status(400).json({ error: 'File IDs are required' });
        }

        if (!newStorageConfig || !newStorageConfig.method) {
            return res.status(400).json({ error: 'New storage configuration is required' });
        }

        console.log(`Migrating ${fileIds.length} files for user:`, user.id);

        const db = database.getDb();
        const migratedFiles = [];
        const errors = [];

        for (const fileId of fileIds) {
            try {
                // Get file metadata
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
                    errors.push({ fileId, error: 'File not found' });
                    continue;
                }

                // Migrate the file
                const migrationResult = await enhancedTelegramService.migrateFile(
                    user.session_string,
                    file,
                    newStorageConfig
                );

                // Update database with new location
                await new Promise((resolve, reject) => {
                    db.run(
                        'UPDATE files SET telegram_message_id = ?, telegram_chat_id = ?, storage_method = ? WHERE id = ?',
                        [migrationResult.messageId, migrationResult.chatId, migrationResult.method, fileId],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });

                migratedFiles.push({
                    fileId: fileId,
                    fileName: file.file_name,
                    newLocation: migrationResult
                });

            } catch (error) {
                console.error(`Error migrating file ${fileId}:`, error);
                errors.push({ fileId, error: error.message });
            }
        }

        res.json({
            success: true,
            migratedFiles: migratedFiles,
            errors: errors,
            message: `Successfully migrated ${migratedFiles.length} files`
        });

    } catch (error) {
        console.error('Error in file migration:', error);
        res.status(500).json({
            error: 'Failed to migrate files: ' + error.message
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
    } catch (error) {
        console.error('Error getting migration status:', error);
        res.status(500).json({
            error: 'Failed to get migration status: ' + error.message
        });
    }
});

module.exports = router;
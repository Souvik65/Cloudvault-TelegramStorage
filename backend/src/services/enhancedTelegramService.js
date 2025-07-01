const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram/tl');
const database = require('../config/database');

// Create a minimal logger that prevents update loop errors
class MinimalLogger {
    constructor() {
        this.level = 'none';
    }
    
    canSend() { return false; }
    info() {}
    warn() {}
    error() {}
    debug() {}
    log() {}
    setLevel() {}
}

class EnhancedTelegramService {
    constructor() {
        this.apiId = parseInt(process.env.TELEGRAM_API_ID);
        this.apiHash = process.env.TELEGRAM_API_HASH;
    }

    async createClient(sessionString) {
        const session = new StringSession(sessionString);
        
        // Create minimal logger to prevent update loop errors
        const minimalLogger = new MinimalLogger();
        
        const client = new TelegramClient(session, this.apiId, this.apiHash, {
            deviceModel: 'CloudVault Server',
            systemVersion: '1.0',
            appVersion: '1.0.0',
            langCode: 'en',
            systemLangCode: 'en',
            connectionRetries: 1,
            retryDelay: 500,
            timeout: 8000,
            useWSS: false,
            floodSleepThreshold: 30,
            autoReconnect: false,
            catchUp: false,
            receiveUpdates: false,
            maxConcurrentDownloads: 1,
            testServers: false,
            useIPv6: false,
            baseLogger: minimalLogger, // Use our minimal logger
            logger: minimalLogger       // Also set as main logger
        });
        
        try {
            await client.connect();
            
            // AGGRESSIVE: Completely disable and override update-related methods
            client._updateLoop = null;
            client._startUpdateLoop = () => { return Promise.resolve(); };
            client._handleUpdate = () => {};
            client._updateHandler = null;
            client._updatesHandler = null;
            client._shouldReconnect = false;
            
            // Override the _log property to prevent update loop errors
            client._log = minimalLogger;
            
            // Disable any existing update loops
            if (client._updateLoopHandle) {
                clearTimeout(client._updateLoopHandle);
                client._updateLoopHandle = null;
            }
            
            // Override methods that might start update loops
            client.catchUp = () => Promise.resolve();
            client._handleIncomingUpdates = () => {};
            
            console.log('Client created and update loops disabled');
            return client;
        } catch (error) {
            console.error('Failed to connect Telegram client:', error);
            try {
                await client.disconnect();
            } catch (disconnectError) {
                // Ignore disconnect errors
            }
            throw error;
        }
    }

    // Enhanced client wrapper with complete isolation
    async withClient(sessionString, operation, timeoutMs = 15000) {
        let client = null;
        let operationTimer = null;
        let isCompleted = false;
        
        return new Promise(async (resolve, reject) => {
            try {
                // Set up operation timeout
                operationTimer = setTimeout(() => {
                    if (!isCompleted) {
                        isCompleted = true;
                        reject(new Error(`Operation timeout after ${timeoutMs}ms`));
                    }
                }, timeoutMs);
                
                // Create client
                client = await this.createClient(sessionString);
                
                // Execute operation
                const result = await operation(client);
                
                if (!isCompleted) {
                    isCompleted = true;
                    clearTimeout(operationTimer);
                    resolve(result);
                }
                
            } catch (error) {
                if (!isCompleted) {
                    isCompleted = true;
                    if (operationTimer) clearTimeout(operationTimer);
                    console.error('Client operation failed:', error.message);
                    reject(error);
                }
            } finally {
                // Force disconnect in background
                if (client) {
                    setImmediate(async () => {
                        try {
                            await client.disconnect();
                            console.log('Client disconnected successfully');
                        } catch (disconnectError) {
                            console.error('Error disconnecting client:', disconnectError.message);
                        }
                    });
                }
            }
        });
    }

    // Get all available storage options for a user
    async getStorageOptions(sessionString) {
        return await this.withClient(sessionString, async (client) => {
            const dialogs = await client.getDialogs({ limit: 50 });
            
            const options = {
                savedMessages: { 
                    id: 'me', 
                    name: 'Saved Messages', 
                    type: 'saved_messages',
                    description: 'Store files in your Telegram Saved Messages (Default)'
                },
                channels: [],
                groups: [],
                bots: []
            };

            for (const dialog of dialogs) {
                const entity = dialog.entity;
                
                if (entity.className === 'Channel') {
                    if (entity.megagroup) {
                        options.groups.push({
                            id: entity.id.toString(),
                            name: entity.title,
                            type: 'supergroup',
                            canPost: entity.creator || entity.adminRights?.postMessages || !entity.defaultBannedRights?.sendMessages,
                            description: `Supergroup: ${entity.title}`
                        });
                    } else {
                        options.channels.push({
                            id: entity.id.toString(),
                            name: entity.title,
                            type: 'channel',
                            canPost: entity.creator || entity.adminRights?.postMessages,
                            description: `Channel: ${entity.title}`
                        });
                    }
                } else if (entity.className === 'Chat') {
                    options.groups.push({
                        id: entity.id.toString(),
                        name: entity.title,
                        type: 'group',
                        canPost: !entity.left && !entity.kicked,
                        description: `Group: ${entity.title}`
                    });
                } else if (entity.className === 'User' && entity.bot) {
                    options.bots.push({
                        id: entity.id.toString(),
                        name: entity.firstName || entity.username,
                        username: entity.username,
                        type: 'bot',
                        description: `Bot: @${entity.username}`
                    });
                }
            }

            return options;
        }, 10000);
    }

    // Create a private channel for file storage
    async createStorageChannel(sessionString, channelName, category = 'general') {
        return await this.withClient(sessionString, async (client) => {
            console.log('Creating storage channel:', channelName);
            
            const result = await client.invoke(
                new Api.channels.CreateChannel({
                    title: channelName,
                    about: `CloudVault storage channel for ${category} files. Created automatically.`,
                    broadcast: true,
                    megagroup: false
                })
            );

            const channel = result.chats[0];
            const channelId = channel.id.toString();
            
            console.log('Storage channel created successfully:', channelId);

            return {
                id: channelId,
                name: channelName,
                type: 'channel',
                category: category
            };
        }, 12000);
    }

    // Upload file using specified storage method
    async uploadFileWithMethod(sessionString, file, description, storageConfig) {
        return await this.withClient(sessionString, async (client) => {
            const { method = 'saved_messages', chatId } = storageConfig;
            
            console.log(`Uploading file using method: ${method}, target: ${chatId}`);

            let targetEntity;
            if (method === 'saved_messages' || chatId === 'me') {
                const me = await client.getMe();
                targetEntity = me.id;
            } else {
                try {
                    console.log('Resolving entity for chat ID:', chatId);
                    
                    let entity = null;
                    try {
                        entity = await client.getEntity(parseInt(chatId));
                        console.log('Entity resolved directly:', entity.className);
                    } catch (directError) {
                        console.log('Direct entity resolution failed, trying dialogs...');
                        const dialogs = await client.getDialogs({ limit: 50 });
                        for (const dialog of dialogs) {
                            if (dialog.entity.id.toString() === chatId) {
                                entity = dialog.entity;
                                console.log('Entity found in dialogs:', entity.className);
                                break;
                            }
                        }
                        
                        if (!entity) {
                            throw new Error(`Could not find entity with ID: ${chatId}. Please refresh storage options.`);
                        }
                    }
                    
                    targetEntity = entity;
                } catch (entityError) {
                    console.error('Error resolving entity:', entityError);
                    throw new Error(`Cannot access storage location: ${entityError.message}`);
                }
            }

            console.log('Target entity resolved, uploading file...');

            const message = await client.sendFile(targetEntity, {
                file: file.buffer,
                caption: `📁 ${file.originalname}\n📝 ${description || 'No description'}\n📅 ${new Date().toLocaleString()}\n💾 Size: ${this.formatFileSize(file.size)}\n🔧 Storage: ${method}`,
                attributes: [
                    new Api.DocumentAttributeFilename({
                        fileName: file.originalname,
                    }),
                ],
                forceDocument: true,
            });

            console.log('File uploaded successfully to:', method);
            console.log('Message ID:', message.id.toString());

            return {
                messageId: message.id.toString(),
                chatId: chatId,
                method: method
            };
        }, 30000); // 30 second timeout for file uploads
    }

    // Download file from specified storage location
    async downloadFileFromStorage(sessionString, messageId, chatId = 'me') {
        return await this.withClient(sessionString, async (client) => {
            console.log(`Downloading file from ${chatId}, message: ${messageId}`);
            
            let targetEntity;
            if (chatId === 'me') {
                const me = await client.getMe();
                targetEntity = me.id;
            } else {
                try {
                    targetEntity = await client.getEntity(parseInt(chatId));
                } catch (entityError) {
                    const dialogs = await client.getDialogs({ limit: 50 });
                    for (const dialog of dialogs) {
                        if (dialog.entity.id.toString() === chatId) {
                            targetEntity = dialog.entity;
                            break;
                        }
                    }
                    if (!targetEntity) {
                        throw new Error(`Cannot access storage location: ${chatId}`);
                    }
                }
            }
            
            const messages = await client.getMessages(targetEntity, {
                ids: [parseInt(messageId)],
            });

            if (!messages.length || !messages[0].media) {
                throw new Error('File not found');
            }

            const buffer = await client.downloadMedia(messages[0].media, {});
            return buffer;
        }, 25000);
    }

    // Delete file from specified storage location
    async deleteFileFromStorage(sessionString, messageId, chatId = 'me') {
        return await this.withClient(sessionString, async (client) => {
            console.log(`Deleting file from ${chatId}, message: ${messageId}`);
            
            if (chatId === 'me') {
                await client.invoke(
                    new Api.messages.DeleteMessages({
                        id: [parseInt(messageId)],
                    })
                );
            } else {
                let targetEntity;
                try {
                    targetEntity = await client.getEntity(parseInt(chatId));
                } catch (entityError) {
                    const dialogs = await client.getDialogs({ limit: 50 });
                    for (const dialog of dialogs) {
                        if (dialog.entity.id.toString() === chatId) {
                            targetEntity = dialog.entity;
                            break;
                        }
                    }
                    if (!targetEntity) {
                        throw new Error(`Cannot access storage location: ${chatId}`);
                    }
                }
                
                await client.invoke(
                    new Api.channels.DeleteMessages({
                        channel: targetEntity,
                        id: [parseInt(messageId)],
                    })
                );
            }
            return true;
        }, 8000);
    }

    // Migrate file between storage methods
    async migrateFile(sessionString, fileMetadata, newStorageConfig) {
        console.log('Migrating file:', fileMetadata.file_name);
        
        const fileBuffer = await this.downloadFileFromStorage(
            sessionString, 
            fileMetadata.telegram_message_id, 
            fileMetadata.telegram_chat_id
        );

        const fileObject = {
            originalname: fileMetadata.file_name,
            buffer: fileBuffer,
            size: fileMetadata.file_size
        };

        const uploadResult = await this.uploadFileWithMethod(
            sessionString, 
            fileObject, 
            fileMetadata.description, 
            newStorageConfig
        );

        try {
            await this.deleteFileFromStorage(
                sessionString, 
                fileMetadata.telegram_message_id, 
                fileMetadata.telegram_chat_id
            );
        } catch (error) {
            console.warn('Could not delete from old location:', error.message);
        }

        return uploadResult;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

module.exports = new EnhancedTelegramService();
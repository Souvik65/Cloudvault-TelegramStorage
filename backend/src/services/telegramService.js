const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram/tl');
const crypto = require('crypto');
const { computeCheck } = require('telegram/Password');

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


class TelegramService {
    constructor() {
        this.apiId = parseInt(process.env.TELEGRAM_API_ID);
        this.apiHash = process.env.TELEGRAM_API_HASH;
        this.activeClients = new Map(); // Store active clients per phone number for auth flow
    }

    async createClient(sessionString = '', phoneNumber = null, options = {}) {
        try {
            const session = new StringSession(sessionString);
            const minimalLogger = new MinimalLogger();
            
            const client = new TelegramClient(session, this.apiId, this.apiHash, {
                deviceModel: 'CloudVault Server',
                systemVersion: '1.0',
                appVersion: '1.0.0',
                langCode: 'en',
                systemLangCode: 'en',
                connectionRetries: 1,
                retryDelay: 500,
                timeout: options.timeout || 10000,
                useWSS: false,
                floodSleepThreshold: 30,
                autoReconnect: false,
                catchUp: false,
                receiveUpdates: false,
                maxConcurrentDownloads: 1,
                baseLogger: minimalLogger,
                logger: minimalLogger,
                ...options
            });

            await client.connect();
            
            // Aggressive update loop disabling
            client._updateLoop = null;
            client._startUpdateLoop = () => Promise.resolve();
            client._handleUpdate = () => {};
            client._updateHandler = null;
            client._updatesHandler = null;
            client._shouldReconnect = false;
            client._log = minimalLogger;
            
            if (client._updateLoopHandle) {
                clearTimeout(client._updateLoopHandle);
                client._updateLoopHandle = null;
            }
            
            client.catchUp = () => Promise.resolve();
            client._handleIncomingUpdates = () => {};
            
            if (phoneNumber) {
                this.activeClients.set(phoneNumber, client);
            }
            
            return client;
        } catch (error) {
            console.error('Failed to create Telegram client:', error);
            throw new Error('Failed to initialize Telegram client: ' + error.message);
        }
    }

    // Enhanced client wrapper with automatic cleanup
    async withClient(sessionString, operation) {
        let client = null;
        try {
            client = await this.createClient(sessionString);
            const result = await operation(client);
            return result;
        } catch (error) {
            console.error('Client operation failed:', error);
            throw error;
        } finally {
            if (client) {
                try {
                    await client.disconnect();
                    console.log('Client disconnected successfully');
                } catch (disconnectError) {
                    console.error('Error disconnecting client:', disconnectError);
                }
            }
        }
    }

    async getOrCreateClient(phoneNumber) {
        // Check if we have an active client for this phone number
        let client = this.activeClients.get(phoneNumber);
        
        if (client && client.connected) {
            console.log('Reusing existing client for:', phoneNumber);
            return client;
        }
        
        // Create new client
        console.log('Creating new client for:', phoneNumber);
        client = await this.createClient('', phoneNumber);
        return client;
    }

    async cleanupClient(phoneNumber) {
        const client = this.activeClients.get(phoneNumber);
        if (client) {
            try {
                await client.disconnect();
                console.log('Client disconnected for:', phoneNumber);
            } catch (error) {
                console.error('Error disconnecting client:', error);
            } finally {
                this.activeClients.delete(phoneNumber);
            }
        }
    }

    async sendCode(phoneNumber) {
        try {
            console.log('=== SEND CODE OPERATION ===');
            console.log('Phone number:', phoneNumber);
            console.log('API ID:', this.apiId);
            console.log('API Hash present:', !!this.apiHash);
            
            const client = await this.getOrCreateClient(phoneNumber);
            
            console.log('Client connected:', client.connected);
            console.log('Sending auth.SendCode request...');
            
            const result = await client.invoke(
                new Api.auth.SendCode({
                    phoneNumber: phoneNumber,
                    apiId: this.apiId,
                    apiHash: this.apiHash,
                    settings: new Api.CodeSettings({
                        allowFlashcall: true,
                        currentNumber: true,
                        allowAppHash: true,
                    }),
                })
            );

            console.log('SendCode result received:');
            console.log('- phoneCodeHash:', result.phoneCodeHash);
            console.log('- type:', result.type?.className);
            console.log('- timeout:', result.timeout);
            console.log('- nextType:', result.nextType?.className);
            console.log('=== END SEND CODE ===');

            return {
                phoneCodeHash: result.phoneCodeHash,
                type: result.type?.className || 'sms',
                nextType: result.nextType?.className || 'call',
                timeout: result.timeout || 60
            };

        } catch (error) {
            console.error('Error in sendCode:', error);
            await this.cleanupClient(phoneNumber);
            throw this.handleTelegramError(error);
        }
        // Note: We DON'T disconnect the client here - we keep it for verification
    }

    async verifyCode(phoneNumber, phoneCodeHash, phoneCode) {
        try {
            console.log('=== VERIFY CODE OPERATION ===');
            console.log('Phone number:', phoneNumber);
            console.log('Phone code:', phoneCode);
            console.log('Phone code hash:', phoneCodeHash);
            
            // Use the same client that was used for sendCode
            let client = this.activeClients.get(phoneNumber);
            
            if (!client || !client.connected) {
                console.log('No active client found, creating new one...');
                client = await this.createClient('', phoneNumber);
            } else {
                console.log('Using existing client for verification');
            }
            
            console.log('Client connected:', client.connected);
            console.log('Sending auth.SignIn request...');
            
            const result = await client.invoke(
                new Api.auth.SignIn({
                    phoneNumber: phoneNumber,
                    phoneCodeHash: phoneCodeHash,
                    phoneCode: phoneCode,
                })
            );

            console.log('SignIn result received:');
            console.log('- result type:', result.className);

            if (result.className === 'auth.AuthorizationSignUpRequired') {
                console.log('Account signup required');
                throw new Error('SIGNUP_REQUIRED');
            }

            const sessionString = client.session.save();
            console.log('Authentication successful!');
            console.log('- Session string length:', sessionString.length);
            console.log('- User ID:', result.user.id);
            console.log('- User phone:', result.user.phone);
            console.log('=== END VERIFY CODE ===');

            // Clean up the client after successful verification
            await this.cleanupClient(phoneNumber);

            return {
                user: {
                    id: result.user.id.toString(),
                    phone: result.user.phone,
                    firstName: result.user.firstName || '',
                    lastName: result.user.lastName || '',
                    username: result.user.username || null
                },
                sessionString: sessionString,
                requiresPassword: false
            };

        } catch (error) {
            console.error('Error in verifyCode:', error);
            console.error('Error details:', {
                name: error.constructor.name,
                message: error.message,
                code: error.code
            });
            
            if (error.message.includes('SESSION_PASSWORD_NEEDED')) {
                console.log('2FA password required');
                // DON'T clean up the client here - we need it for password verification
                return {
                    requiresPassword: true,
                    phoneNumber: phoneNumber,
                    phoneCodeHash: phoneCodeHash
                };
            }
            
            // Clean up client on error
            await this.cleanupClient(phoneNumber);
            throw this.handleTelegramError(error);
        }
    }

    async verifyPassword(phoneNumber, phoneCodeHash, password) {
        try {
            console.log('=== VERIFY PASSWORD OPERATION ===');
            console.log('Phone number:', phoneNumber);
            console.log('Password length:', password.length);
            
            // Use the same client that was used for sendCode/verifyCode
            let client = this.activeClients.get(phoneNumber);
            
            if (!client || !client.connected) {
                console.log('No active client found for 2FA, this might be the issue...');
                console.log('Creating new client and re-authenticating...');
                
                // If no active client, we need to restart the auth flow
                client = await this.createClient('', phoneNumber);
                
                // Re-send the signin request first to get the 2FA state
                console.log('Re-sending auth.SignIn to get 2FA prompt...');
                try {
                    await client.invoke(
                        new Api.auth.SignIn({
                            phoneNumber: phoneNumber,
                            phoneCodeHash: phoneCodeHash,
                            phoneCode: '12345', // This will trigger SESSION_PASSWORD_NEEDED
                        })
                    );
                } catch (authError) {
                    if (!authError.message.includes('SESSION_PASSWORD_NEEDED')) {
                        console.error('Unexpected error in re-auth:', authError);
                        throw authError;
                    }
                    console.log('Got expected SESSION_PASSWORD_NEEDED, continuing with 2FA...');
                }
            } else {
                console.log('Using existing client for 2FA verification');
            }
            
            // Get password configuration
            console.log('Getting password data...');
            const passwordData = await client.invoke(new Api.account.GetPassword());
            
            console.log('Password data received:');
            console.log('- Has password:', !!passwordData.hasPassword);
            console.log('- Current salt:', passwordData.currentSalt ? 'Present' : 'Missing');
            console.log('- New salt:', passwordData.newSalt ? 'Present' : 'Missing');
            console.log('- SRP ID:', passwordData.srpId?.toString());
            console.log('- SRP B:', passwordData.srpB ? 'Present' : 'Missing');
            console.log('- Secure random:', passwordData.secureRandom ? 'Present' : 'Missing');
            
            if (!passwordData.hasPassword) {
                throw new Error('Account does not have 2FA enabled');
            }

            console.log('Computing password using GramJS built-in method...');
            
            let result;
            try {
                // Use the GramJS built-in computeCheck function
                const passwordHash = await computeCheck(passwordData, password);
                console.log('Password hash computed successfully using GramJS built-in method');
                
                result = await client.invoke(
                    new Api.auth.CheckPassword({
                        password: passwordHash
                    })
                );
                
                console.log('2FA verification successful using built-in method!');
                
            } catch (builtinError) {
                console.error('Built-in computeCheck failed:', builtinError);
                console.log('Trying alternative approach...');
                
                // Alternative approach: Use the client's internal auth methods
                try {
                    // Use sign in with empty code to trigger password prompt, then use the client's internal methods
                    const { computeCheck: internalComputeCheck } = require('telegram/Password');
                    const passwordHash = await internalComputeCheck(passwordData, password);
                    
                    result = await client.invoke(
                        new Api.auth.CheckPassword({
                            password: passwordHash
                        })
                    );
                    
                    console.log('2FA verification successful using internal method!');
                    
                } catch (internalError) {
                    console.error('Internal method failed:', internalError);
                    console.log('Trying manual computation...');
                    
                    // Last resort: manual computation
                    const passwordHash = await this.computePasswordManually(password, passwordData);
                    
                    result = await client.invoke(
                        new Api.auth.CheckPassword({
                            password: passwordHash
                        })
                    );
                    
                    console.log('2FA verification successful using manual method!');
                }
            }

            const sessionString = client.session.save();
            console.log('2FA verification successful!');
            console.log('- Session string length:', sessionString.length);
            console.log('- User ID:', result.user.id);
            console.log('=== END VERIFY PASSWORD ===');

            // Clean up the client after successful verification
            await this.cleanupClient(phoneNumber);

            return {
                user: {
                    id: result.user.id.toString(),
                    phone: result.user.phone,
                    firstName: result.user.firstName || '',
                    lastName: result.user.lastName || '',
                    username: result.user.username || null
                },
                sessionString: sessionString
            };

        } catch (error) {
            console.error('Error in verifyPassword:', error);
            console.error('Error details:', {
                name: error.constructor.name,
                message: error.message,
                code: error.code,
                stack: error.stack
            });
            
            await this.cleanupClient(phoneNumber);
            throw this.handleTelegramError(error);
        }
    }

    async uploadFile(sessionString, file, description = '') {
        const maxRetries = 2;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`=== FILE UPLOAD ATTEMPT ${attempt}/${maxRetries} ===`);
                console.log('File details:', {
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size,
                    sizeFormatted: this.formatFileSize(file.size)
                });
                
                // Validate inputs
                if (!sessionString) {
                    throw new Error('No session string provided. Please login again.');
                }
                
                if (!file || !file.buffer || !Buffer.isBuffer(file.buffer)) {
                    throw new Error('Invalid file data.');
                }
                
                // Check file size - limit to 50MB for now to avoid timeouts
                const maxSize = 50 * 1024 * 1024; // 50MB
                if (file.size > maxSize) {
                    throw new Error(`File too large. Maximum size is ${this.formatFileSize(maxSize)}. Please use smaller files.`);
                }
                
                return await this.withClient(sessionString, async (client) => {
                    console.log('Client connected successfully');
                    
                    // Check authentication
                    const me = await client.getMe();
                    console.log('Client authenticated as user:', me.id.toString());
                    
                    // Try simple text message first to test connection
                    console.log('Testing connection with simple message...');
                    try {
                        const testMessage = await client.sendMessage(me.id, {
                            message: `📤 Uploading file: ${file.originalname} (${this.formatFileSize(file.size)})`
                        });
                        console.log('Test message sent successfully:', testMessage.id);
                    } catch (testError) {
                        console.error('Test message failed:', testError);
                        throw new Error('Connection test failed. Please try again.');
                    }
                    
                    // Upload file to saved messages
                    console.log('Uploading file to saved messages...');
                    const message = await client.sendFile(me.id, {
                        file: file.buffer,
                        caption: `📁 ${file.originalname}\n📝 ${description || 'No description'}\n📅 ${new Date().toLocaleString()}\n💾 Size: ${this.formatFileSize(file.size)}`,
                        attributes: [
                            new Api.DocumentAttributeFilename({
                                fileName: file.originalname,
                            }),
                        ],
                        forceDocument: true,
                        parseMode: null,
                    });
                    
                    console.log('File uploaded successfully!');
                    console.log('Message ID:', message.id.toString());
                    console.log('=== END FILE UPLOAD ===');

                    return {
                        messageId: message.id.toString(),
                        fileName: file.originalname,
                        fileSize: file.size,
                        description: description
                    };
                });

            } catch (error) {
                console.error(`Upload attempt ${attempt} failed:`, error.message);
                
                // If this was the last attempt, throw the error
                if (attempt === maxRetries) {
                    console.error('All upload attempts failed');
                    
                    // Provide specific error messages
                    if (error.message.includes('TIMEOUT') || error.message.includes('timeout')) {
                        throw new Error('Upload timeout. Please try uploading a smaller file or check your internet connection.');
                    } else if (error.message.includes('FLOOD_WAIT')) {
                        throw new Error('Upload rate limit reached. Please wait a moment and try again.');
                    } else if (error.message.includes('FILE_PARTS_INVALID')) {
                        throw new Error('File upload failed. The file may be corrupted.');
                    } else if (error.message.includes('SESSION_EXPIRED') || error.message.includes('AUTH_KEY_UNREGISTERED')) {
                        throw new Error('Session expired. Please login again.');
                    }
                    
                    throw new Error('Upload failed after multiple attempts. Please try again later.');
                }
                
                // Wait before retrying
                console.log(`Waiting 2 seconds before retry attempt ${attempt + 1}...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    async downloadFile(sessionString, messageId) {
        return await this.withClient(sessionString, async (client) => {
            console.log('=== FILE DOWNLOAD OPERATION ===');
            console.log('Message ID:', messageId);
            
            const me = await client.getMe();
            console.log('Getting message from Saved Messages...');
            
            const messages = await client.getMessages(me.id, {
                ids: [parseInt(messageId)],
            });

            if (!messages.length || !messages[0].media) {
                throw new Error('File not found in Telegram');
            }

            const message = messages[0];
            console.log('Message found, downloading file...');
            
            const buffer = await client.downloadMedia(message.media, {});
            console.log('File downloaded successfully, size:', buffer.length);
            console.log('=== END FILE DOWNLOAD ===');
            
            return buffer;
        });
    }

    async deleteFile(sessionString, messageId) {
        return await this.withClient(sessionString, async (client) => {
            console.log('=== FILE DELETE OPERATION ===');
            console.log('Message ID:', messageId);
            
            await client.invoke(
                new Api.messages.DeleteMessages({
                    id: [parseInt(messageId)],
                })
            );

            console.log('File deleted successfully');
            console.log('=== END FILE DELETE ===');
            return true;
        });
    }

    async computePasswordManually(password, passwordData) {
        try {
            console.log('Computing password manually...');
            
            // Basic password hash computation
            const passwordBytes = Buffer.from(password, 'utf8');
            
            if (passwordData.currentSalt && passwordData.newSalt) {
                // Use the salts if available
                const hash1 = crypto.createHash('sha256')
                    .update(passwordData.currentSalt)
                    .update(passwordBytes)
                    .update(passwordData.currentSalt)
                    .digest();

                const hash2 = crypto.createHash('sha256')
                    .update(passwordData.newSalt)
                    .update(hash1)
                    .update(passwordData.newSalt)
                    .digest();

                return hash2;
            } else {
                // Simple hash if no salts
                return crypto.createHash('sha256').update(passwordBytes).digest();
            }
            
        } catch (error) {
            console.error('Error in manual password computation:', error);
            throw error;
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    handleTelegramError(error) {
        const errorMessage = error.message || error.toString();
        console.error('Handling Telegram error:', errorMessage);
        
        if (errorMessage.includes('PHONE_NUMBER_INVALID')) {
            return new Error('Invalid phone number format');
        } else if (errorMessage.includes('PHONE_CODE_INVALID')) {
            return new Error('Invalid verification code');
        } else if (errorMessage.includes('PHONE_CODE_EXPIRED')) {
            return new Error('Verification code expired');
        } else if (errorMessage.includes('PASSWORD_HASH_INVALID')) {
            return new Error('Invalid 2FA password. Please check your password and try again.');
        } else if (errorMessage.includes('FLOOD_WAIT')) {
            return new Error('Too many requests. Please wait before trying again');
        } else if (errorMessage.includes('SIGNUP_REQUIRED')) {
            return new Error('Account not found. Please sign up first in Telegram app');
        } else if (errorMessage.includes('SRP_PASSWORD_CHANGED')) {
            return new Error('Password was changed recently. Please try again in a few minutes.');
        } else if (errorMessage.includes('SRP_ID_INVALID')) {
            return new Error('Invalid password session. Please restart the login process.');
        } else if (errorMessage.includes('SESSION_EXPIRED') || error.message.includes('AUTH_KEY_UNREGISTERED')) {
            return new Error('Session expired. Please login again.');
        } else if (errorMessage.includes('TIMEOUT') || errorMessage.includes('timeout')) {
            return new Error('Connection timeout. Please check your internet connection and try again.');
        }
        
        return new Error('Operation failed. Please try again.');
    }

    // Cleanup method to be called on server shutdown
    async cleanup() {
        console.log('Cleaning up all active Telegram clients...');
        for (const [phoneNumber, client] of this.activeClients) {
            try {
                await client.disconnect();
                console.log('Disconnected client for:', phoneNumber);
            } catch (error) {
                console.error('Error disconnecting client for', phoneNumber, ':', error);
            }
        }
        this.activeClients.clear();
        console.log('Telegram service cleanup completed');
    }
}

module.exports = new TelegramService();
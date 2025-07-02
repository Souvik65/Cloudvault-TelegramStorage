const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const jwt = require('jsonwebtoken');
const database = require('../config/database');

// Store pending authentications
const pendingAuth = new Map();

const sendCode = async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        console.log('Attempting to send code to:', phoneNumber);
        console.log('=== SEND CODE OPERATION ===');
        console.log('Phone number:', phoneNumber);
        console.log('API ID:', process.env.TELEGRAM_API_ID);
        console.log('API Hash present:', !!process.env.TELEGRAM_API_HASH);

        // Clean up any existing pending auth
        if (pendingAuth.has(phoneNumber)) {
            try {
                const { client } = pendingAuth.get(phoneNumber);
                await client.disconnect();
                pendingAuth.delete(phoneNumber);
                console.log('Cleaned up existing auth session');
            } catch (e) {
                console.log('Cleanup error:', e.message);
            }
        }

        // Create client
        const session = new StringSession('');
        const client = new TelegramClient(
            session,
            parseInt(process.env.TELEGRAM_API_ID),
            process.env.TELEGRAM_API_HASH,
            { 
                connectionRetries: 5,
                timeout: 30000,
                retryDelay: 1000
            }
        );

        console.log('Connecting to Telegram...');
        await client.connect();
        console.log('Connected to Telegram successfully');

        console.log('Sending auth code request...');

        // Use a different approach - start the auth process but catch the code request
        let codeSent = false;
        let phoneCodeHash = null;

        try {
            await client.start({
                phoneNumber: async () => {
                    console.log('Telegram asking for phone number...');
                    return phoneNumber;
                },
                password: async () => {
                    console.log('Telegram asking for password (2FA detected)');
                    throw new Error('Two-factor authentication is enabled. Please disable it temporarily.');
                },
                phoneCode: async () => {
                    console.log('Telegram asking for phone code - this means code was sent!');
                    codeSent = true;
                    
                    // We don't have the code yet, so we'll throw an error to stop here
                    // and handle the code input in the verify step
                    throw new Error('CODE_REQUESTED');
                },
                onError: (err) => {
                    console.log('Auth process error:', err.message);
                    if (err.message === 'CODE_REQUESTED') {
                        // This is expected - code was sent successfully
                        return;
                    }
                    throw err;
                }
            });
        } catch (error) {
            if (error.message === 'CODE_REQUESTED' || codeSent) {
                console.log('Code sending process completed successfully');
            } else {
                throw error; // Re-throw unexpected errors
            }
        }

        if (codeSent) {
            // Generate a temporary hash for this session
            const tempHash = Buffer.from(`${phoneNumber}-${Date.now()}`).toString('base64');
            
            // Store the client and session info
            pendingAuth.set(phoneNumber, {
                client,
                phoneCodeHash: tempHash,
                timestamp: Date.now()
            });

            console.log('Auth code sent successfully');
            console.log('Phone code hash:', tempHash);
            console.log('Code type: auth.SentCodeTypeApp');
            console.log('=== END SEND CODE (SUCCESS) ===');

            res.json({
                success: true,
                message: 'Verification code sent successfully. Please check your Telegram app.',
                phoneCodeHash: tempHash,
                codeType: 'auth.SentCodeTypeApp'
            });
        } else {
            throw new Error('Failed to initiate code sending process');
        }

    } catch (error) {
        console.error('Send code error:', error);
        
        // Clean up on error
        if (pendingAuth.has(req.body.phoneNumber)) {
            try {
                const { client } = pendingAuth.get(req.body.phoneNumber);
                await client.disconnect();
                pendingAuth.delete(req.body.phoneNumber);
            } catch (e) {
                console.error('Cleanup error:', e);
            }
        }

        let errorMessage = 'Failed to send verification code. Please try again.';
        
        if (error.message.includes('PHONE_NUMBER_INVALID')) {
            errorMessage = 'Invalid phone number format. Please use international format (+1234567890)';
        } else if (error.message.includes('FLOOD_WAIT')) {
            const waitTime = error.message.match(/(\d+)/)?.[1] || '60';
            errorMessage = `Please wait ${waitTime} seconds before trying again`;
        } else if (error.message.includes('Two-factor authentication')) {
            errorMessage = error.message;
        }

        res.status(400).json({
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const verifyCode = async (req, res) => {
    try {
        const { phoneNumber, code, phoneCodeHash } = req.body;

        if (!phoneNumber || !code || !phoneCodeHash) {
            return res.status(400).json({ 
                error: 'Phone number, code, and phone code hash are required' 
            });
        }

        console.log('=== VERIFY CODE OPERATION ===');
        console.log('Phone number:', phoneNumber);
        console.log('Code:', code);
        console.log('Phone code hash:', phoneCodeHash);

        const authData = pendingAuth.get(phoneNumber);
        if (!authData) {
            console.log('No pending auth session found');
            return res.status(400).json({ 
                error: 'Session expired. Please request a new verification code.' 
            });
        }

        if (authData.phoneCodeHash !== phoneCodeHash) {
            console.log('Phone code hash mismatch');
            return res.status(400).json({ 
                error: 'Invalid session. Please request a new verification code.' 
            });
        }

        if (Date.now() - authData.timestamp > 10 * 60 * 1000) {
            console.log('Session expired');
            return res.status(400).json({ 
                error: 'Verification code expired. Please request a new one.' 
            });
        }

        console.log('Verifying code with existing client...');

        // Get the existing client
        const { client } = authData;

        // Create a fresh client for verification to avoid state issues
        const verificationSession = new StringSession('');
        const verificationClient = new TelegramClient(
            verificationSession,
            parseInt(process.env.TELEGRAM_API_ID),
            process.env.TELEGRAM_API_HASH,
            { 
                connectionRetries: 5,
                timeout: 30000 
            }
        );

        await verificationClient.connect();

        // Complete authentication with the provided code
        console.log('Completing authentication with provided code...');
        await verificationClient.start({
            phoneNumber: async () => {
                console.log('Providing phone number for verification...');
                return phoneNumber;
            },
            password: async () => {
                console.log('2FA requested during verification');
                throw new Error('Two-factor authentication is enabled. Please disable it temporarily.');
            },
            phoneCode: async () => {
                console.log('Providing verification code...');
                return code;
            },
            onError: (err) => {
                console.error('Verification error:', err.message);
                throw err;
            }
        });

        console.log('Authentication successful!');

        // Get user info
        const me = await verificationClient.getMe();
        console.log('User ID:', me.id);
        console.log('Username:', me.username);

        const sessionString = verificationClient.session.save();

        // Save user to database
        try {
            const userIdStr = me.id.toString();
            
            const existingUser = await database.query(
                'SELECT * FROM users WHERE telegram_id = ?',
                [userIdStr]
            );

            let userId;
            if (existingUser.rows && existingUser.rows.length > 0) {
                await database.query(
                    'UPDATE users SET phone_number = ?, session_string = ? WHERE telegram_id = ?',
                    [phoneNumber, sessionString, userIdStr]
                );
                userId = existingUser.rows[0].id;
                console.log('Updated existing user:', userId);
            } else {
                const newUser = await database.query(
                    'INSERT INTO users (telegram_id, phone_number, session_string, storage_preference, storage_config) VALUES (?, ?, ?, ?, ?)',
                    [userIdStr, phoneNumber, sessionString, 'saved_messages', JSON.stringify({})]
                );
                userId = newUser.rows[0].id;
                console.log('Created new user:', userId);
            }

            // Generate JWT
            const token = jwt.sign(
                { 
                    userId, 
                    telegramId: userIdStr, 
                    phoneNumber 
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
            );

            // Clean up both clients and pending auth
            try {
                await client.disconnect();
                await verificationClient.disconnect();
            } catch (e) {
                console.log('Client disconnect error:', e.message);
            }
            
            pendingAuth.delete(phoneNumber);

            console.log('=== VERIFY CODE SUCCESS ===');

            res.json({
                success: true,
                message: 'Authentication successful',
                token,
                user: {
                    id: userId,
                    telegramId: userIdStr,
                    phoneNumber,
                    username: me.username,
                    firstName: me.firstName,
                    lastName: me.lastName
                }
            });

        } catch (dbError) {
            console.error('Database error during user save:', dbError);
            res.status(500).json({ 
                error: 'Authentication successful but failed to save user data. Please try again.' 
            });
        }

    } catch (error) {
        console.error('Verify code error:', error);

        let errorMessage = 'Failed to verify code. Please try again.';
        
        if (error.message.includes('PHONE_CODE_INVALID')) {
            errorMessage = 'Invalid verification code. Please check and try again.';
        } else if (error.message.includes('PHONE_CODE_EXPIRED')) {
            errorMessage = 'Verification code expired. Please request a new one.';
        } else if (error.message.includes('SESSION_PASSWORD_NEEDED') || 
                   error.message.includes('Two-factor authentication')) {
            errorMessage = 'Two-factor authentication is enabled. Please disable it temporarily.';
        }

        res.status(400).json({
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getMe = async (req, res) => {
    try {
        const userId = req.user.userId;

        const user = await database.query(
            'SELECT * FROM users WHERE id = ?',
            [userId]
        );

        if (!user.rows || user.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userData = user.rows[0];

        res.json({
            success: true,
            user: {
                id: userData.id,
                telegramId: userData.telegram_id,
                phoneNumber: userData.phone_number,
                storagePreference: userData.storage_preference,
                storageConfig: JSON.parse(userData.storage_config || '{}'),
                createdAt: userData.created_at
            }
        });

    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ 
            error: 'Failed to get user information',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const logout = async (req, res) => {
    try {
        const phoneNumber = req.user.phoneNumber;

        // Clean up any pending auth
        if (pendingAuth.has(phoneNumber)) {
            try {
                const { client } = pendingAuth.get(phoneNumber);
                await client.disconnect();
                pendingAuth.delete(phoneNumber);
                console.log('Cleaned up pending auth for:', phoneNumber);
            } catch (clientError) {
                console.error('Error cleaning up pending auth:', clientError);
            }
        }

        res.json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ 
            error: 'Failed to logout',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    sendCode,
    verifyCode,
    getMe,
    logout
};
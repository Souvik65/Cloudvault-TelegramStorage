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

        // Clean up any existing pending auth
        if (pendingAuth.has(phoneNumber)) {
            try {
                const { client } = pendingAuth.get(phoneNumber);
                await client.disconnect();
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
            { connectionRetries: 5 }
        );

        await client.connect();

        // Store the client and create a promise for the auth flow
        const authPromise = new Promise((resolve, reject) => {
            client.start({
                phoneNumber: async () => phoneNumber,
                password: async () => {
                    reject(new Error('Two-factor authentication is enabled. Please disable it temporarily.'));
                },
                phoneCode: async () => {
                    // This will be called when code is needed
                    // We resolve here to indicate code was sent
                    resolve('CODE_SENT');
                    
                    // Return a placeholder - the real code will come from frontend
                    return 'PLACEHOLDER';
                },
                onError: (err) => {
                    console.error('Auth error:', err);
                    reject(err);
                }
            }).catch(reject);
        });

        // Store pending authentication
        const tempHash = Buffer.from(`${phoneNumber}-${Date.now()}`).toString('base64');
        pendingAuth.set(phoneNumber, {
            client,
            phoneCodeHash: tempHash,
            timestamp: Date.now(),
            authPromise
        });

        // Wait for code to be sent
        const result = await authPromise;
        
        if (result === 'CODE_SENT') {
            console.log('Code sent successfully');
            
            res.json({
                success: true,
                message: 'Verification code sent successfully. Please check your Telegram app.',
                phoneCodeHash: tempHash
            });
        }

    } catch (error) {
        console.error('Send code error:', error);
        
        // Clean up
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

        console.log('Verifying code for:', phoneNumber);

        const authData = pendingAuth.get(phoneNumber);
        if (!authData) {
            return res.status(400).json({ 
                error: 'Session expired. Please request a new verification code.' 
            });
        }

        if (authData.phoneCodeHash !== phoneCodeHash) {
            return res.status(400).json({ 
                error: 'Invalid session. Please request a new verification code.' 
            });
        }

        if (Date.now() - authData.timestamp > 10 * 60 * 1000) {
            return res.status(400).json({ 
                error: 'Verification code expired. Please request a new one.' 
            });
        }

        // Create a new client for verification (clean approach)
        const session = new StringSession('');
        const client = new TelegramClient(
            session,
            parseInt(process.env.TELEGRAM_API_ID),
            process.env.TELEGRAM_API_HASH,
            { connectionRetries: 5 }
        );

        await client.connect();

        // Complete authentication with the provided code
        await client.start({
            phoneNumber: async () => phoneNumber,
            password: async () => {
                throw new Error('Two-factor authentication is enabled. Please disable it temporarily.');
            },
            phoneCode: async () => code,
            onError: (err) => {
                console.error('Verification error:', err);
                throw err;
            }
        });

        console.log('Authentication successful');

        // Get user info
        const me = await client.getMe();
        const sessionString = client.session.save();

        // Save to database
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
        } else {
            const newUser = await database.query(
                'INSERT INTO users (telegram_id, phone_number, session_string, storage_preference, storage_config) VALUES (?, ?, ?, ?, ?)',
                [userIdStr, phoneNumber, sessionString, 'saved_messages', JSON.stringify({})]
            );
            userId = newUser.rows[0].id;
        }

        // Generate JWT
        const token = jwt.sign(
            { userId, telegramId: userIdStr, phoneNumber },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // Clean up
        pendingAuth.delete(phoneNumber);

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

    } catch (error) {
        console.error('Verify code error:', error);

        let errorMessage = 'Failed to verify code. Please try again.';
        
        if (error.message.includes('PHONE_CODE_INVALID')) {
            errorMessage = 'Invalid verification code. Please check and try again.';
        } else if (error.message.includes('Two-factor authentication')) {
            errorMessage = error.message;
        }

        res.status(400).json({
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ... getMe and logout remain the same

module.exports = {
    sendCode,
    verifyCode,
    getMe,
    logout
};
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { computeCheck } = require('telegram/Password');
const jwt = require('jsonwebtoken');
const database = require('../config/database');

// Store pending authentications
const pendingAuth = new Map();

const sendCode = async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        if (!phoneNumber || !phoneNumber.startsWith('+')) {
            return res.status(400).json({ 
                error: 'Please provide a valid phone number with country code' 
            });
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

        // Send auth code using sendCode method
        const { Api } = require('telegram/tl');
        const result = await client.invoke(
            new Api.auth.SendCode({
                phoneNumber: phoneNumber,
                apiId: parseInt(process.env.TELEGRAM_API_ID),
                apiHash: process.env.TELEGRAM_API_HASH,
                settings: new Api.CodeSettings({})
            })
        );

        console.log('Auth code sent successfully');
        console.log('Phone code hash:', result.phoneCodeHash);

        // Store the client and session info
        pendingAuth.set(phoneNumber, {
            client,
            phoneCodeHash: result.phoneCodeHash,
            timestamp: Date.now()
        });

        // Store in database for persistence
        const db = database.getDb();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        
        await new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM auth_sessions WHERE phone_number = ?',
                [phoneNumber],
                (err) => {
                    if (err) {
                        console.error('Error deleting old session:', err);
                    }
                    
                    db.run(
                        'INSERT INTO auth_sessions (phone_number, phone_code_hash, expires_at) VALUES (?, ?, ?)',
                        [phoneNumber, result.phoneCodeHash, expiresAt.toISOString()],
                        (err) => {
                            if (err) {
                                console.error('Error storing session:', err);
                                reject(err);
                            } else {
                                resolve();
                            }
                        }
                    );
                }
            );
        });

        console.log('=== END SEND CODE (SUCCESS) ===');

        res.json({ 
            success: true, 
            message: 'Code sent successfully',
            phoneCodeHash: result.phoneCodeHash
        });

    } catch (error) {
        console.error('Send code error:', error);
        
        // Clean up on error
        if (req.body.phoneNumber && pendingAuth.has(req.body.phoneNumber)) {
            try {
                const { client } = pendingAuth.get(req.body.phoneNumber);
                await client.disconnect();
                pendingAuth.delete(req.body.phoneNumber);
            } catch (e) {
                console.log('Cleanup error:', e.message);
            }
        }

        res.status(400).json({ 
            error: error.message || 'Failed to send verification code',
            code: 'SEND_CODE_FAILED'
        });
    }
};

const verifyCode = async (req, res) => {
    try {
        const { phoneNumber, code, phoneCodeHash } = req.body;

        console.log('=== VERIFY CODE OPERATION ===');
        console.log('Phone number:', phoneNumber);
        console.log('Code:', code);
        console.log('Phone code hash:', phoneCodeHash);

        if (!phoneNumber || !code || !phoneCodeHash) {
            return res.status(400).json({ 
                error: 'Phone number, code, and phone code hash are required' 
            });
        }

        // Get pending auth data
        const authData = pendingAuth.get(phoneNumber);
        if (!authData) {
            return res.status(400).json({ 
                error: 'No pending authentication found. Please request a new code.' 
            });
        }

        const { client } = authData;

        console.log('Verifying code with existing client...');

        try {
            // Attempt to sign in with the code
            const { Api } = require('telegram/tl');
            const result = await client.invoke(
                new Api.auth.SignIn({
                    phoneNumber: phoneNumber,
                    phoneCodeHash: phoneCodeHash,
                    phoneCode: code
                })
            );

            console.log('Sign in successful!');

            // Get user info
            const me = await client.getMe();
            console.log('User info retrieved:', {
                id: me.id.toString(),
                firstName: me.firstName,
                lastName: me.lastName,
                username: me.username,
                phone: me.phone
            });

            // Save session to database
            const sessionString = client.session.save();
            const db = database.getDb();
            
            await new Promise((resolve, reject) => {
                db.run(
                    'INSERT OR REPLACE INTO users (telegram_id, phone_number, first_name, last_name, username, session_string, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))',
                    [
                        me.id.toString(),
                        phoneNumber,
                        me.firstName || '',
                        me.lastName || '',
                        me.username || '',
                        sessionString
                    ],
                    (err) => {
                        if (err) {
                            console.error('Error saving user:', err);
                            reject(err);
                        } else {
                            console.log('User saved to database');
                            resolve();
                        }
                    }
                );
            });

            // Generate JWT token
            const token = jwt.sign(
                { 
                    userId: me.id.toString(),
                    phoneNumber: phoneNumber,
                    firstName: me.firstName,
                    lastName: me.lastName
                },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            // Clean up pending auth but keep client connected for future use
            pendingAuth.delete(phoneNumber);

            console.log('Authentication completed successfully');

            res.json({
                success: true,
                token: token,
                user: {
                    id: me.id.toString(),
                    phoneNumber: phoneNumber,
                    firstName: me.firstName || '',
                    lastName: me.lastName || '',
                    username: me.username || ''
                }
            });

        } catch (signInError) {
            console.log('Sign in error:', signInError);

            // Check if this is a 2FA (Two-Factor Authentication) error
            if (signInError.errorMessage === 'SESSION_PASSWORD_NEEDED') {
                console.log('2FA detected, password required');
                
                // Don't clean up the client, we'll need it for password verification
                res.json({
                    success: false,
                    requiresPassword: true,
                    message: 'Two-factor authentication is enabled. Please enter your password.'
                });
                return;
            }

            // Handle other sign-in errors
            let errorMessage = 'Invalid verification code';
            if (signInError.errorMessage === 'PHONE_CODE_EXPIRED') {
                errorMessage = 'Verification code has expired. Please request a new one.';
            } else if (signInError.errorMessage === 'PHONE_CODE_INVALID') {
                errorMessage = 'Invalid verification code. Please check and try again.';
            }

            throw new Error(errorMessage);
        }

    } catch (error) {
        console.error('Verify code error:', error);
        
        res.status(400).json({ 
            error: error.message || 'Failed to verify code',
            code: 'VERIFY_CODE_FAILED'
        });
    }
};

const verifyPassword = async (req, res) => {
    try {
        const { phoneNumber, password } = req.body;

        console.log('=== VERIFY PASSWORD OPERATION ===');
        console.log('Phone number:', phoneNumber);
        console.log('Password provided:', !!password);

        if (!phoneNumber || !password) {
            return res.status(400).json({ 
                error: 'Phone number and password are required' 
            });
        }

        // Get pending auth data
        const authData = pendingAuth.get(phoneNumber);
        if (!authData) {
            return res.status(400).json({ 
                error: 'No pending authentication found. Please start the login process again.' 
            });
        }

        const { client } = authData;

        console.log('Verifying 2FA password...');

        try {
            // Import required classes
            const { Api } = require('telegram/tl');
            
            console.log('Getting password account info...');
            
            // Get password account information
            const passwordInfo = await client.invoke(
                new Api.account.GetPassword()
            );

            console.log('Password info retrieved successfully');
            console.log('SRP ID:', passwordInfo.srpId?.toString());
            console.log('Has recovery:', !!passwordInfo.hasRecovery);

            // Validate password info before proceeding
            if (!passwordInfo.hasPassword) {
                throw new Error('Two-factor authentication is not enabled for this account.');
            }

            console.log('Computing password hash using SRP...');
            
            // Compute password hash using SRP
            const inputCheckPassword = await computeCheck(passwordInfo, password);
            
            console.log('Password hash computed successfully, sending check password request...');

            // Check the password
            const result = await client.invoke(
                new Api.auth.CheckPassword({
                    password: inputCheckPassword
                })
            );

            console.log('2FA password verification successful!');
            console.log('Auth result type:', result.className);

            // Get user info
            const me = await client.getMe();
            console.log('User info retrieved:', {
                id: me.id.toString(),
                firstName: me.firstName,
                lastName: me.lastName,
                username: me.username,
                phone: me.phone
            });

            // Save session to database
            const sessionString = client.session.save();
            const db = database.getDb();
            
            await new Promise((resolve, reject) => {
                db.run(
                    'INSERT OR REPLACE INTO users (telegram_id, phone_number, first_name, last_name, username, session_string, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))',
                    [
                        me.id.toString(),
                        phoneNumber,
                        me.firstName || '',
                        me.lastName || '',
                        me.username || '',
                        sessionString
                    ],
                    (err) => {
                        if (err) {
                            console.error('Error saving user:', err);
                            reject(err);
                        } else {
                            console.log('User saved to database');
                            resolve();
                        }
                    }
                );
            });

            // Generate JWT token
            const token = jwt.sign(
                { 
                    userId: me.id.toString(),
                    phoneNumber: phoneNumber,
                    firstName: me.firstName,
                    lastName: me.lastName
                },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            // Clean up pending auth
            pendingAuth.delete(phoneNumber);

            console.log('2FA authentication completed successfully');

            res.json({
                success: true,
                token: token,
                user: {
                    id: me.id.toString(),
                    phoneNumber: phoneNumber,
                    firstName: me.firstName || '',
                    lastName: me.lastName || '',
                    username: me.username || ''
                }
            });

        } catch (passwordError) {
            console.log('Password verification error:', passwordError);
            console.log('Error message:', passwordError.errorMessage);
            console.log('Error code:', passwordError.code);

            let errorMessage = 'Invalid password';
            
            if (passwordError.errorMessage === 'PASSWORD_HASH_INVALID') {
                errorMessage = 'Invalid password. Please check your 2FA password and try again.';
            } else if (passwordError.errorMessage === 'SRP_PASSWORD_CHANGED') {
                errorMessage = 'Password has been changed recently. Please try again.';
            } else if (passwordError.errorMessage === 'PASSWORD_REQUIRED') {
                errorMessage = 'Password is required for this account.';
            } else if (passwordError.errorMessage === 'FLOOD_WAIT') {
                const waitTime = passwordError.seconds || 60;
                errorMessage = `Too many attempts. Please wait ${waitTime} seconds before trying again.`;
            } else if (passwordError.message && (passwordError.message.includes('SRP') || passwordError.message.includes('password'))) {
                errorMessage = 'Failed to process 2FA password. Please ensure your password is correct and try again.';
            }

            throw new Error(errorMessage);
        }

    } catch (error) {
        console.error('Verify password error:', error);
        
        res.status(400).json({ 
            error: error.message || 'Failed to verify password',
            code: 'VERIFY_PASSWORD_FAILED'
        });
    }
};

const getUserInfo = async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const db = database.getDb();
        const user = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM users WHERE telegram_id = ?',
                [userId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            user: {
                id: user.telegram_id,
                phoneNumber: user.phone_number,
                firstName: user.first_name,
                lastName: user.last_name,
                username: user.username
            }
        });
    } catch (error) {
        console.error('Get user info error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
};

const logout = async (req, res) => {
    try {
        const userId = req.user.userId;
        
        // Remove user session from database
        const db = database.getDb();
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET session_string = NULL WHERE telegram_id = ?',
                [userId],
                (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });

        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Failed to logout' });
    }
};

// Clean up expired sessions periodically
setInterval(() => {
    const now = Date.now();
    const EXPIRY_TIME = 15 * 60 * 1000; // 15 minutes

    for (const [phoneNumber, authData] of pendingAuth.entries()) {
        if (now - authData.timestamp > EXPIRY_TIME) {
            try {
                authData.client.disconnect();
            } catch (e) {
                console.log('Error disconnecting expired client:', e.message);
            }
            pendingAuth.delete(phoneNumber);
            console.log(`Cleaned up expired auth session for ${phoneNumber}`);
        }
    }
}, 5 * 60 * 1000); // Check every 5 minutes

module.exports = {
    sendCode,
    verifyCode,
    verifyPassword,
    getUserInfo,
    logout
};
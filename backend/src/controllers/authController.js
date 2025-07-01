const jwt = require('jsonwebtoken');
const database = require('../config/database');
const telegramService = require('../services/telegramService');

class AuthController {
    async sendCode(req, res) {
        try {
            const { phoneNumber } = req.body;

            if (!phoneNumber || !phoneNumber.startsWith('+')) {
                return res.status(400).json({ 
                    error: 'Please provide a valid phone number with country code' 
                });
            }

            console.log('Attempting to send code to:', phoneNumber);
            const result = await telegramService.sendCode(phoneNumber);
            
            // Store auth session with longer expiry
            const db = database.getDb();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes for 2FA support

            // Clean up any existing sessions for this phone number first
            await new Promise((resolve, reject) => {
                db.run(
                    'DELETE FROM auth_sessions WHERE phone_number = ?',
                    [phoneNumber],
                    (err) => {
                        if (err) {
                            console.error('Error cleaning up old sessions:', err);
                            reject(err);
                        } else {
                            resolve();
                        }
                    }
                );
            });

            // Insert new session
            await new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO auth_sessions (phone_number, phone_code_hash, expires_at) VALUES (?, ?, ?)',
                    [phoneNumber, result.phoneCodeHash, expiresAt.toISOString()],
                    function(err) {
                        if (err) {
                            console.error('Database error storing auth session:', err);
                            reject(err);
                        } else {
                            console.log('Auth session stored successfully with ID:', this.lastID);
                            console.log('Phone code hash:', result.phoneCodeHash);
                            console.log('Expires at:', expiresAt.toISOString());
                            resolve(this.lastID);
                        }
                    }
                );
            });

            res.json({
                success: true,
                type: result.type,
                timeout: result.timeout
            });

        } catch (error) {
            console.error('Send code error:', error);
            res.status(400).json({ error: error.message });
        }
    }

    async verifyCode(req, res) {
        try {
            const { phoneNumber, code } = req.body;

            if (!phoneNumber || !code) {
                return res.status(400).json({ 
                    error: 'Phone number and code are required' 
                });
            }

            console.log('Attempting to verify code for:', phoneNumber);
            console.log('Code provided:', code);

            // Get auth session with detailed logging
            const db = database.getDb();
            const authSession = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM auth_sessions WHERE phone_number = ?',
                    [phoneNumber],
                    (err, row) => {
                        if (err) {
                            console.error('Database error getting auth session:', err);
                            reject(err);
                        } else {
                            console.log('Auth session found:', row ? 'Yes' : 'No');
                            if (row) {
                                console.log('Session expires at:', row.expires_at);
                                console.log('Current time:', new Date().toISOString());
                                console.log('Phone code hash:', row.phone_code_hash);
                            }
                            resolve(row);
                        }
                    }
                );
            });

            if (!authSession) {
                console.log('No auth session found for phone:', phoneNumber);
                return res.status(400).json({ 
                    error: 'No verification session found. Please request a new code.' 
                });
            }

            // Check if session is expired
            const now = new Date();
            const expiresAt = new Date(authSession.expires_at);
            console.log('Session check - Now:', now.toISOString(), 'Expires:', expiresAt.toISOString());
            
            if (now > expiresAt) {
                console.log('Session expired');
                return res.status(400).json({ 
                    error: 'Verification session expired. Please request a new code.' 
                });
            }

            console.log('Found valid auth session, verifying code...');
            console.log('Using phone code hash:', authSession.phone_code_hash);
            
            const result = await telegramService.verifyCode(
                phoneNumber,
                authSession.phone_code_hash,
                code
            );

            if (result.requiresPassword) {
                console.log('2FA required for user');
                // Keep the session for 2FA verification
                return res.json({
                    success: false,
                    requiresPassword: true,
                    message: 'Two-factor authentication required'
                });
            }

            console.log('Code verified successfully, creating user...');
            return this.createUserAndToken(res, result, phoneNumber, db);

        } catch (error) {
            console.error('Verify code error:', error);
            
            // More specific error handling
            if (error.message.includes('PHONE_CODE_EXPIRED')) {
                res.status(400).json({ error: 'Verification code expired. Please request a new code.' });
            } else if (error.message.includes('PHONE_CODE_INVALID')) {
                res.status(400).json({ error: 'Invalid verification code. Please check the code and try again.' });
            } else {
                res.status(400).json({ error: error.message });
            }
        }
    }

    async verifyPassword(req, res) {
        try {
            const { phoneNumber, password } = req.body;

            if (!phoneNumber || !password) {
                return res.status(400).json({ 
                    error: 'Phone number and password are required' 
                });
            }

            console.log('Attempting to verify 2FA password for:', phoneNumber);

            // Get auth session
            const db = database.getDb();
            const authSession = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM auth_sessions WHERE phone_number = ? AND expires_at > datetime("now")',
                    [phoneNumber],
                    (err, row) => {
                        if (err) {
                            console.error('Database error getting auth session:', err);
                            reject(err);
                        } else {
                            console.log('Auth session for 2FA found:', row ? 'Yes' : 'No');
                            resolve(row);
                        }
                    }
                );
            });

            if (!authSession) {
                return res.status(400).json({ 
                    error: 'Invalid or expired session. Please request a new code.' 
                });
            }

            console.log('Verifying 2FA password with Telegram...');
            const result = await telegramService.verifyPassword(
                phoneNumber,
                authSession.phone_code_hash,
                password
            );

            console.log('2FA verification successful, creating user...');
            
            // Create the controller instance to call the method
            const controller = new AuthController();
            return controller.createUserAndToken(res, result, phoneNumber, db);

        } catch (error) {
            console.error('Verify password error:', error);
            
            // More specific error handling for 2FA
            if (error.message.includes('PASSWORD_HASH_INVALID')) {
                res.status(400).json({ error: 'Invalid 2FA password. Please check your password and try again.' });
            } else if (error.message.includes('SRP_PASSWORD_CHANGED')) {
                res.status(400).json({ error: 'Password was changed recently. Please try again in a few minutes.' });
            } else if (error.message.includes('SRP_ID_INVALID')) {
                res.status(400).json({ error: 'Invalid password session. Please restart the login process.' });
            } else if (error.message.includes('PHONE_CODE_EXPIRED')) {
                res.status(400).json({ error: 'Session expired. Please request a new verification code.' });
            } else {
                res.status(400).json({ error: error.message });
            }
        }
    }

    async createUserAndToken(res, result, phoneNumber, db) {
        try {
            console.log('Creating user and token...');
            console.log('User ID from result:', result.user.id);
            
            // Create or update user
            let user = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM users WHERE telegram_id = ? OR phone_number = ?',
                    [result.user.id, phoneNumber],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            if (!user) {
                // Create new user
                console.log('Creating new user...');
                const userId = await new Promise((resolve, reject) => {
                    db.run(
                        'INSERT INTO users (telegram_id, phone_number, first_name, last_name, username, session_string) VALUES (?, ?, ?, ?, ?, ?)',
                        [result.user.id, phoneNumber, result.user.firstName, result.user.lastName, result.user.username, result.sessionString],
                        function(err) {
                            if (err) {
                                console.error('Database error creating user:', err);
                                reject(err);
                            } else {
                                console.log('New user created with ID:', this.lastID);
                                resolve(this.lastID);
                            }
                        }
                    );
                });

                user = { 
                    id: userId, 
                    telegram_id: result.user.id,
                    phone_number: phoneNumber,
                    first_name: result.user.firstName,
                    last_name: result.user.lastName,
                    username: result.user.username,
                    session_string: result.sessionString 
                };
            } else {
                // Update existing user
                console.log('Updating existing user...');
                await new Promise((resolve, reject) => {
                    db.run(
                        'UPDATE users SET session_string = ?, first_name = ?, last_name = ?, username = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        [result.sessionString, result.user.firstName, result.user.lastName, result.user.username, user.id],
                        (err) => {
                            if (err) {
                                console.error('Database error updating user:', err);
                                reject(err);
                            } else {
                                console.log('User updated successfully');
                                resolve();
                            }
                        }
                    );
                });

                user.session_string = result.sessionString;
                user.first_name = result.user.firstName;
                user.last_name = result.user.lastName;
                user.username = result.user.username;
            }

            // Generate JWT token
            const token = jwt.sign(
                { userId: user.id, telegramId: result.user.id },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN }
            );

            // Clean up auth session
            console.log('Cleaning up auth session...');
            db.run('DELETE FROM auth_sessions WHERE phone_number = ?', [phoneNumber]);

            console.log('Login successful for user:', result.user.id);

            return res.json({
                success: true,
                token: token,
                user: {
                    id: user.id,
                    telegramId: result.user.id,
                    phone: phoneNumber,
                    firstName: result.user.firstName,
                    lastName: result.user.lastName,
                    username: result.user.username
                }
            });

        } catch (error) {
            console.error('Error in createUserAndToken:', error);
            return res.status(500).json({ error: 'Failed to create user session' });
        }
    }

    async getMe(req, res) {
        try {
            const user = req.user;
            
            res.json({
                success: true,
                user: {
                    id: user.id,
                    telegramId: user.telegram_id,
                    phone: user.phone_number,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    username: user.username
                }
            });

        } catch (error) {
            console.error('Get me error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async logout(req, res) {
        try {
            res.json({ success: true, message: 'Logged out successfully' });
        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = new AuthController();
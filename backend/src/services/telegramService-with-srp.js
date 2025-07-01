const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram/tl');
const crypto = require('crypto');

// If the above doesn't work, try this alternative approach
class TelegramService {
    // ... (keep all other methods the same)

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
                
                // Re-send the signin request first
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
            
            // Use the client's built-in checkPassword method if available
            console.log('Attempting to use client.checkPassword method...');
            
            let result;
            try {
                // Try using the client's built-in method
                result = await client.checkPassword(password);
                console.log('Built-in checkPassword method worked!');
            } catch (builtinError) {
                console.log('Built-in method failed, trying manual approach...');
                console.error('Built-in error:', builtinError);
                
                // Fallback to manual approach
                const passwordData = await client.invoke(new Api.account.GetPassword());
                console.log('Password data received for manual approach');
                
                // Try simple password hash first
                const passwordBytes = Buffer.from(password, 'utf8');
                const simpleHash = crypto.createHash('sha256').update(passwordBytes).digest();
                
                try {
                    result = await client.invoke(
                        new Api.auth.CheckPassword({
                            password: simpleHash
                        })
                    );
                    console.log('Simple hash approach worked!');
                } catch (simpleError) {
                    console.log('Simple hash failed, trying with InputCheckPasswordEmpty...');
                    
                    // Try with empty password input (for debugging)
                    result = await client.invoke(
                        new Api.auth.CheckPassword({
                            password: new Api.InputCheckPasswordEmpty()
                        })
                    );
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

    // ... (keep all other methods the same)
}

module.exports = new TelegramService();
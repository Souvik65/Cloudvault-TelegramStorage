// Create this file to debug the telegram package
console.log('🔍 Debugging Telegram package...');

try {
    const telegram = require('telegram');
    console.log('✅ Telegram package imported');
    console.log('Available exports:', Object.keys(telegram));
    
    // Check for different possible names
    console.log('TelegramApi:', typeof telegram.TelegramApi);
    console.log('TelegramClient:', typeof telegram.TelegramClient);
    console.log('Api:', typeof telegram.Api);
    console.log('Client:', typeof telegram.Client);
    
    // Check sessions
    try {
        const sessions = require('telegram/sessions');
        console.log('✅ Sessions imported');
        console.log('Available sessions:', Object.keys(sessions));
        console.log('StringSession:', typeof sessions.StringSession);
    } catch (sessionsError) {
        console.error('❌ Sessions import error:', sessionsError.message);
    }
    
} catch (error) {
    console.error('❌ Telegram package import error:', error.message);
}
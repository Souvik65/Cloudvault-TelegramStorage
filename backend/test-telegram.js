require('dotenv').config();

async function testTelegramImports() {
    try {
        console.log('Testing Telegram imports...');
        
        const { TelegramClient } = require('telegram');
        const { StringSession } = require('telegram/sessions');
        const { Api } = require('telegram/tl');
        
        console.log('✓ TelegramClient imported successfully');
        console.log('✓ StringSession imported successfully');
        console.log('✓ Api imported successfully');
        
        // Test creating a session
        const session = new StringSession('');
        console.log('✓ StringSession created successfully');
        
        // Test creating a client (don't connect yet)
        const apiId = parseInt(process.env.TELEGRAM_API_ID);
        const apiHash = process.env.TELEGRAM_API_HASH;
        
        console.log('API ID:', apiId);
        console.log('API Hash:', apiHash ? 'Present' : 'Missing');
        
        if (!apiId || !apiHash) {
            throw new Error('API credentials missing in .env file');
        }
        
        const client = new TelegramClient(session, apiId, apiHash, {
            deviceModel: 'Test',
            systemVersion: '1.0',
            appVersion: '1.0.0',
            langCode: 'en',
            systemLangCode: 'en',
        });
        
        console.log('✓ TelegramClient created successfully');
        console.log('All imports working correctly!');
        
    } catch (error) {
        console.error('❌ Error testing imports:', error.message);
        console.error('Full error:', error);
    }
}

testTelegramImports();
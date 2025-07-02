const crypto = require('crypto');

console.log('🔐 Generating JWT Secrets for CloudVault\n');

console.log('For Development (.env.local):');
console.log('JWT_SECRET=' + crypto.randomBytes(64).toString('hex'));

console.log('\nFor Production (Render):');
console.log('JWT_SECRET=' + crypto.randomBytes(64).toString('hex'));

console.log('\n📝 Copy one of these secrets to your environment file');
console.log('⚠️  Keep these secrets safe and never share them!');
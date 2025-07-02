const express = require('express');
const { body, validationResult } = require('express-validator');

// Debug imports
console.log('🔍 Debugging auth routes...');

try {
    const authController = require('../controllers/authController');
    console.log('✅ authController imported successfully');
    console.log('Available functions:', Object.keys(authController));
    console.log('sendCode:', typeof authController.sendCode);
    console.log('verifyCode:', typeof authController.verifyCode);
    console.log('getMe:', typeof authController.getMe);
    console.log('logout:', typeof authController.logout);
} catch (error) {
    console.error('❌ Error importing authController:', error);
}

try {
    const authMiddleware = require('../middleware/auth');
    console.log('✅ authMiddleware imported successfully');
    console.log('authMiddleware type:', typeof authMiddleware);
} catch (error) {
    console.error('❌ Error importing authMiddleware:', error);
}

// Continue with normal route setup...
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Simple routes to test
router.post('/send-code', (req, res) => {
    console.log('Send code route hit');
    if (typeof authController.sendCode === 'function') {
        return authController.sendCode(req, res);
    } else {
        return res.status(500).json({ error: 'sendCode function not available' });
    }
});

router.post('/verify-code', (req, res) => {
    console.log('Verify code route hit');
    if (typeof authController.verifyCode === 'function') {
        return authController.verifyCode(req, res);
    } else {
        return res.status(500).json({ error: 'verifyCode function not available' });
    }
});

router.get('/me', (req, res) => {
    console.log('Me route hit');
    if (typeof authMiddleware === 'function') {
        authMiddleware(req, res, () => {
            if (typeof authController.getMe === 'function') {
                return authController.getMe(req, res);
            } else {
                return res.status(500).json({ error: 'getMe function not available' });
            }
        });
    } else {
        return res.status(500).json({ error: 'authMiddleware not available' });
    }
});

router.post('/logout', (req, res) => {
    console.log('Logout route hit');
    if (typeof authMiddleware === 'function') {
        authMiddleware(req, res, () => {
            if (typeof authController.logout === 'function') {
                return authController.logout(req, res);
            } else {
                return res.status(500).json({ error: 'logout function not available' });
            }
        });
    } else {
        return res.status(500).json({ error: 'authMiddleware not available' });
    }
});

module.exports = router;
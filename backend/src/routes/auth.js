const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const database = require('../config/database');

const router = express.Router();

// Validation middleware
const validateSendCode = [
    body('phoneNumber')
        .matches(/^\+[1-9]\d{1,14}$/)
        .withMessage('Please provide a valid phone number with country code')
];

const validateVerifyCode = [
    body('phoneNumber')
        .matches(/^\+[1-9]\d{1,14}$/)
        .withMessage('Please provide a valid phone number with country code'),
    body('code')
        .isLength({ min: 4, max: 6 })
        .withMessage('Code must be 4-6 digits')
];

const validateVerifyPassword = [
    body('phoneNumber')
        .matches(/^\+[1-9]\d{1,14}$/)
        .withMessage('Please provide a valid phone number with country code'),
    body('password')
        .isLength({ min: 1 })
        .withMessage('Password is required')
];

// Debug endpoint to check session status
router.get('/debug-session/:phoneNumber', async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        const db = database.getDb();
        
        const sessions = await new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM auth_sessions WHERE phone_number = ?',
                [phoneNumber],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
        
        const now = new Date().toISOString();
        
        res.json({
            phoneNumber,
            currentTime: now,
            sessions: sessions.map(session => ({
                ...session,
                isExpired: new Date(session.expires_at) < new Date(now),
                timeUntilExpiry: new Date(session.expires_at).getTime() - new Date(now).getTime()
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Routes
router.post('/send-code', validateSendCode, authController.sendCode);
router.post('/verify-code', validateVerifyCode, authController.verifyCode);
router.post('/verify-password', validateVerifyPassword, authController.verifyPassword);
router.get('/me', authMiddleware, authController.getMe);
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;
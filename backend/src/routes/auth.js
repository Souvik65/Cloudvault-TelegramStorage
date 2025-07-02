const express = require('express');
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Validation error handler
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
        });
    }
    next();
};

// Validation middleware
const validateSendCode = [
    body('phoneNumber')
        .matches(/^\+[1-9]\d{1,14}$/)
        .withMessage('Please provide a valid phone number with country code'),
    handleValidationErrors
];

const validateVerifyCode = [
    body('phoneNumber')
        .matches(/^\+[1-9]\d{1,14}$/)
        .withMessage('Please provide a valid phone number with country code'),
    body('code')
        .isLength({ min: 4, max: 6 })
        .withMessage('Code must be 4-6 digits'),
    body('phoneCodeHash')
        .notEmpty()
        .withMessage('Phone code hash is required'),
    handleValidationErrors
];

// Routes
router.post('/send-code', validateSendCode, authController.sendCode);
router.post('/verify-code', validateVerifyCode, authController.verifyCode);
router.get('/me', authMiddleware, authController.getMe);
router.post('/logout', authMiddleware, authController.logout);

// Debug endpoint for development
if (process.env.NODE_ENV === 'development') {
    router.get('/debug-session/:phoneNumber', async (req, res) => {
        try {
            const { phoneNumber } = req.params;
            const database = require('../config/database');
            
            const sessions = await database.query(
                'SELECT * FROM auth_sessions WHERE phone_number = ?',
                [phoneNumber]
            );
            
            const now = new Date().toISOString();
            
            res.json({
                phoneNumber,
                currentTime: now,
                sessions: sessions.rows.map(session => ({
                    ...session,
                    isExpired: new Date(session.expires_at) < new Date(now),
                    timeUntilExpiry: new Date(session.expires_at).getTime() - new Date(now).getTime()
                }))
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}

module.exports = router;
const express = require('express');
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const validatePhoneNumber = [
    body('phoneNumber')
        .isMobilePhone()
        .withMessage('Please provide a valid phone number')
        .custom(value => {
            if (!value.startsWith('+')) {
                throw new Error('Phone number must include country code (e.g., +1234567890)');
            }
            return true;
        })
];

const validateVerificationCode = [
    body('phoneNumber')
        .isMobilePhone()
        .withMessage('Please provide a valid phone number'),
    body('code')
        .isLength({ min: 4, max: 6 })
        .isNumeric()
        .withMessage('Verification code must be 4-6 digits'),
    body('phoneCodeHash')
        .notEmpty()
        .withMessage('Phone code hash is required')
];

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array().map(err => ({
                field: err.path,
                message: err.msg,
                value: err.value
            }))
        });
    }
    next();
};

// Routes
router.post('/send-code', 
    validatePhoneNumber,
    handleValidationErrors,
    authController.sendCode
);

router.post('/verify-code',
    validateVerificationCode,
    handleValidationErrors,
    authController.verifyCode
);

router.get('/me',
    authMiddleware,
    authController.getMe
);

router.post('/logout',
    authMiddleware,
    authController.logout
);

module.exports = router;
const jwt = require('jsonwebtoken');
const database = require('../config/database');

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from database
        const user = await database.query(
            'SELECT * FROM users WHERE id = ?',
            [decoded.userId]
        );

        if (!user.rows || user.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid token.' });
        }

        req.user = user.rows[0];
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({ error: 'Invalid token.' });
    }
};

module.exports = authMiddleware;
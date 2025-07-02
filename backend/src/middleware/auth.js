const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({ 
                error: 'No authorization header provided',
                code: 'NO_AUTH_HEADER'
            });
        }

        const token = authHeader.split(' ')[1]; // Bearer TOKEN
        
        if (!token) {
            return res.status(401).json({ 
                error: 'No token provided',
                code: 'NO_TOKEN'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        let errorMessage = 'Invalid token';
        let errorCode = 'INVALID_TOKEN';
        
        if (error.name === 'JsonWebTokenError') {
            if (error.message === 'invalid signature') {
                errorMessage = 'Token signature invalid - please login again';
                errorCode = 'INVALID_SIGNATURE';
                console.log('Token signature mismatch - likely due to JWT_SECRET change');
            } else if (error.message === 'jwt malformed') {
                errorMessage = 'Malformed token - please login again';
                errorCode = 'MALFORMED_TOKEN';
            }
        } else if (error.name === 'TokenExpiredError') {
            errorMessage = 'Token expired - please login again';
            errorCode = 'TOKEN_EXPIRED';
        } else if (error.name === 'NotBeforeError') {
            errorMessage = 'Token not active yet';
            errorCode = 'TOKEN_NOT_ACTIVE';
        }
        
        if (!['INVALID_SIGNATURE', 'TOKEN_EXPIRED', 'MALFORMED_TOKEN'].includes(errorCode)) {
            console.error('Auth middleware error:', error.name + ':', error.message);
        }
        
        res.status(401).json({ 
            error: errorMessage,
            code: errorCode
        });
    }
};

module.exports = authMiddleware;
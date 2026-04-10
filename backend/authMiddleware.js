const jwt = require('jsonwebtoken');
require('dotenv').config();

function authenticateToken(req, res, next) {
    // 1. Get the authorization header
    const authHeader = req.headers['authorization'];

    // 2. The header usually looks like "Bearer [TOKEN_STRING]". We just want the token.
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    // 3. Verify the token using your secret key
    jwt.verify(token, process.env.JWT_SECRET, (err, decodedPayload) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token.' });
        }

        // 4. Attach the admin's payload data to the request so the next function can use it
        req.admin = decodedPayload;

        // 5. Let the user pass through to the route!
        next();
    });
}

module.exports = authenticateToken;
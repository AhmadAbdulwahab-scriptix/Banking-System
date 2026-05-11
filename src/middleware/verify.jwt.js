const jwt = require('jsonwebtoken');
// const AppError = require('../utils/AppError');

const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        throw new AppError('Auth does not exist or does not start with Bearer')
    };
    const token = authHeader.split(' ')[1];
    jwt.verify(
        token,
        process.env.ACCESS_TOKEN,
        (err, decoded) => {
            if (err) {
                throw new AppError('invalid token', 403)
            }
            req.name = decoded.userInfo.name
            req.userId = decoded.userInfo.userId;
            req.email = decoded.userInfo.email;
            req.isVerified = decoded.userInfo.isVerified;
            // req.accountId = decoded.userInfo.accountId
            // req.bankCode = decoded.userInfo.bankCode
            req.role = decoded.userInfo.role
            next();
        }
    );
}

module.exports = { verifyJWT }
const jwt = require('jsonwebtoken');
const {AppError} = require('./errorHandler.middleware');
const dotenv = require('dotenv').config();


const verifyJWT = (req, res, next) => {
    
    const authHeader = req.headers.authorization || req.headers.Authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
        throw new AppError("Authorization token missing", 401);
    };
    const token = authHeader?.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET) 
            req.name = decoded.userInfo.name
            req.userId = decoded.userInfo.userId;
            req.email = decoded.userInfo.email;
            req.isVerified = decoded.userInfo.isVerified;
            req.role = decoded.userInfo.role
            next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Unauthorized action initiated' })
  };
}

module.exports = { verifyJWT }
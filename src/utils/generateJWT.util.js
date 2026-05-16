const jwt = require("jsonwebtoken");

const genAccessToken = (user) => {
  return jwt.sign({userInfo: {
        userId: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        accountId: user.accountId,
        role: user.role,
        isVerified: user.isVerified || false
      } 
    }, 
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * Generates a unique transaction reference.
 * Format: TXN-<timestamp>-<4 random hex chars>
 */
const generateReference = () =>
  `TXN-${Date.now()}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;

module.exports = { genAccessToken, generateReference }
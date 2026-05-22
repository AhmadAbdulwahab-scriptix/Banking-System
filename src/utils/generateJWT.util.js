const jwt = require("jsonwebtoken");
const { COOKIE_OPTIONS } = require('../utils/helper.utils')

const genAccessToken = (user) => {
  return jwt.sign(
    {
      userInfo: {
        userId: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified || false,
      },
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m" }
  );
};

const genRefreshToken = (user) => {
  return jwt.sign(
    { userId: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d" }
  );
};

const issueTokens = (res, user) => {
    const accessToken  = genAccessToken(user);
    const refreshToken = genRefreshToken(user);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    return { accessToken, refreshToken };
};


module.exports = { genAccessToken, genRefreshToken, issueTokens };


// /**
//  * Generates a unique transaction reference.
//  * Format: TXN-<timestamp>-<4 random hex chars>
//  */
// const generateReference = () =>
//   `TXN-${Date.now()}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
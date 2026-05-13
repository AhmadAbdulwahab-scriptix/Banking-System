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

module.exports = { genAccessToken }
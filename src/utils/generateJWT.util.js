const jwt = require("jsonwebtoken");

const genAccessToken = (user) => {
  return jwt.sign(
    { 
      userInfo: {
        userId: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        accountId: user.accountId,
        role: user.role
      } 
    }, 
    process.env.ACCESS_TOKEN,
    { expiresIn: '7d' }
  );
};

module.exports = { genAccessToken }
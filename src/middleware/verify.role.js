const {AppError} = require('./errorHandler.middleware');

const verifyRoles = (...roles) => {
    return (req, res, next) => {
        if (!req?.role) {
            throw new AppError('User is not authorized', 409)
        };

        //selected role from the token
        const role = req.role
        if (!roles.includes(role)) {
            throw new AppError('User is not authorized', 409)
        }
        next()
    }
}

module.exports = { verifyRoles }
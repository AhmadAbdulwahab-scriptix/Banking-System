const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const hashPassword = async (password) => {
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        return hashedPassword;
    } catch (error) {
        console.error("Error hashing password:", error);
        throw new Error("Hashing failed");
    }
};

// Function to compare a password with a hashed password
// Function to compare a password with a hashed password
const comparePassword = async (password, userPassword) => {
    try {
         if (!password || !userPassword) {
            throw new Error("Missing password or hash for comparison");
        }
        // Compare the plain password with the hashed password
        // bcrypt.compare returns a promise that resolves to true or false
        const isMatch = await bcrypt.compare(password, userPassword);
        return isMatch;
    } catch (error) {
        console.error("Error comparing password:", error);
        throw new Error("Comparison failed");
    }
}

// Function to generate JWT token
const generateToken = (userId) => {   
    try {
         if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not defined");
    }
        const token = jwt.sign(          
            { userId: userId }, // Payload containing user information
            
            process.env.JWT_SECRET, // Secret key for signing the token
            
            { expiresIn: '7d' } // Token expiration time
        );
        return token;
    } catch (error) {
        console.error("Error generating token:", error);
        throw new Error("Token generation failed");
    }
};


const SALT_ROUNDS = 12;

 // Helpers 

/**
 * Signs a JWT for the given user document.
 */
const  signToken = (user) => {
    return jwt.sign(
        {
            sub: user._id,
            role: user.role,
            isVerified: user.isVerified
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
}

/**
 * Strips sensitive fields before sending the user object in a response.
 */
const sanitizeUser = (user) => {
    const obj = user.toObject();
    delete obj.passwordHash;
    delete obj.__v;
    return obj;
}

module.exports = {
    hashPassword,
    comparePassword,
    generateToken,
    signToken,
    sanitizeUser
};

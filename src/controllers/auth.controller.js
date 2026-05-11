const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const { hashPassword, sanitizeUser, comparePassword } = require('../utils/password.encrypt');
const { genAccessToken } = require('../utils/generateJWT.util');


/**
 * POST /api/auth/register
 */
const register = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            dob,
            email,
            phone,
            password,
            kycType,
            nin,
            bvn,
            role
        } = req.body;

        // ── Basic field validation 
        const missing = [];
        if (!firstName) missing.push('firstName');
        if (!lastName)  missing.push('lastName');
        if (!dob)       missing.push('dob');
        if (!phone)     missing.push('phone');
        if (!password)  missing.push('password');
        if (!kycType)   missing.push('kycType');

        if (missing.length) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missing.join(', ')}`
            });
        }

        // ── KYC consistency check 
        if (kycType === 'NIN' && !nin) {
            return res.status(400).json({
                success: false,
                message: 'NIN is required when kycType is "NIN"'
            });
        }
        // Note: BVN is not strictly required since some users may not have it at 
        // registration, but if kycType is BVN then bvn must be provided
        if (kycType === 'BVN' && !bvn) {
            return res.status(400).json({
                success: false,
                message: 'BVN is required when kycType is "BVN"'
            });
        }

        // ── Duplicate checks
        const orConditions = [{ phone }];
        if (email) orConditions.push({ email });
        if (nin)   orConditions.push({ nin });
        if (bvn)   orConditions.push({ bvn });

        const existing = await User.findOne({ $or: orConditions });
        if (existing) {
            // Pinpoint which field clashes
            let field = 'phone';
            if (email && existing.email === email.toLowerCase()) field = 'email';

            else if (nin && existing.nin === nin) field = 'nin';

            else if (bvn && existing.bvn === bvn) field = 'bvn';

            return res.status(409).json({
                success: false,
                message: `An account with this ${field} already exists`
            });
        }

        // ── Hash password
        // const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
         const securedPassword = await hashPassword(password);
        if (!securedPassword) {
            return res.status(500).json({
                success: false,
                message: "Error hashing password"
            });
        };

        // Create user 
        const user = new User({
            firstName,
            lastName,
            dob,
            email:    email || undefined,
            phone,
            // password: securedPassword,
            kycType,
            nin:      nin || undefined,
            bvn:      bvn || undefined,
            role:     role || 'customer',
            isVerified: false
        });

        await user.save();
        const token = genAccessToken(user);

        return res.status(201).json({
            success: true,
            message: 'Account created successfully',
            token,
            user: sanitizeUser(user)
        });

    } catch (err) {
        // Mongoose duplicate-key error (race condition edge case)
        if (err.code === 11000) {
            const field = Object.keys(err.keyPattern || {})[0] || 'field';
            return res.status(409).json({
                success: false,
                message: `An account with this ${field} already exists`
            });
        }
        console.error('[register]', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

/**
 * POST /api/auth/login
 *
 * Accepts any one of: email, phone, nin, bvn  +  password
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Password is required' 
            });
        }

    
        // const user = await User.findOne({ email })
        const user = await User.findOne({ email }).select("+password");

        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Email and Password do not match' });
        }
        
        // Compare the provided password with the stored hashed password
        // Using the comparePassword function to check if the password matches
        const isPasswordMatch = await comparePassword(password, user.password); // Compare the password with the hashed password
        if (!isPasswordMatch) {
            return res.status(401).json({ 
                success: false, 
                message: 'Email and Password do not match' });
        }

       

        const token = genAccessToken(user);

        // Remove password from response
        user.password = undefined;

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: user,
                token: token
            }
            // user: sanitizeUser(user)
        });

    } catch (err) {
        console.error('[login]', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

module.exports = { register, login };
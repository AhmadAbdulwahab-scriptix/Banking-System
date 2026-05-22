const User = require('../models/User.model');
const { hashPassword, sanitizeUser, comparePassword } = require('../utils/password.encrypt');
const { issueTokens } = require('../utils/generateJWT.util');
// const { COOKIE_OPTIONS } = require('../utils/helper.utils')
const jwt = require('jsonwebtoken');

// ─── POST /api/auth/register-customer ────────────────────────────────────────────────
const registerCustomer = async (req, res) => {
    try {
        const { firstName, lastName, dob, email, phone, password, kycType, nin, bvn } = req.body;

        // Basic field validation — unchanged from original
        const missing = [];
        if (!firstName) missing.push('firstName');
        if (!lastName)  missing.push('lastName');
        if (!dob)       missing.push('dob');
        if (!email)     missing.push('email');
        if (!phone)     missing.push('phone');
        if (!password)  missing.push('password');
        if (!kycType)   missing.push('kycType');
        if (!bvn && !nin) missing.push('bvn or nin');

        if (missing.length) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missing.join(', ')}`
            });
        }

        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
        }

        if (kycType === 'NIN' && !nin) {
            return res.status(400).json({ success: false, message: 'NIN is required when kycType is "NIN"' });
        }
        if (kycType === 'BVN' && !bvn) {
            return res.status(400).json({ success: false, message: 'BVN is required when kycType is "BVN"' });
        }

        // Duplicate check
        const orConditions = [{ phone }];
        if (email) orConditions.push({ email });
        if (nin)   orConditions.push({ nin });
        if (bvn)   orConditions.push({ bvn });

        const existing = await User.findOne({ $or: orConditions });
        if (existing) {
            let field = 'phone';
            if (email && existing.email === email.toLowerCase()) field = 'email';
            else if (nin && existing.nin === nin)                 field = 'nin';
            else if (bvn && existing.bvn === bvn)                field = 'bvn';
            return res.status(409).json({ success: false, message: `An account with this ${field} already exists` });
        }

        const securedPassword = await hashPassword(password);
        if (!securedPassword) {
            return res.status(500).json({ success: false, message: 'Error hashing password' });
        }

        const user = new User({
            firstName, lastName, dob,
            email:    email    || undefined,
            phone,
            password: securedPassword,
            kycType,
            nin:  nin  || undefined,
            bvn:  bvn  || undefined,
            role: 'customer',
            isVerified: false
        });

        const { accessToken, refreshToken } = issueTokens(res, user);
        user.refreshToken = refreshToken;
        await user.save();

        return res.status(201).json({
            success: true,
            message: 'Account created successfully',
            accessToken,
            user: sanitizeUser(user)
        });

    } catch (err) {
        if (err.code === 11000) {
            const field = Object.keys(err.keyPattern || {})[0] || 'field';
            return res.status(409).json({ success: false, message: `An account with this ${field} already exists` });
        }
        console.error('[register]', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── POST /api/auth/register-staff ──────────────────────────────────────────
// Admin only: creates a staff account.
// No KYC fields — staff identity is verified internally by the firm.
// isVerified is set to true by default — no NIBSS flow needed.
// role is hardcoded to 'staff' — cannot be overridden from the request body.
const registerStaff = async (req, res) => {
    try {
        // Only admin can create staff accounts
        if (!['admin', 'super-admin'].includes(req.role)) {
            return res.status(403).json({
                success: false,
                message: 'Only admin can register staff accounts'
            });
        }
        const { firstName, lastName, email, phone, password } = req.body;
        
        const missing = [];
        if (!firstName) missing.push('firstName');
        if (!lastName)  missing.push('lastName');
        if (!email)     missing.push('email');
        if (!phone)     missing.push('phone');
        if (!password)  missing.push('password');

        if (missing.length) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missing.join(', ')}`
            });
        }
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters'
            });
        }

        // Check for duplicate email or phone
        const existing = await User.findOne({ $or: [{ email }, { phone }] });
        if (existing) {
            const field = existing.email === email.toLowerCase() ? 'email' : 'phone';
            return res.status(409).json({
                success: false,
                message: `An account with this ${field} already exists`
            });
        }

        const securedPassword = await hashPassword(password);
        if (!securedPassword) {
            return res.status(500).json({ success: false, message: 'Error hashing password' });
        }

        const staff = new User({
            firstName,
            lastName,
            email,
            phone,
            password: securedPassword,
            role: 'staff',
            isVerified: true, // firm vouches for staff identity internally
        });

        const { accessToken, refreshToken } = issueTokens(res, staff);
        staff.refreshToken = refreshToken;
        await staff.save();

        return res.status(201).json({
            success: true,
            message: 'Staff account created successfully',
            accessToken,
            user: sanitizeUser(staff)
        });

    } catch (err) {
        if (err.code === 11000) {
            const field = Object.keys(err.keyPattern || {})[0] || 'field';
            return res.status(409).json({
                success: false,
                message: `An account with this ${field} already exists`
            });
        }
        console.error('[registerStaff]', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── POST /api/auth/register-admin ──────────────────────────────────────────
// Super-admin only (seeder/script in production).
// In development this endpoint is available but protected by a SUPER_ADMIN_KEY
// environment variable — without it the request is rejected.
// In production this endpoint should be disabled entirely or removed.
// role is hardcoded to 'admin' — cannot be overridden from the request body.
// No KYC fields — admin identity is verified by the firm before account creation.
const registerAdmin = async (req, res) => {
    try {
        if (req.role !== "super-admin") {
            return res.status(403).json({
                success: false,
                message: 'Admin registration is not available in this environment'
            });
        }
        const { firstName, lastName, email, phone, password } = req.body;

        const missing = [];
        if (!firstName) missing.push('firstName');
        if (!lastName)  missing.push('lastName');
        if (!email)     missing.push('email');
        if (!phone)     missing.push('phone');
        if (!password)  missing.push('password');

        if (missing.length) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missing.join(', ')}`
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters'
            });
        }

        // Check for duplicate email or phone
        const existing = await User.findOne({ $or: [{ email }, { phone }] });
        if (existing) {
            const field = existing.email === email.toLowerCase() ? 'email' : 'phone';
            return res.status(409).json({
                success: false,
                message: `An account with this ${field} already exists`
            });
        }

        const securedPassword = await hashPassword(password);
        if (!securedPassword) {
            return res.status(500).json({ success: false, message: 'Error hashing password' });
        }

        const admin = new User({
            firstName,
            lastName,
            email,
            phone,
            password: securedPassword,
            role: 'admin',        // hardcoded — cannot come from req.body
            isVerified: true,     // firm vouches for admin identity internally
        });

        const { accessToken, refreshToken } = issueTokens(res, admin);
        admin.refreshToken = refreshToken;
        await admin.save();

        return res.status(201).json({
            success: true,
            message: 'Admin account created successfully',
            accessToken,
            user: sanitizeUser(admin)
        });
    } catch (err) {
        if (err.code === 11000) {
            const field = Object.keys(err.keyPattern || {})[0] || 'field';
            return res.status(409).json({
                success: false,
                message: `An account with this ${field} already exists`
            });
        }
        console.error('[registerAdmin]', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── POST /api/auth/login ───────────────────────────────────────────────────
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ success: false, message: 'Email and password do not match' });
        }

        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Email and password do not match' });
        }

        const { accessToken, refreshToken } = issueTokens(res, user);

        user.refreshToken = refreshToken;
        await user.save();

        user.password = undefined;

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            accessToken,
            user: sanitizeUser(user)
        });

    } catch (err) {
        console.error('[login]', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── POST /api/auth/refresh ─────────────────────────────────────────────────
const refreshToken = async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        if (!token) {
            return res.status(401).json({ success: false, message: 'Refresh token missing' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
        } catch {
            return res.status(403).json({ success: false, message: 'Invalid or expired refresh token' });
        }

        const user = await User.findById(decoded.userId);
        if (!user || user.refreshToken !== token) {
            return res.status(403).json({ success: false, message: 'Refresh token reuse detected or user not found' });
        }

        // Rotate: issue brand new tokens and persist the new refresh token
        const { accessToken, refreshToken: newRefreshToken } = issueTokens(res, user);
        user.refreshToken = newRefreshToken;
        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Token refreshed successfully',
            accessToken
        });

    } catch (err) {
        console.error('[refreshToken]', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── POST /api/auth/logout ─────────────────────────────────────────────────
const logout = async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        if (token) {
            await User.findOneAndUpdate(
                { refreshToken: token },
                { refreshToken: null }
            );
        }

        res.clearCookie('refreshToken', {
            httpOnly: true,
            // secure: process.env.NODE_ENV === 'production',
            // sameSite: 'strict'
        });

        return res.status(200).json({ success: true, message: 'Logged out successfully' });

    } catch (err) {
        console.error('[logout]', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── POST /api/auth/reset-password ─────────────────────────────────────────
const resetPassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const { userId } = req;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'currentPassword and newPassword are required' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
        }

        const user = await User.findById(userId).select('+password');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const isMatch = await comparePassword(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }

        user.password = await hashPassword(newPassword);
        // Invalidate all sessions by clearing the persisted refresh token
        user.refreshToken = null;
        await user.save();

        res.clearCookie('refreshToken', {
            httpOnly: true,
            // secure: process.env.NODE_ENV === 'production',
            // sameSite: 'strict'
        });

        return res.status(200).json({ success: true, message: 'Password reset successfully. Please log in again.' });

    } catch (err) {
        console.error('[resetPassword]', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── PATCH /api/auth/update-info ────────────────────────────────────────────
const updateUserInfo = async (req, res) => {
    try {
        const { userId } = req;
        console.log(req.body);
        const { firstName, lastName, email, phone } = req.body;

        if (!firstName && !lastName && !email && !phone) {
            return res.status(400).json({ success: false, message: 'Provide at least one field to update' });
        }
        if (email || phone) {
            const orConditions = [];
            if (email) orConditions.push({ email });
            if (phone) orConditions.push({ phone });
            const conflict = await User.findOne({ $or: orConditions, _id: { $ne: userId } });
            if (conflict) {
                const field = email && conflict.email === email.toLowerCase() ? 'email' : 'phone';
                return res.status(409).json({ success: false, message: `This ${field} is already in use` });
            }
        }

        const updates = {};
        if (firstName) updates.firstName = firstName;
        if (lastName)  updates.lastName  = lastName;
        if (email)     updates.email     = email;
        if (phone)     updates.phone     = phone;

        const user = await User.findByIdAndUpdate(userId, updates, { new: true });
        console.log(user);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            user: sanitizeUser(user)
        });

    } catch (err) {
        if (err.code === 11000) {
            const field = Object.keys(err.keyPattern || {})[0] || 'field';
            return res.status(409).json({ success: false, message: `This ${field} is already in use` });
        }
        console.error('[updateUserInfo]', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = { registerCustomer, login, refreshToken, logout, resetPassword, updateUserInfo };

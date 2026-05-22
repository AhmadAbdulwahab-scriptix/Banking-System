const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.route');
const walletRoutes = require('./wallet.route')
const transactionRoutes = require('./transaction.route')
const loanRoutes = require('./loan.route')

const { verifyRoles } = require('../middleware/verify.role');
const { verifyJWT } = require('../middleware/verify.jwt');

// Public — no JWT required
router.use('/auth', authRoutes);

// wallet || Protected routes — JWT required, role-based access control
router.use('/wallet', verifyJWT, verifyRoles('customer', "staff", 'admin'), walletRoutes);

// Transaction routes || Protected routes — JWT required, role-based access control
router.use('/transaction', verifyJWT, verifyRoles('customer', 'staff', 'admin'), transactionRoutes);

// Loan routes || Protected routes — JWT required, role-based access control
router.use('/loan',  verifyJWT, verifyRoles('customer', 'staff', 'admin'), loanRoutes);

module.exports = router;

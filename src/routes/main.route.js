const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.route');
const walletRoutes = require('./wallet.route')
const transactionRoutes = require('./transaction.route')
const { verifyRoles } = require('../middleware/verify.role');
const { verifyJWT } = require('../middleware/verify.jwt');

router.use('/auth', authRoutes);
router.use('/wallet', verifyJWT, verifyRoles('customer', 'admin'), walletRoutes);
router.use('/transaction', verifyJWT, verifyRoles('customer', 'staff', 'admin'), transactionRoutes)

module.exports = router;
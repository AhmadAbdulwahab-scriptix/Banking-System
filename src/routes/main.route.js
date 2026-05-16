const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.route');
const { verifyRoles } = require('../middleware/verify.role');
const { verifyJWT } = require('../middleware/verify.jwt');
// const walletRoutes = require("./wallet.route");

router.use('/auth', authRoutes);
router.use('/wallet', verifyJWT, verifyRoles('user', 'admin'), require('./wallet.route'));
// router.use('/transactions', verifyJWT, verifyRoles('user', 'admin'), require('./transaction.routes'));

module.exports = router;
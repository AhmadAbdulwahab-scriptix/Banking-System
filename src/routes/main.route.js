const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.route');
const { verifyRoles } = require('../middleware/verify.role');
const { verifyJWT } = require('../middleware/verify.jwt');

router.use('/auth', authRoutes);
router.use('/wallet', verifyJWT, verifyRoles('user', 'admin'), require('./wallet.route'));

module.exports = router;
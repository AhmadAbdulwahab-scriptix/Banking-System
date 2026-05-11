const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.route');
const { verifyRoles } = require('../middleware/verify.role');

router.use('/auth', authRoutes);

module.exports = router;
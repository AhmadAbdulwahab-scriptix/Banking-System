const express = require('express');
const router = express.Router();
const { verifyRoles } = require('../middleware/verify.role');
const { verifyJWT } = require('../middleware/verify.jwt');

// Public — no JWT required
router.use('/auth', require('./auth.route'));

router.use('/wallet',
    verifyJWT,
    verifyRoles('customer', 'staff', 'admin'),
    require('./wallet.route')
);

router.use('/transaction',
    verifyJWT,
    verifyRoles('customer', 'staff', 'admin'),
    require('./transaction.route')
);

// Loan routes
router.use('/loan',
    verifyJWT,
    verifyRoles('customer', 'staff', 'admin'),
    require('./loan.route')
);

module.exports = router;

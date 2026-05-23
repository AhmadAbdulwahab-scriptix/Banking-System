const express = require('express');
const router = express.Router();
const {
    applyLoan,
    approveLoan,
    rejectLoan,
    repayLoan,
    getMyLoans,
    getAllLoans
} = require('../controllers/loan.controller');

// Customer routes
router.post("/apply", applyLoan);
router.post("/repay/:loanId", repayLoan);
router.get("/my-loans", getMyLoans);

// Staff/Admin routes (role check is inside the controller)
router.get("/admin/all", getAllLoans);
router.post("/admin/approve/:loanId", approveLoan);
router.post("/admin/reject/:loanId", rejectLoan);

module.exports = router;

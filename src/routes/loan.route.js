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
router.post("/:loanId/repay", repayLoan);
router.get("/my-loans", getMyLoans);

// Staff/Admin routes (role check is inside the controller)
router.get("/all", getAllLoans);
router.post("/:loanId/approve", approveLoan);
router.post("/:loanId/reject", rejectLoan);

module.exports = router;

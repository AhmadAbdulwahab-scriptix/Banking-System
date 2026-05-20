const express = require('express');
const router = express.Router();
const { 
    intraBankTransferFunds,
    interBankTransferFunds,
    transactionHistory,
    depositFunds,
    withdrawFunds,
    getAllTransactions
} = require('../controllers/transactions.controller');

router.post("/interbank-transfer", interBankTransferFunds);
router.post("/intrabank-transfer", intraBankTransferFunds);

router.get("/all", getAllTransactions);

router.get("/history/:reference", transactionHistory);

router.post("/deposit", depositFunds);
router.post("/withdraw", withdrawFunds);

module.exports = router;

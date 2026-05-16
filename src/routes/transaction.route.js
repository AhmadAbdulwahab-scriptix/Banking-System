const express = require('express');
const router = express.Router();
const { intraBankTransferFunds, interBankTransferFunds, transactionHistory } = require('../controllers/transactions.controller');

router.post("/interbank-transfer", interBankTransferFunds)

router.post("/intrabank-transfer", intraBankTransferFunds)

router.get("/history/:reference", transactionHistory)

module.exports = router
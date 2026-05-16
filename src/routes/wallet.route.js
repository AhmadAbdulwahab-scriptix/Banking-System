const express = require("express");
const router = express.Router();
const Wallet = require("../controllers/wallet.controller");

router.post("/create", Wallet.createWallet);

router.post("/verify-bvn", Wallet.verifyBVN);

router.post("/verify-nin", Wallet.verifyNIN);

router.get("/name-enquiry/:accountNumber", Wallet.nameEnquiry);

router.get("/", Wallet.getWallet)

router.get("/:walletId", Wallet.getWalletById)

//router.post("/transfer", Wallet.interbankTransfer);

// router.get("/:walletId", Wallet.getWalletById);

// router.get("/user/:userId", Wallet.getWalletsByUser);

// router.patch("/:walletId/status", Wallet.updateWalletStatus);

// router.patch("/:walletId/credit", Wallet.creditWallet);

// router.patch("/:walletId/debit", Wallet.debitWallet);

// router.post("/transfer", Wallet.transferFunds);

// router.delete("/:walletId", Wallet.closeWallet);

module.exports = router;
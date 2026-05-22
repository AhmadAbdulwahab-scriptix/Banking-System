const express = require("express");
const router = express.Router();
const Wallet = require("../controllers/wallet.controller");

router.post("/create", Wallet.createWallet);

router.post("/verify-bvn", Wallet.verifyBVN);

router.post("/verify-nin", Wallet.verifyNIN);

router.get("/name-enquiry/:accountNumber", Wallet.enquireName);

router.get("/", Wallet.getWallet)

router.get("/all", Wallet.getAllWallets);

router.get("/:walletId", Wallet.getWalletById)

router.patch("/status/:walletId", Wallet.updateWalletStatus);

router.post("/:walletId/approve-bvn", Wallet.approveBVN);

router.post("/:walletId/approve-nin", Wallet.approveNIN);

// router.get("/user/:userId", Wallet.getWalletsByUser);

module.exports = router;
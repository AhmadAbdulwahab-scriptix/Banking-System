const express = require("express");
const router = express.Router();
const { registerCustomer, login, refreshToken, logout, resetPassword, updateUserInfo } = require("../controllers/auth.controller");
const { setTxPin, changeTxPin } = require("../controllers/txPin.controller");
const { verifyJWT } = require("../middleware/verify.jwt");

// ── Public routes (no token required) ──────────────────────────────────────
router.post("/register", registerCustomer);
router.post("/login", login);

// /refresh
router.post("/refresh", refreshToken);

// ── Protected routes ────────────────────────
// /logout
router.post("/logout", verifyJWT, logout);

// reset-password
router.post("/reset-password", verifyJWT, resetPassword);

// /update-info
router.patch("/update-info", verifyJWT, updateUserInfo);

// /set-tx-pin
router.post("/set-tx-pin", verifyJWT, setTxPin);

// /change-tx-pin
router.patch("/change-tx-pin", verifyJWT, changeTxPin);

module.exports = router;
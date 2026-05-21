const {
    validateBVN, 
    validateNIN, 
    nameEnquiry, 
    interbankTransfer,
    createAccount } = require("../services/nibbs.services");

const Wallet  = require("../models/Wallet.model"); 
const User = require('../models/User.model')

/**
 * POST /wallets
 * Create a new wallet for a user.
 * One wallet per user (per currency) is enforced.
 */
const createWallet = async (req, res) => {
  try {
    const { userId, currency } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: "userId is required." 
      });
    }

    // 1️⃣ Check for existing wallet
    let existingWallet;
    try {
      existingWallet = await Wallet.findOne({ 
        user: userId, 
        currency: currency || "NGN" 
      });
    } catch (walletCheckErr) {
      console.error('[Wallet.findOne] Wallet check failed:', walletCheckErr.message);
      throw walletCheckErr;
    }

    if (existingWallet) {
      return res.status(409).json({
        success: false,
        message: `A ${currency || "NGN"} wallet already exists for this user.`,
      });
    }
    
    // 2️⃣ Fetch user details
    let user;
    try {
      user = await User.findById(userId);
    } catch (userErr) {
      console.error('[User.findById] User fetch failed:', userErr.message);
      throw userErr;
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // 3️⃣ EXTERNAL API - Create Account
    const payload = {
      kycType: user?.kycType?.toLowerCase(),
      kycID: user?.bvn || user?.nin,
      dob: user?.dob
    };
    
    let accountNumber;
    try {
      accountNumber = await createAccount(payload);
    } catch (createAccountErr) {
      console.error('[createAccount] NIBSS API failed:', createAccountErr.message);
      if (createAccountErr.response?.status === 404) {
        return res.status(404).json({ 
          success: false, 
          message: "Account creation failed - KYC data not found" 
        });
      }
      if (createAccountErr.response?.status === 400) {
        return res.status(400).json({ 
          success: false, 
          message: createAccountErr.response?.data || "Invalid KYC data"
        });
      }
      throw createAccountErr;
    }

    // 4️⃣ DATABASE - Create Wallet Record
    const wallet = new Wallet({
      user: userId,
      accountNumber,
      currency: currency || "NGN",
      balance: 0,
      status: "Pending",
    });

    try {
      await wallet.save();
    } catch (walletSaveErr) {
      console.error('[wallet.save] Wallet creation failed:', walletSaveErr.message);
      throw walletSaveErr;
    }

    return res.status(201).json({ 
        success: true, 
        message: "Wallet created successfully. Please verify your BVN/NIN to activate.",
        data: wallet
    });

  } catch (error) {
    console.error("[createWallet] Unexpected error:", error.message || error);
    return res.status(500).json({ 
        success: false, 
        message: "Unable to create wallet"
    });
  }
};

/**
 * POST /wallet/verify-bvn
 * Verify a BVN via NIBSS and activate the wallet on success.
 */
const verifyBVN = async (req, res) => {
  try {
    const { bvn } = req.body;
    const userId = req.userId;

    if (!bvn) {
      return res.status(400).json({ 
        success: false, 
        message: "BVN is required" 
    });
    }

    // 1️⃣ Fetch wallet
    let wallet;
    try {
      wallet = await Wallet.findOne({ user: userId });
    } catch (walletErr) {
      console.error('[Wallet.findOne] Wallet fetch failed:', walletErr.message);
      throw walletErr;
    }

    if (!wallet) {
      return res.status(404).json({ 
        success: false, 
        message: "Wallet not found" 
      });
    }

    if (["Suspended", "Frozen", "Closed"].includes(wallet.status)) {
      return res.status(403).json({
        success: false,
        message: `Cannot verify BVN for a ${wallet.status.toLowerCase()} wallet`,
      });
    }

    // 2️⃣ EXTERNAL API - Verify BVN
    let nibssResponse;
    try {
      nibssResponse = await validateBVN(bvn);
    } catch (validateErr) {
      console.error('[validateBVN] NIBSS API failed:', validateErr.message);
      if (validateErr.response?.status === 400) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid BVN provided"
        });
      }
      if (validateErr.response?.status === 404) {
        return res.status(404).json({ 
          success: false, 
          message: "BVN not found on NIBSS"
        });
      }
      throw validateErr;
    }

    // 3️⃣ DATABASE - Update Wallet Status
    wallet.status = "Active";
    try {
      await wallet.save();
    } catch (updateErr) {
      console.error('[wallet.save] Wallet status update failed:', updateErr.message);
      throw updateErr;
    }

    return res.status(200).json({
      success: true,
      message: "BVN verified successfully. Wallet is now active.",
      data: { wallet, nibssData: nibssResponse },
    });
    
  } catch (error) {
    console.error("verifyBVN error:", error);
 
    if (error.response?.status === 400) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid BVN provided",
        error: error.message,
        ErrorStack: error.stack 
    });
    }
    if (error.response?.status === 404) {
      return res.status(404).json({ 
        success: false, 
        message: "BVN not found on NIBSS",
        error: error.message,
        ErrorStack: error.stack  
      });
    }
    return res.status(500).json({ 
        success: false, 
        message: "BVN verification failed"
    });
  }
};

/**
 * POST /wallet/verify-nin
 * Verify a NIN via NIBSS and activate the wallet on success.
 */
const verifyNIN = async (req, res) => {
  try {
    const { nin } = req.body;
    const { userId } = req;

    if (!nin) {
      return res.status(400).json({ 
        success: false, 
        message: "NIN is required" 
      });
    }

    // 1️⃣ Fetch wallet
    let wallet;
    try {
      wallet = await Wallet.findOne({ user: userId });
    } catch (walletErr) {
      console.error('[Wallet.findOne] Wallet fetch failed:', walletErr.message);
      throw walletErr;
    }

    if (!wallet) {
      return res.status(404).json({ 
        success: false, 
        message: "Wallet not found" 
      });
    }

    if (["Suspended", "Frozen", "Closed"].includes(wallet.status)) {
      return res.status(403).json({
        success: false,
        message: `Cannot verify NIN for a ${wallet.status.toLowerCase()} wallet`,
      });
    }

    // 2️⃣ EXTERNAL API - Verify NIN
    let nibssResponse;
    try {
      nibssResponse = await validateNIN(nin);
    } catch (validateErr) {
      console.error('[validateNIN] NIBSS API failed:', validateErr.message);
      if (validateErr.response?.status === 400) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid NIN provided" 
        });
      }
      if (validateErr.response?.status === 404) {
        return res.status(404).json({ 
          success: false, 
          message: "NIN not found on NIBSS" 
        });
      }
      throw validateErr;
    }
    
    // 3️⃣ DATABASE - Update Wallet Status
    wallet.status = "Active";
    try {
      await wallet.save();
    } catch (updateErr) {
      console.error('[wallet.save] Wallet status update failed:', updateErr.message);
      throw updateErr;
    }

    return res.status(200).json({
      success: true,
      message: "NIN verified successfully. Wallet is now active.",
      data: { wallet, nibssData: nibssResponse },
    });
  } catch (error) {
    console.error("[verifyNIN] Unexpected error:", error.message || error);
    return res.status(500).json({ 
      success: false, 
      message: "NIN verification failed" 
    });
  }
};

/**
 * GET /wallet/name-enquiry/:accountNumber
 * Perform a NIBSS interbank name enquiry for a given account number.
 */
const enquireName = async (req, res) => {
  try {
    const { accountNumber } = req.params;

    if (!accountNumber) {
      return res.status(400).json({ 
        success: false, 
        message: "Account number is required" 
    });
    }

    // 1️⃣ EXTERNAL API - Name Enquiry
    let nibssResponse;
    try {

      nibssResponse = await nameEnquiry(accountNumber);

    } catch (enquiryErr) {
      
      console.error('[nameEnquiry] NIBSS API failed:', enquiryErr.message);
      if (enquiryErr.response?.status === 404) {
        return res.status(404).json({ 
          success: false, 
          message: "Account number not found",
          errorStack : enquiryErr.stack 
        });
      }
      throw enquiryErr;
    }

    return res.status(200).json({
      success: true,
      message: "Name enquiry successful",
      data: nibssResponse,
    });

  } catch (error) {
    console.error("[enquireName] Unexpected error:", error.message || error);
    return res.status(500).json({ 
        success: false, 
        message: "Name enquiry failed" 
    });
  }
};

/**
 * GET /wallet
 * Fetch the authenticated user's wallet details.
 */
const getWallet = async (req, res) => {
  try {
    // 1️⃣ DATABASE - Fetch wallet with user details
    let wallet;
    try {
      wallet = await Wallet.findOne({ user: req.userId }).populate("user", "name email");
    } catch (walletErr) {
      console.error('[Wallet.findOne] Wallet fetch failed:', walletErr.message);
      throw walletErr;
    }

    if (!wallet) {
      return res.status(404).json({ 
        success: false, 
        message: "Wallet not found" 
      });
    }

    return res.status(200).json({ 
        success: true, 
        data: wallet 
    });

  } catch (error) {
    console.error("[getWallet] Unexpected error:", error.message || error);
    return res.status(500).json({ 
        success: false, 
        message: "Internal server error" 
    });
  }
};

/**
 * GET /wallets/:walletId
 * Get a single wallet by its ID.
 */
const getWalletById = async (req, res) => {
  try {
    const { walletId } = req.params;
    
    // 1️⃣ DATABASE - Fetch wallet by ID
    let wallet;
    try {
      wallet = await Wallet.findById(walletId).populate("user", "name email");
    } catch (walletErr) {
      console.error('[Wallet.findById] Wallet fetch failed:', walletErr.message);
      throw walletErr;
    }

    if (!wallet) {
      return res.status(404).json({ 
        success: false, 
        message: "Wallet not found." 
      });
    }

    return res.status(200).json({ 
        success: true, 
        data: wallet 
    });

  } catch (error) {
    console.error("[getWalletById] Unexpected error:", error.message || error);
    return res.status(500).json({ 
        success: false, 
        message: "Internal server error" 
    });
  }
};

/**
 * PATCH /wallet/status
 * Admin-only: update a wallet's status (suspend, freeze, close, etc.).
 *
 * Body: { userId: string, status: "Active" | "Suspended" | "Frozen" | "Closed" | "Dormant" }
 */
const updateWalletStatus = async (req, res) => {
  try {
    const { userId, status } = req.body;

    const allowed = ["Active", "Suspended", "Frozen", "Closed", "Dormant"];

    if (!status || !allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowed.join(", ")}`,
      });
    }

    // 1️⃣ DATABASE - Update Wallet Status
    let wallet;
    try {
      wallet = await Wallet.findOneAndUpdate(
        { user: userId },
        { status },
        { new: true }
      );
    } catch (updateErr) {
      console.error('[Wallet.findOneAndUpdate] Wallet status update failed:', updateErr.message);
      throw updateErr;
    }

    if (!wallet) {
      return res.status(404).json({ 
        success: false, 
        message: "Wallet not found" 
      });
    }

    return res.status(200).json({
      success: true,
      message: `Wallet status updated to ${status}`,
      data: wallet,
    });
  } catch (error) {
    console.error("[updateWalletStatus] Unexpected error:", error.message || error);
    return res.status(500).json({ 
        success: false, 
        message: "Internal server error" 
    });
  }
};

module.exports = { 
  createWallet, 
  verifyBVN, 
  verifyNIN, 
  enquireName, 
  getWallet, 
  getWalletById, 
  updateWalletStatus 
};

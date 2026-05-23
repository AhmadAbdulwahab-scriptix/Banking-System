const {
    validateBVN, 
    validateNIN, 
    nameEnquiry, 
    interbankTransfer,
    createAccount } = require("../services/nibbs.services");

const Wallet  = require("../models/Wallet.model"); 
const User = require('../models/User.model')
const mongoose = require('mongoose')

/**
 * POST /wallets
 * Create a new wallet for a user.
 * One wallet per user (per currency) is enforced.
 */
const createWallet = async (req, res) => {
  try {
    const { userId, role } = req
    if (role !== 'customer') {
      return res.status(403).json({ success: false, message: "Only a customer is allowed to create a wallet" })
    }
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized to create wallet." 
      });
    }

    const { currency } = req.body;
    // Check for existing wallet
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
    
    // Fetch user details
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
    
    // EXTERNAL API - Create Account
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

    // DATABASE - Create Wallet Record
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
    const { userId, role } = req;
    if (role !== 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: "Only a customer is allowed to verify BVN" })
    }
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized to create wallet." 
      });
    }

    const { bvn } = req.body;
    if (!bvn) {
      return res.status(400).json({ 
        success: false, 
        message: "BVN is required" 
    });
    }

    // Fetch wallet
    let wallet;
    try {
      wallet = await Wallet.findOne({ user: userId }).populate("user", "kycType");
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
    if(wallet?.user?.kycType !== "BVN") {
      return res.status(400).json({
        success: false,
        message: "Wallet wasn't created with BVN"
      })
    }

    if (["Suspended", "Frozen", "Closed"].includes(wallet.status)) {
      return res.status(403).json({
        success: false,
        message: `Cannot verify BVN for a ${wallet.status.toLowerCase()} wallet`,
      });
    }

    // EXTERNAL API - Verify BVN
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

    // DATABASE - Update Wallet Status
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
    const { userId, role } = req;
    if (role !== 'customer') {
      return res.status(403).json({ success: false, message: "Only a customer is allowed to create a wallet" })
    }
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized to create wallet." 
      });
    }

    const { nin } = req.body;
    if (!nin) {
      return res.status(400).json({ 
        success: false, 
        message: "NIN is required" 
      });
    }

    // Fetch wallet
    let wallet;
    try {
      wallet = await Wallet.findOne({ user: userId }).populate("user", "kycType");
    } catch (walletErr) {
      console.error('[Wallet.findOne] Wallet fetch failed:', walletErr.message);
      throw walletErr;
    }
    console.log(wallet.user.nin);
    
    if (!wallet) {
      return res.status(404).json({ 
        success: false, 
        message: "Wallet not found" 
      });
    }
    if(wallet.user.kycType !== "NIN") {
      return res.status(400).json({
        success: false,
        message: "Wallet wasn't created with NIN"
      })
    }

    if (["Suspended", "Frozen", "Closed"].includes(wallet.status)) {
      return res.status(403).json({
        success: false,
        message: `Cannot verify NIN for a ${wallet.status.toLowerCase()} wallet`,
      });
    }

    // EXTERNAL API - Verify NIN
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
    
    // DATABASE - Update Wallet Status
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

    // EXTERNAL API - Name Enquiry
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
    const { role, userId } = req;
    if (role !== 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: "Only a customer is allowed to get wallet details" })
    };
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized to get wallet details." 
      });
    };

    let wallet;
    try {
      wallet = await Wallet.findOne({ user: userId }).populate("user", "name email");
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
    // Role guard — customers must not be able to get other users info
    if (!['staff', 'admin', 'super-admin'].includes(req.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only staff or admin can get wallet by ID'
      });
    }
    const { walletId } = req.params;
    if (!walletId || !mongoose.Types.ObjectId.isValid(walletId)) {
      return res.status(400).json({ success: false, message: 'Valid wallet ID is required' });
    }
    // DATABASE - Fetch wallet by ID
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
    // Role guard — customers must not be able to change their own wallet status
    if (!['staff', 'admin', 'super-admin'].includes(req.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only staff or admin can update wallet status'
      });
    }

    const { walletId } = req.params;
    const { status } = req.body
    const allowed = ["Active", "Suspended", "Frozen", "Closed", "Dormant"];

    if (!walletId || !mongoose.Types.ObjectId.isValid(walletId)) {
      return res.status(400).json({ success: false, message: 'Valid wallet ID is required' });
    }
    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowed.join(", ")}`,
      });
    }

    let wallet;
    try {
      wallet = await Wallet.findByIdAndUpdate(
        walletId,
        { status },
        { new: true }
      );
    } catch (updateErr) {
      console.error('[Wallet.findOneAndUpdate] Wallet status update failed:', updateErr.message);
      throw updateErr;
    }

    if (!wallet) {
      return res.status(404).json({ success: false, message: "Wallet not found" });
    }

    return res.status(200).json({
      success: true,
      message: `Wallet status updated to ${status}`,
      data: wallet,
    });
  } catch (error) {
    console.error("[updateWalletStatus] Unexpected error:", error.message || error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /wallet/all
 * Staff/Admin only: get all wallets with optional filters and pagination.
 * Query: ?status=Active|Suspended|Frozen|Closed|Dormant&page=1&limit=20
 */
const getAllWallets = async (req, res) => {
  try {
    if (!['staff', 'admin', 'super-admin'].includes(req.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only staff or admin can view all wallets'
      });
    }

    const { status, page = 1, limit = 20 } = req.query;

    const filter = {};
    const allowed = ["Active", "Suspended", "Frozen", "Closed", "Dormant", "Pending"];
    if (status) {
      if (!allowed.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status filter. Must be one of: ${allowed.join(', ')}`
        });
      }
      filter.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    let wallets, total;
    try {
      [wallets, total] = await Promise.all([
        Wallet.find(filter)
          .populate('user', 'firstName lastName email phone role kycType isVerified')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit)),
        Wallet.countDocuments(filter)
      ]);
    } catch (dbErr) {
      console.error('[getAllWallets] DB query failed:', dbErr.message);
      throw dbErr;
    }

    return res.status(200).json({
      success: true,
      data: wallets,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error) {
    console.error('[getAllWallets] Unexpected error:', error.message || error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * PATCH /wallet/approve-bvn
 * Staff/Admin only: manually approve a user's BVN and activate their wallet.
 * Used when automated NIBSS verification is not available or needs override.
 * Body: { userId: string }
 */
const approveBVN = async (req, res) => {
  try {
    // if (!['staff', 'admin', 'super-admin'].includes(req.role)) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Only staff or admin can approve BVN'
    //   });
    // }
    const { walletId } = req.params;

    if (!walletId || !mongoose.Types.ObjectId.isValid(walletId)) {
      return res.status(400).json({ success: false, message: 'Valid wallet ID is required' });
    }
    // Fetch the user to confirm they have a BVN on record
    let wallet;
    try {
      wallet = await Wallet.findById(walletId).populate("user", "kycType firstName lastName");
    } catch (walletErr) {
      console.error('[approveBVN] Wallet fetch failed:', walletErr.message);
      throw walletErr;
    }
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found for this user' });
    }
    if (wallet?.user?.kycType !== 'BVN') {
      return res.status(400).json({
        success: false,
        message: `User's KYC type is "${wallet.user.kycType}", not BVN`
      });
    }
    if (wallet.status === 'Active') {
      return res.status(409).json({ success: false, message: 'Wallet is already active' });
    }
    if (['Closed', 'Frozen'].includes(wallet.status)) {
      return res.status(403).json({
        success: false,
        message: `Cannot approve BVN for a ${wallet.status.toLowerCase()} wallet`
      });
    }

    // Mark user as verified and activate wallet
    wallet.user.isVerified = true;
    wallet.status = 'Active';

    try {
      await Promise.all([wallet.user.save(), wallet.save()]);
    } catch (saveErr) {
      console.error('[approveBVN] Save failed:', saveErr.message);
      throw saveErr;
    }

    return res.status(200).json({
      success: true,
      message: `BVN approved for ${wallet.user.firstName} ${wallet.user.lastName}. Wallet is now active.`,
      data: { wallet, userId: wallet.user._id }
    });

  } catch (error) {
    console.error('[approveBVN] Unexpected error:', error.message || error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * PATCH /wallet/approve-nin
 * Staff/Admin only: manually approve a user's NIN and activate their wallet.
 * Body: { userId: string }
 */
const approveNIN = async (req, res) => {
  try {
    if (!['staff', 'admin', 'super-admin'].includes(req.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only staff or admin can approve NIN'
      });
    }

    const { walletId } = req.params;

    if (!walletId || !mongoose.Types.ObjectId.isValid(walletId)) {
      return res.status(400).json({ success: false, message: 'Valid wallet ID is required' });
    }
    // Fetch the user to confirm they have a BVN on record
    let wallet;
    try {
      wallet = await Wallet.findById(walletId).populate("user", "kycType");
    } catch (walletErr) {
      console.error('[approveNIN] Wallet fetch failed:', walletErr.message);
      throw walletErr;
    }
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found for this user' });
    }
    if (wallet?.user?.kycType !== 'NIN') {
      return res.status(400).json({
        success: false,
        message: `User's KYC type is "${user.kycType}", not NIN`
      });
    }
    if (wallet.status === 'Active') {
      return res.status(409).json({ success: false, message: 'Wallet is already active' });
    }
    if (['Closed', 'Frozen'].includes(wallet.status)) {
      return res.status(403).json({
        success: false,
        message: `Cannot approve BVN for a ${wallet.status.toLowerCase()} wallet`
      });
    }

    // Mark user as verified and activate wallet
    user.isVerified = true;
    wallet.status = 'Active';

    try {
      await Promise.all([user.save(), wallet.save()]);
    } catch (saveErr) {
      console.error('[approveNIN] Save failed:', saveErr.message);
      throw saveErr;
    }

    return res.status(200).json({
      success: true,
      message: `NIN approved for ${user.firstName} ${user.lastName}. Wallet is now active.`,
      data: { wallet, userId: user._id }
    });

  } catch (error) {
    console.error('[approveNIN] Unexpected error:', error.message || error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  createWallet,
  verifyBVN,
  verifyNIN,
  enquireName,
  getWallet,
  getWalletById,
  updateWalletStatus,
  getAllWallets,
  approveBVN,
  approveNIN
}

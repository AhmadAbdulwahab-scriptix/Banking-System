const { generateAccountNumber } = require("../utils/generateAccountNumbers");
const {
    verifyBVN, 
    validateNIN, 
    nameEnquiry, 
    interbankTransfer} = require("../services/nibbs.services");

const Wallet  = require("../models/Wallet.model"); 
// const WalletModel = require("../models/Wallet.model");


/**
 * POST /wallets
 * Create a new wallet for a user.
 * One wallet per user (per currency) is enforced.
 */
exports.createWallet = async (req, res) => {
  try {
    const { userId, currency } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: "userId is required." 
    });
    };

    // Prevent duplicate wallets for the same user + currency combo
    const existingWallet = await Wallet.findOne({ 
        user: userId, currency: currency || "NGN" 
    });
    console.log("Wallet Model =>", Wallet);

    // Note: If you want to allow multiple wallets per user but only one per currency, 
    // adjust the schema and this check accordingly.
    if (existingWallet) {
      return res.status(409).json({
        success: false,
        message: `A ${currency || "NGN"} wallet already exists for this user.`,
      });
    }

    const accountNumber = await generateAccountNumber();

    const wallet = new Wallet({
      user: userId,
      accountNumber,
      currency: currency || "NGN",
      balance: 0,
      status: "Pending",
    });

    await wallet.save();

    return res.status(201).json({ 
        success: true, 
        message: "Wallet created successfully. Please verify your BVN/NIN to activate.",
        data: wallet
     });

  } catch (error) {
 console.error("CREATE WALLET ERROR:", error);
    return res.status(500).json({ 
        success: false, 
        message: "Unable to create wallet",
        error: error.message, 
        errorStack: error.stack
    });
  }
};


/**
 * POST /wallet/verify-bvn
 * Verify a BVN via NIBSS and activate the wallet on success.
 */
exports.verifyBVN = async (req, res) => {
  try {
    const { bvn } = req.body;
    const userId = req.userId;
 
    if (!bvn) {
      return res.status(400).json({ 
        success: false, 
        message: "BVN is required" 
    });
    }
 
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      return res.status(404).json({ 
        success: false, 
        message: "Wallet not found" });
    }
 
    if (["Suspended", "Frozen", "Closed"].includes(wallet.status)) {
      return res.status(403).json({
        success: false,
        message: `Cannot verify BVN for a ${wallet.status.toLowerCase()} wallet`,
      });
    }
 
    const nibssResponse = await verifyBVN(bvn);
 
    // Activate wallet after successful BVN verification
    wallet.status = "Active";
    await wallet.save();
 
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
        message: "BVN verification failed",
        error: error.message,
        ErrorStack: error.stack 
     });
  }
};
 
/**
 * POST /wallet/verify-nin
 * Verify a NIN via NIBSS and activate the wallet on success.
 */
exports.verifyNIN = async (req, res) => {
  try {
    const { nin } = req.body;
    const userId = req.user._id;
 
    if (!nin) {
      return res.status(400).json({ success: false, message: "NIN is required" });
    }
 
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      return res.status(404).json({ success: false, message: "Wallet not found" });
    }
 
    if (["Suspended", "Frozen", "Closed"].includes(wallet.status)) {
      return res.status(403).json({
        success: false,
        message: `Cannot verify NIN for a ${wallet.status.toLowerCase()} wallet`,
      });
    }
 
    const nibssResponse = await validateNIN(nin);
 
    wallet.status = "Active";
    await wallet.save();
 
    return res.status(200).json({
      success: true,
      message: "NIN verified successfully. Wallet is now active.",
      data: { wallet, nibssData: nibssResponse },
    });
  } catch (error) {
    console.error("verifyNIN error:", error);
 
    if (error.response?.status === 400) {
      return res.status(400).json({ success: false, message: "Invalid NIN provided" });
    }
    if (error.response?.status === 404) {
      return res.status(404).json({ success: false, message: "NIN not found on NIBSS" });
    }
 
    return res.status(500).json({ success: false, message: "NIN verification failed" });
  }
};

/**
 * GET /wallet/name-enquiry/:accountNumber
 * Perform a NIBSS interbank name enquiry for a given account number.
 */
exports.nameEnquiry = async (req, res) => {
  try {
    const { accountNumber } = req.params;
 
    if (!accountNumber) {
      return res.status(400).json({ 
        success: false, 
        message: "Account number is required" 
    });
    }
 
    const nibssResponse = await nameEnquiry(accountNumber);
 
    return res.status(200).json({
      success: true,
      message: "Name enquiry successful",
      data: nibssResponse,
    });

  } catch (error) {

    console.error("nameEnquiry error:", error);
 
    if (error.response?.status === 404) {
      return res.status(404).json({ 
        success: false, 
        message: "Account number not found" 
    });
    }
 
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
exports.getWallet = async (req, res) => {
  try {

    const wallet = await Wallet.findOne({ user: req.userId }).populate("user", "name email");
 
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

    console.error("getWallet error:", error);
    return res.status(500).json({ 
        success: false, 
        message: "Internal server error" });
  }
};

/**
 * GET /wallets/:walletId
 * Get a single wallet by its ID.
 */
exports.getWalletById = async (req, res) => {
  try {
    const { walletId } = req.params;

    // Populate user details (name, email) for better context in responses.
    const wallet = await Wallet.findById(walletId).populate("user", "name email");

    if (!wallet) {
      return res.status(404).json({ 
        success: false, 
        message: "Wallet not found." });
    };

    return res.status(200).json({ 
        success: true, 
        data: wallet 
    });

  } catch (error) {

    return res.status(500).json({ 
        success: false, 
        message: error.message });
  }
};

/**
 * POST /wallet/transfer
 * Initiate an interbank transfer from the user's wallet.
 *
 * Expected body:
 * {
 *   destinationAccountNumber: string,
 *   destinationBankCode: string,
 *   amount: number,        // in kobo (smallest unit)
 *   narration: string,
 * }
 */
exports.interbankTransfer = async (req, res) => {
  try {
    const userId = req.userId;
    const { destinationAccountNumber, destinationBankCode, amount, narration } = req.body;
 
    // Input validation
    if (!destinationAccountNumber || !destinationBankCode || !amount) {
      return res.status(400).json({
        success: false,
        message: "destinationAccountNumber, destinationBankCode, and amount are required",
      });
    }
 
    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Amount must be a positive number" 
    });
    }
 
    // Wallet checks 
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      return res.status(404).json({ 
        success: false, 
        message: "Wallet not found" 
    });
    }
 
    if (wallet.status !== "Active") {
      return res.status(403).json({
        success: false,
        message: `Transfers are not allowed on a ${wallet.status.toLowerCase()} wallet`,
      });
    }
 
    if (wallet.balance < amount) {
      return res.status(402).json({ 
        success: false, 
        message: "Insufficient wallet balance" 
      });
    }
 
    // Debit wallet first (optimistic debit) 
    wallet.balance -= amount;
    await wallet.save();
 
    //  Dispatch to NIBSS 
    let nibssResponse;

    try {
        // Note: If the NIBSS transfer fails, we should ideally have a mechanism to 
        // retry or compensate.
        nibssResponse = await interbankTransfer({
        sourceAccountNumber: wallet.accountNumber,
        destinationAccountNumber,
        destinationBankCode,
        amount,
        narration: narration || "Wallet transfer",
        currency: wallet.currency,
      });
    } catch (transferError) {
      // Rollback debit on NIBSS failure
      wallet.balance += amount;
      await wallet.save();
 
      console.error("NIBSS transfer error:", transferError);
      return res.status(502).json({
        success: false,
        message: "Transfer failed. Your balance has been restored.",
        error: transferError.response?.data || transferError.message,
      });
    }
 
    return res.status(200).json({
      success: true,
      message: "Transfer successful",
      data: {
        newBalance: wallet.balance,
        currency: wallet.currency,
        transfer: nibssResponse,
      },
    });

  } catch (error) {
    console.error("interbankTransfer error:", error);
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
exports.updateWalletStatus = async (req, res) => {
  try {
    const { userId, status } = req.body;
 
    const allowed = ["Active", "Suspended", "Frozen", "Closed", "Dormant"];

    if (!status || !allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowed.join(", ")}`,
      });
    }
 
    const wallet = await Wallet.findOneAndUpdate(
      { user: userId },
      { status },
      { new: true }
    );
 
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
    console.error("updateWalletStatus error:", error);
    return res.status(500).json({ 
        success: false, 
        message: "Internal server error" });
  }
};




//------------------------------------------------------- Old Endpoints
//
/**
 * GET /wallets/user/:userId
 * Get all wallets belonging to a user.
 */
// exports.getWalletsByUser = async (req, res) => {
//   try {
//     const { userId } = req.params;  // Extract userId from route parameters

//     const wallets = await Wallet.find({ user: userId }); // Query wallets by user ID

//     return res.status(200).json({ 
//         success: true, 
//         count: wallets.length, 
//         data: wallets 
//     });
//   } catch (error) {

//     return res.status(500).json({ 
//         success: false, 
//         message: error.message 
//     });
//   }
// };

/**
 * PATCH /wallets/:walletId/status
 * Update the status of a wallet (admin use).
 * Allowed transitions are loosely validated here — tighten as needed.
 */
// exports.updateWalletStatus = async (req, res) => {
//   try {
//     const { status } = req.body;
//     const VALID_STATUSES = ["Pending", "Active", "Suspended", "Frozen", "Closed", "Dormant"];

//     if (!VALID_STATUSES.includes(status)) {
//       return res.status(400).json({
//         success: false,
//         message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
//       });
//     }

//     const wallet = await Wallet.findByIdAndUpdate(
//       req.params.walletId,
//       { status },
//       { new: true, runValidators: true }
//     );

//     if (!wallet) {
//       return res.status(404).json({ 
//         success: false, 
//         message: "Wallet not found." 
//       });
//     }

//     return res.status(200).json({ 
//         success: true, 
//         data: wallet 
//     });

//   } catch (error) {
//     return res.status(500).json({ 
//         success: false, 
//         message: error.message 
//     });
//   }
// };

/**
 * PATCH /wallets/:walletId/credit
 * Credit (add funds to) a wallet.
 * Body: { amount: Number }
 */
// exports.creditWallet = async (req, res) => {
//   try {
//     const { amount } = req.body;
//     const {walletId} = req.params;

//     if (!amount || typeof amount !== "number" || amount <= 0) {
//       return res.status(400).json({ 
//         success: false, 
//         message: "amount must be a positive number." 
//       });
//     }

//     const wallet = await Wallet.findById(walletId);

//     if (!wallet) {
//       return res.status(404).json({ 
//         success: false, 
//         message: "Wallet not found." 
//       });
//     }

//     if (wallet.status !== "Active") {
//       return res.status(403).json({
//         success: false,
//         message: `Cannot credit a wallet with status "${wallet.status}". Wallet must be Active.`,
//       });
//     }

//     wallet.balance += amount;
//     await wallet.save();

//     return res.status(200).json({
//       success: true,
//       message: `₦${amount} credited successfully.`,
//       data: wallet,
//     });

//   } catch (error) {

//     return res.status(500).json({ 
//         success: false,    
//         message: error.message 
//     });
//   }
// };

/**
 * PATCH /wallets/:walletId/debit
 * Debit (withdraw funds from) a wallet.
 * Body: { amount: Number }
 */
// exports.debitWallet = async (req, res) => {
//   try {
//     const { amount } = req.body;

//     if (!amount || typeof amount !== "number" || amount <= 0) {
//       return res.status(400).json({ success: false, message: "amount must be a positive number." });
//     }

//     const wallet = await Wallet.findById(req.params.walletId);

//     if (!wallet) {
//       return res.status(404).json({ success: false, message: "Wallet not found." });
//     }

//     if (wallet.status !== "Active") {
//       return res.status(403).json({
//         success: false,
//         message: `Cannot debit a wallet with status "${wallet.status}". Wallet must be Active.`,
//       });
//     }

//     if (wallet.balance < amount) {
//       return res.status(422).json({ 
//         success: false, 
//         message: "Insufficient balance."
//      });
//     }

//     wallet.balance -= amount;
//     await wallet.save();

//     return res.status(200).json({
//       success: true,
//       message: `₦${amount} debited successfully.`,
//       data: wallet,
//     });
//   } catch (error) {
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };

/**
 * POST /wallets/transfer
 * Transfer funds between two wallets.
 * Body: { fromWalletId, toWalletId, amount }
 */
// exports.transferFunds = async (req, res) => {
//   try {
//     const { fromWalletId, toWalletId, amount } = req.body;

//     if (!fromWalletId || !toWalletId || !amount) {
//       return res.status(400).json({
//         success: false,
//         message: "fromWalletId, toWalletId, and amount are all required.",
//       });
//     }

//     if (fromWalletId === toWalletId) {
//       return res.status(400).json({ 
//         success: false, 
//         message: "Cannot transfer to the same wallet." 
//     });
//     }

//     if (typeof amount !== "number" || amount <= 0) {
//       return res.status(400).json({ 
//         success: false, 
//         message: "amount must be a positive number." 
//     });
//     }

//     // Fetch both wallets in parallel for efficiency
//     // This also allows us to check for their existence and status before 
//     // attempting any updates.

//     const [sender, receiver] = await Promise.all([
//       Wallet.findById(fromWalletId),
//       Wallet.findById(toWalletId),
//     ]);

//     if (!sender) return res.status(404).json({ 
//         success: false, 
//         message: "Sender wallet not found." });

//     if (!receiver) return res.status(404).json({ 
//         success: false, 
//         message: "Receiver wallet not found." });

//     if (sender.status !== "Active") {
//       return res.status(403).json({
//         success: false,
//         message: `Sender wallet is "${sender.status}" and cannot initiate transfers.`,
//       });
//     }

//     if (receiver.status !== "Active") {
//       return res.status(403).json({
//         success: false,
//         message: `Receiver wallet is "${receiver.status}" and cannot receive funds.`,
//       });
//     }

//     if (sender.currency !== receiver.currency) {
//       return res.status(422).json({
//         success: false,
//         message: `Currency mismatch: ${sender.currency} → ${receiver.currency}. Cross-currency transfers are not supported.`,
//       });
//     }

//     if (sender.balance < amount) {
//       return res.status(422).json({ 
//         success: false, 
//         message: "Insufficient balance in sender wallet." });
//     }

//     sender.balance -= amount;
//     receiver.balance += amount;

//     await Promise.all([sender.save(), receiver.save()]);

//     return res.status(200).json({
//       success: true,
//       message: `Transfer of ${sender.currency} ${amount} completed.`,
//       data: { sender, receiver },
//     });

//   } catch (error) {
//     return res.status(500).json({ 
//         success: false, 
//         message: error.message });
//   }
// };

/**
 * DELETE /wallets/:walletId
 * Soft-delete by setting status to "Closed".
 * Hard deletion is intentionally avoided for audit purposes.
 */
// exports.closeWallet = async (req, res) => {
//   try {
//     const { walletId } = req.params;

//     const wallet = await Wallet.findById(walletId);

//     if (!wallet) {
//       return res.status(404).json({ 
//         success: false, 
//         message: "Wallet not found." 
//     });
//     }

//     if (wallet.balance > 0) {
//       return res.status(422).json({
//         success: false,
//         message: "Cannot close a wallet with a non-zero balance. Please withdraw or transfer funds first.",
//       });
//     }

//     wallet.status = "Closed";
//     await wallet.save();

//     return res.status(200).json({ 
//         success: true, 
//         message: "Wallet closed successfully.", data: wallet 
//     });

//   } catch (error) {
//     return res.status(500).json({ 
//         success: false, 
//         message: error.message 
//     });
//   }
// };

// module.exports = {
//   createWallet,
//   getWalletById,
//   getWalletsByUser,
//   updateWalletStatus,
//   creditWallet,
//   debitWallet,
//   transferFunds,
//   closeWallet,
//   verifyBVN,
//   verifyNIN
// };
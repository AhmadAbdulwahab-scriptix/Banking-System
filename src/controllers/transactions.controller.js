const Transaction = require('../models/Transaction.model');
const Wallet = require('../models/Wallet.model')
const { interbankTransfer, transactionStatus, nameEnquiry } = require('../services/nibbs.services')
const { generateTxRef, checkTransactionOwnership } = require('../utils/helper.utils')
const { verifyTxPin } = require('./txPin.controller')
const mongoose = require('mongoose')

// ─── intraBankTransferFunds ──────────────────────────────────────

exports.intraBankTransferFunds = async (req, res) => {
    try {
        const { userId, role } = req;
        
        if (role !== 'customer') {
            return res.status(403).json({ success: false, message: "Only a customer is allowed to make transfer" })
        }
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: "Unauthorized to make transfer." 
            });
        }
        const { receiverWalletId, amount, narration, txPin } = req.body;
        if (!receiverWalletId || !amount || !txPin) {
            return res.status(400).json({ success: false, message: `Missing required fields, enter all required information!` });
        }
        if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(receiverWalletId) || Number.isNaN(amount) || amount < 10 || txPin.length !== 4) {
            return res.status(400).json({ success: false, message: "sender wallet ID, receiver wallet ID amount and transfer pin must be valid"})
        }

        const [sender, receiver] = await Promise.all([   
            Wallet.findOne({ user: userId }).populate("user", "txPin"),
            Wallet.findById(receiverWalletId),
        ]);
        console.log(sender.user);
        
        if (!sender) {
            return res.status(404).json({ success: false, message: `Sender wallet not found` });
        }
        if (!receiver) { 
            return res.status(404).json({ success: false, message: "Receiver wallet not found." });
        }
        if(sender._id.toString() === receiverWalletId) {
            return res.status(400).json({ success: false, message: "cannot transfer funds to the same account" })
        }
        if (role && sender.user._id?.toString() !== userId) {
            return res.status(401).json({ success: false, message: "Unauthorized transfer initiated" });
        } 
        if (sender.status !== "Active") {
            return res.status(403).json({ success: false, message: `Sender wallet is "${sender.status}" and cannot initiate transfers.` });
        }
        if (receiver.status !== "Active") { 
            return res.status(403).json({ success: false, message: `Receiver wallet is "${receiver.status}" and cannot receive funds.` });
        }
        if (sender.currency !== receiver.currency) {
            return res.status(422).json({ success: false, message: `Currency mismatch: ${sender.currency} → ${receiver.currency}. Cross-currency transfers are not supported.` });
        }
        if (sender.balance < amount) {
            return res.status(400).json({ success: false, message: "Insufficient balance" });
        }
        console.log(sender.user);
        
        // check senders tx pin
        const isValidPin = await verifyTxPin(res, sender, txPin) 
        if (!isValidPin) {
            return res.status(401).json({ message: "Invalid transaction PIN" });
        }

        sender.balance -= +amount;
        receiver.balance += +amount;
        
        try {
            await Promise.all([sender.save(), receiver.save()]);
        } catch (saveErr) {
            sender.balance += +amount;
            receiver.balance -= +amount;
            try { 
                await Promise.all([sender.save(), receiver.save()]); 
            } catch (rollbackErr) {
                console.error('[interBankTransfer] Rollback error:', rollbackErr);
            }
            console.error('[intraBankTransfer] Database save error:', saveErr);
            return res.status(500).json({ success: false, message: 'Failed to process transfer. Please try again.' });
        }
        
        let txRef;
        try {
            txRef = await generateTxRef(Transaction);
            const transactionDetails = await Transaction.create({
                reference: txRef,
                senderWallet: sender._id,
                receiverWallet: receiverWalletId,
                amount: amount,
                narration: narration || null,
                type: "transfer",
                status: "success"
            });  
            return res.status(201).json({
                success: true,
                message: `Transfer of ${amount} carried out successfully`,
                transactionDetails
            })
        } catch (txErr) {
            console.error('[intraBankTransfer] Transaction creation error:', txErr);
            return res.status(201).json({
                success: true,
                warning: "Transfer completed but transaction record creation failed.",
                reference: txRef
            });
        }
    } catch (err) {
        console.error('[intraBankTransfer]', err.message || err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

// ─── interBankTransferFunds ──────────────────────────────────────

exports.interBankTransferFunds = async (req, res) => {
    try {
        const { userId, role } = req;
        if (role !== 'customer') {
            return res.status(403).json({ success: false, message: "Only a customer is make transfer" })
        }
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: "Unauthorized to create a make transfer." 
            });
        }
        const { receiverAccountNumber, amount, narration, txPin } = req.body;
        if (!receiverAccountNumber || !amount || !txPin) {
            return res.status(400).json({ success: false, message: `Missing required fields, enter all required information!` });
        }
    if (receiverAccountNumber.length !== 10 || Number.isNaN(amount) || amount < 10 || txPin.length !== 4) {
            return res.status(400).json({ 
                success: false,
                message: "receiver's account number, receiver's bank code, amount and transaction pin are required and must be valid"
            })
        }

        const sender = await Wallet.findOne({ user: userId }).populate("user", "txPin");
        let receiver;
        
        try { 
            receiver = await nameEnquiry(receiverAccountNumber);
        } catch (err) {
            if (err.response?.status === 404) {
                return res.status(404).json({ success: false, message: "Account number not found" });
            }
            console.error('[interBankTransfer] Name enquiry error:', err.message);
            return res.status(500).json({ success: false, message: err.response?.data || "Failed to verify receiver account" });
        }
        
        if (!sender) {
            return res.status(404).json({ success: false, message: `Sender does not exist` });
        }
        if(!receiver) {
            return res.status(404).json({ success: false, message: "Account number not found" });
        }
        if (role && sender?.user?._id?.toString() !== userId) {
            return res.status(401).json({ success: false, message: "Unauthorized transfer initiated" });
        } 
        if (sender.status !== "Active") {
            return res.status(403).json({ success: false, message: `Sender wallet is "${sender.status}" and cannot initiate transfers.` });
        }
        if (sender.balance < amount) {
            return res.status(400).json({ success: false, message: "Insufficient balance" });
        }

        // check senders tx pin
        const isValidPin = await verifyTxPin(res, sender, txPin) 
        if (!isValidPin) {
            return res.status(401).json({ message: "Invalid transaction PIN" });
        }

        sender.balance -= amount;
        try {
            await sender.save();
        } catch (saveErr) {
            sender.balance += amount;
            try { 
                await sender.save(); 
            } catch (rollbackErr) {
                console.error('[interBankTransfer] Rollback error:', rollbackErr);
            }
            console.error('[interBankTransfer] Sender save error:', saveErr);
            return res.status(500).json({ success: false, message: 'Failed to update sender balance' });
        }
        
        let nibssResponse;
        const payload = { 
            from: sender.accountNumber, 
            to: receiverAccountNumber, 
            amount: Number(amount) 
        };
        try {
            nibssResponse = await interbankTransfer(payload);
        } catch (transferError) {
            sender.balance += amount;
            try { 
                await sender.save(); 
            } catch (rollbackErr) {
                console.error('[interBankTransfer] Rollback error:', rollbackErr);
            }
            console.error("[interBankTransfer] NIBSS transfer error:", transferError.message || transferError);
            return res.status(502).json({
                success: false,
                message: "Transfer failed. Your balance has been restored.",
                error: transferError.response?.data || transferError.message,
            });
        }   

        try {
            const transferDetails = await Transaction.create({
                reference: nibssResponse.reference,
                senderWallet: sender._id,
                externalReceiverAccount: receiverAccountNumber,
                amount: Number(amount),
                narration: narration || null,
                type: "transfer",
                status: nibssResponse.status.toLowerCase()
            });
            return res.status(201).json({
                success: true,
                message: `Transfer of ${amount} carried out successfully`,
                transferDetails
            });
        } catch (dbErr) {
            console.error("[interBankTransfer] Transaction record creation failed:", dbErr.message);
            return res.status(500).json({
                success: false,
                message: "Transfer completed but record creation failed. Please contact support.",
                reference: nibssResponse.reference
            });
        }
    } catch (err) {
        console.error('[interBankTransfer]', err.message || err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

// ─── transactionHistory ──────────────────────────────────────────

exports.transactionHistory = async (req, res) => {
    try {
        const reference = req.params.reference;
        if (!reference)  return res.status(400).json({ success: false, message: 'Transaction reference ID is required' });

        const { role, userId } = req;
        let tx = await Transaction.findOne({ reference }).populate("senderWallet", "user").populate("receiverWallet", "user");

        if (!tx) {
            let liveTx;
            try {
                liveTx = await transactionStatus(reference);
            } catch (err) {
                console.error('[transactionHistory] Transaction status fetch error:', err.message);
                return res.status(500).json({ success: false, message: 'Failed to fetch transaction status' });
            }
            
            if (!liveTx) return res.status(404).json({ success: false, message: 'Transaction not found' });

            if (role === "customer") {
                try {
                    const { isSender, isReceiver } = await checkTransactionOwnership(Wallet, liveTx, userId);
                    if (isSender) {
                        return res.status(200).json({ success: true, message: `You sent #${liveTx.amount} to ${liveTx.to}`, data: liveTx });
                    }
                    if (isReceiver) {
                        return res.status(200).json({ success: true, message: `You were credited #${liveTx.amount} by ${liveTx.from}`, data: liveTx });
                    }
                    return res.status(401).json({ success: false, message: 'Not authorized to view this transaction' });
                } catch (ownershipErr) {
                    console.error('[transactionHistory] Ownership check error:', ownershipErr.message);
                    return res.status(500).json({ success: false, message: 'Failed to verify transaction ownership' });
                }
            }

            if (role === "admin" || role === "staff") {
                return res.status(200).json({ success: true, message: 'Transaction generated successfully', data: liveTx });
            }
        }
        
        if (role === "customer") {
            const sender = tx.senderWallet?.user;
            const receiver = tx.receiverWallet?.user;
            const isSender = sender?.toString() === userId;
            const isReceiver = receiver?.toString() === userId;
            
            if (sender && receiver) {
                if (!isSender && !isReceiver) {
                    return res.status(401).json({ success: false, message: "Not authorized" });
                }
                if (isSender) {
                    return res.status(200).json({ success: true, message: `You sent ₦${tx.amount} to another user`, data: tx })
                }              
                if (isReceiver) {
                    return res.status(200).json({ success: true, message: `You were credited ₦${tx.amount} by another user`, data: tx });
                }
            } else {
                let liveTx;
                try {
                    liveTx = await transactionStatus(reference);
                } catch (err) {
                    console.error('[transactionHistory] Live transaction fetch error:', err.message);
                    return res.status(500).json({ success: false, message: 'Failed to verify transaction status' });
                }
                
                if (liveTx && tx.status !== liveTx?.status?.toLowerCase()) {
                    try {
                        tx.status = liveTx?.status?.toLowerCase();
                        await tx.save();
                    } catch (saveErr) {
                        console.error('[transactionHistory] Transaction status update error:', saveErr.message);
                    }
                }
                if (isSender) {
                    return res.status(200).json({ success: true, message: `You sent #${liveTx?.amount} to ${liveTx?.receiverAccount}`, data: tx });
                }
                if (isReceiver) {
                    return res.status(200).json({ success: true, message: `You were credited #${liveTx?.amount} by ${liveTx?.senderAccount}`, data: tx });
                }
            }
        }
        
        if (["admin", "staff"].includes(role)) {
            let liveTx;
            try {
                liveTx = await transactionStatus(reference);
            } catch (err) {
                console.error('[transactionHistory] Admin transaction status fetch error:', err.message);
            }
            
            if (liveTx) {
                if(tx && tx.status !== liveTx?.status?.toLowerCase()) {
                    try {
                        tx.status = liveTx?.status?.toLowerCase();
                        await tx.save();
                    } catch (saveErr) {
                        console.error('[transactionHistory] Admin transaction update error:', saveErr.message);
                    }
                }
                return res.status(200).json({ success: true, message: "Transaction fetched successfully", data: tx });
            }
            return res.status(200).json({ success: true, message: "Transaction fetched successfully", data: tx });
        }
    } catch (err) {
        console.error('[transactionHistory]', err.message || err);
        return res.status(500).json({ success: false, message: err?.response?.data || err.message || 'Internal server error' });
    }
};

// ─── depositFunds ─────────────────────────────────────────────────────
exports.depositFunds = async (req, res) => {
    try {
        const { role } = req;
        if (!['staff', 'admin'].includes(role)) {
            return res.status(403).json({ success: false, message: 'Only staff or admin can process deposits' });
        }

        const { accountNumber, amount, narration } = req.body;

        if (!accountNumber || !amount) {
            return res.status(400).json({ success: false, message: 'accountNumber and amount are required' });
        }
        if (isNaN(amount) || amount < 10) {
            return res.status(400).json({ success: false, message: 'Amount must be a valid number and at least ₦10' });
        }

        const wallet = await Wallet.findOne({ accountNumber });
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Wallet not found for the given account number' });
        }
        if (wallet.status !== 'Active') {
            return res.status(403).json({ success: false, message: `Wallet is "${wallet.status}" and cannot receive deposits` });
        }

        wallet.balance += Number(amount);
        await wallet.save();

        const txRef = await generateTxRef(Transaction);
        const transaction = await Transaction.create({
            reference: txRef,
            receiverWallet: wallet._id,
            amount: Number(amount),
            type: 'credit',
            status: 'success',
            narration: narration || `Cash deposit by ${req.role}`
        });

        return res.status(201).json({
            success: true,
            message: `₦${amount} deposited successfully into account ${accountNumber}`,
            data: transaction
        });

    } catch (err) {
        console.error('[depositFunds]', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── withdrawFunds ───────────────────────────────────────────────────
exports.withdrawFunds = async (req, res) => {
    try {
        const { role } = req;
        if (!['staff', 'admin'].includes(role)) {
            return res.status(403).json({ success: false, message: 'Only staff or admin can process withdrawals' });
        }

        const { accountNumber, amount, narration } = req.body;

        if (!accountNumber || !amount) {
            return res.status(400).json({ success: false, message: 'accountNumber and amount are required' });
        }
        if (accountNumber.length < 10 || isNaN(amount) || amount < 10) {
            return res.status(400).json({ success: false, message: 'Account number must be 10 or above and amount must be a valid number and at least ₦10' });
        }

        const wallet = await Wallet.findOne({ accountNumber });
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Wallet not found for the given account number' });
        }
        if (wallet.status !== 'Active') {
            return res.status(403).json({ success: false, message: `Wallet is "${wallet.status}" and cannot process withdrawals` });
        }
        if (wallet.balance < Number(amount)) {
            return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
        }

        wallet.balance -= Number(amount);
        await wallet.save();

        const txRef = await generateTxRef(Transaction);
        const transaction = await Transaction.create({
            reference: txRef,
            senderWallet: wallet._id,
            amount: Number(amount),
            type: 'debit',
            status: 'success',
            narration: narration || `Withdrawal by ${req.role}`
        });

        return res.status(201).json({
            success: true,
            message: `₦${amount} withdrawn successfully from account ${accountNumber}`,
            data: transaction
        });

    } catch (err) {
        console.error('[withdrawFunds]', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── getAllTransactions ───────────────────────────────────────────────
exports.getAllTransactions = async (req, res) => {
    try {
        const { userId, role } = req;
        const { page = 1, limit = 10, type, status } = req.query;

        let filter = {};

        if (role === 'customer') {
            const wallet = await Wallet.findOne({ user: userId });
            if (!wallet) {
                return res.status(404).json({ success: false, message: 'Wallet not found' });
            }
            // Show transactions where user is either the sender or the receiver
            filter = {
                $or: [
                    { senderWallet: wallet._id },
                    { receiverWallet: wallet._id }
                ]
            };
        }

        if (type)   filter.type   = type;
        if (status) filter.status = status;

        const skip = (Number(page) - 1) * Number(limit);
        const [transactions, total] = await Promise.all([
            Transaction.find(filter)
                .populate('senderWallet', 'accountNumber user')
                .populate('receiverWallet', 'accountNumber user')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            Transaction.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            data: transactions,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit))
            }
        });

    } catch (err) {
        console.error('[getAllTransactions]', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};



// module.exports = { 
//   intraBankTransferFunds, 
//   interBankTransferFunds, 
//   transactionHistory,
// };

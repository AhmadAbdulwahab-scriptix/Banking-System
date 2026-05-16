const Transaction = require('../models/Transaction.model');
const Wallet = require('../models/Wallet.model')
const { interbankTransfer, transactionStatus, nameEnquiry } = require('../services/nibbs.services')
const { generateTxRef, checkTransactionOwnership } = require('../utils/helper.utils')
const mongoose = require('mongoose')

const intraBankTransferFunds = async (req, res) => {
    try {
        const { userId, role } = req;
        const { receiverWalletId, amount, narration } = req.body;
        if (!receiverWalletId || !amount) {
            return res.status(400).json({ success: false, message: `Missing required fields, enter all required information!` });
        }
        if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(receiverWalletId) || Number.isNaN(amount) || amount < 10) {
            return res.status(400).json({ message: "sender wallet ID, receiver wallet ID and amount must be valid"})
        }

        const [sender, receiver] = await Promise.all([
            Wallet.findOne({ user: userId }),
            Wallet.findById(receiverWalletId),
        ]);
        if(sender._id === receiverWalletId) {
            return res.status(400).json({ message: "cannot transfer funds to the same account" })
        }
        if (!sender) {
            return res.status(404).json({ success: false, message: `Sender with account number ${sender.accountNumber} doesn't exist` });
        }
        if (!receiver) { 
            return res.status(404).json({ success: false, message: "Receiver wallet not found." });
        }
        if (role && sender.user.toString() !== userId) {
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
        if (sender && sender.balance < amount) {
            return res.status(400).json({ success: false, message: "Insufficient balance" });
        }    
        
        sender.balance -= amount;
        receiver.balance += amount;
        await Promise.all([sender.save(), receiver.save()]);
        
        const txRef = await generateTxRef(Transaction);
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
    } catch (err) {
        console.error('[intraBankTransfer]', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

//interbank
const interBankTransferFunds = async (req, res) => {
    try {
        const { userId, role } = req;
        const { receiverAccountNumber, amount, narration } = req.body;
        if (!receiverAccountNumber || !amount) {
            return res.status(400).json({ success: false, message: `Missing required fields, enter all required information!` });
        }
        if (receiverAccountNumber.length !== 10 || Number.isNaN(amount) || amount < 10) {
            return res.status(400).json({ 
                success: false,
                message: "receiver's account number, receiver's bank code, and amount are required and amount must be valid"
            })
        }

        const sender = await Wallet.findOne({ user: userId });
        let receiver;
        // in case of any errors during name enquiry
        try { 
            receiver = await nameEnquiry(receiverAccountNumber);
            console.log("Passed 0"); 
        } catch (err) {
            if (err.response?.status === 404) {
                return res.status(404).json({ 
                    success: false, 
                    message: "Account number not found" 
                });
            }
            return res.status(500).json({ 
                success: false, 
                message: err.response?.data
            });
        }
        console.log("Passed 1");
        
        if (!sender) {
            return res.status(404).json({ success: false, message: `Sender does not exist` });
        }
        if(!receiver) {
            return res.status(404).json({ success: false, message: "Account number not found" });
        }
        if (role && sender?.user?.toString() !== userId) {
            console.log(sender?.user?.toString(), userId);
            
            return res.status(401).json({ success: false, message: "Unauthorized transfer initiated" });
        } 
        if (sender.status !== "Active") {
            return res.status(403).json({ success: false, message: `Sender wallet is "${sender.status}" and cannot initiate transfers.` });
        }
        if (sender && sender.balance < amount) {
            return res.status(400).json({ status: false, message: "Insufficient balance" });
        }
        sender.balance -= amount;
        await sender.save();
        
        let nibssResponse;
        const payload = {
            from: sender.accountNumber,
            to: receiverAccountNumber,
            amount: Number(amount),
        }   
        try {
            // Note: If the NIBSS transfer fails, we should ideally have a mechanism to 
            // retry or compensate.
            nibssResponse = await interbankTransfer(payload);
        } catch (transferError) {
            sender.balance += amount;
            await sender.save();
            console.error("NIBSS transfer error:", transferError);

            return res.status(502).json({
                success: false,
                message: "Transfer failed. Your balance has been restored.",
                error: transferError.response?.data || transferError.message,
            });
        }   

        const transferDetails = await Transaction.create({
            reference: nibssResponse.reference,
            senderWallet: sender._id,
            externalReceiverAccount: receiverAccountNumber,
            amount: Number(amount),
            narration: narration || null,
            type: "transfer",
            status: nibssResponse.status.toLowerCase()
        })
        return res.status(201).json({
            success: true,
            message: `Transfer of ${amount} carried out successfully`,
            transferDetails
        })
    } catch (err) {
        console.error('[interBankTransfer]', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

const transactionHistory = async (req, res) => {
    try {
        const reference = req.params.reference;
        if (!reference)  return res.status(400).json({ success: false, message: 'Transaction reference ID is required' });

        const { role, userId } = req;
        let tx = await Transaction.findOne({ reference }).populate("senderWallet", "user").populate("receiverWallet", "user");

        if (!tx) {
            const liveTx = await transactionStatus(reference);
            if (!liveTx) return res.status(404).json({ success: false, message: 'Transaction not found' });

            //if no tx on our db, fetch from X-API
            if (role === "customer") {
                const { isSender, isReceiver } = await checkTransactionOwnership(Wallet, liveTx, userId);
                if (isSender) {
                    return res.status(200).json({ success: true, message: `You sent #${liveTx.amount} to ${liveTx.to}`, data: liveTx });
                }
                if (isReceiver) {
                    return res.status(200).json({ success: true, message: `You were credited #${liveTx.amount} by ${liveTx.from}`, data: liveTx });
                }
                return res.status(401).json({ success: false, message: 'Not authorized to view this transaction' });
            }

            if (role === "admin" || role === "staff") {
                return res.status(200).json({ success: true, message: 'Transaction generated successfully', data: liveTx });
            }
        }
        // Transaction exists in DB
        if (role === "customer") {
            const sender = tx.senderWallet?.user;
            const receiver = tx.receiverWallet?.user;
            const isSender = sender?.toString() === userId;
            const isReceiver = receiver?.toString() === userId;
            
            // if both are from the our bank we dont hit the x-API
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
                //we hit the x-API incase of any change in transaction status
                const liveTx = await transactionStatus(reference);
                if(tx.status !== liveTx?.status?.toLowerCase()) {
                    tx.status = liveTx?.status?.toLowerCase();
                    await tx.save()
                }
                if (isSender) {
                    return res.status(200).json({ success: true, message: `You sent #${liveTx.amount} to ${liveTx.receiverAccount}`, data: tx });
                }
                if (isReceiver) {
                    return res.status(200).json({ success: true, message: `You were credited #${liveTx.amount} by ${liveTx.senderAccount}`, data: tx });
                }
            }
        }
        // Admin / Staff
        if (["admin", "staff"].includes(role)) {
            const liveTx = await transactionStatus(reference);
            if (liveTx) {
                if(tx.status !== liveTx?.status?.toLowerCase()) {
                    tx.status = liveTx?.status?.toLowerCase();
                    await tx.save()
                }
                return res.status(200).json({ success: true, message: "Transaction fetched successfully", data: tx });
            }
            //internal transaction history
            return res.status(200).json({ success: true, message: "Transaction fetched successfully", data: tx });
        }
    } catch (err) {
        console.error('[transactionHistory]', err.message);
        return res.status(500).json({ success: false, message: err?.response?.data || err.message || 'Internal server error' });
    }
};


module.exports = { intraBankTransferFunds, interBankTransferFunds, transactionHistory }
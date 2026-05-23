const Loan = require('../models/Loan.model');
const Wallet = require('../models/Wallet.model');
const Transaction = require('../models/Transaction.model');
const { generateTxRef } = require('../utils/helper.utils');

/**
 * POST /api/loan/apply
 * Customer submits a loan application.
 * Body: { amount, durationMonths, narration? }
 */
const applyLoan = async (req, res) => {
    try {
        const { userId, role } = req;
        const { amount, durationMonths, narration } = req.body;
        
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: "Loan application unauthorized" })
        }
        if (role !== 'customer') {
            return res.status(403).json({ 
                success: false, 
                message: "Only a customer can apply for loan" })
        }

        if (!amount || !durationMonths) {
            return res.status(400).json({ 
                success: false, 
                message: 'amount and durationMonths are required' });
        }
        if (amount < 1000) {
            return res.status(400).json({ success: false, message: 'Minimum loan amount is ₦1,000' });
        }
        if (durationMonths < 1 || durationMonths > 60) {
            return res.status(400).json({ 
                success: false, 
                message: 'Loan duration must be between 1 and 60 months' });
        }

        const wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            return res.status(404).json({ 
                success: false, 
                message: 'Wallet not found. Create a wallet first.' });
        }
        if (wallet.status !== 'Active') {
            return res.status(403).json({ 
                success: false, 
                message: `Wallet is "${wallet.status}". Cannot apply for a loan.` });
        }

        // Prevent stacking loans — one pending or active loan at a time
        const activeLoan = await Loan.findOne({ user: userId, status: { $in: ['pending', 'active'] } });
        if (activeLoan) {
            return res.status(409).json({
                success: false,
                message: 'You already have a pending or active loan. Repay it before applying again.'
            });
        }

        // Simple flat interest: totalRepayable = principal + (principal * rate% * months)
        const interestRate = Number(process.env.LOAN_INTEREST_RATE) || 5;
        const totalRepayable = amount + (amount * (interestRate / 100) * durationMonths);
        const reference = await generateTxRef(Loan);

        const loan = await Loan.create({
            user: userId,
            wallet: wallet._id,
            amount,
            interestRate,
            durationMonths,
            totalRepayable: parseFloat(totalRepayable.toFixed(2)),
            narration: narration || null,
            reference,
            status: 'pending'
        });

        return res.status(201).json({
            success: true,
            message: 'Loan application submitted successfully. Awaiting approval.',
            data: loan
        });

    } catch (err) {
        console.error('[applyLoan]', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

/**
 * PATCH /api/loan/:loanId/approve
 * Staff/Admin approves and disburses a loan — credits the customer's wallet.
 */
const approveLoan = async (req, res) => {
    try {
        const { loanId } = req.params;
        const { userId, role, name } = req;

        if (!['staff', 'admin'].includes(role)) {
            return res.status(403).json({ success: false, message: 'Only staff or admin can approve loans' });
        }

        const loan = await Loan.findById(loanId);
        if (!loan) {
            return res.status(404).json({ success: false, message: 'Loan not found' });
        }
        if (loan.status !== 'pending') {
            return res.status(400).json({ success: false, message: `Cannot approve a loan with status "${loan.status}"` });
        }

        const wallet = await Wallet.findById(loan.wallet);
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Associated wallet not found' });
        }
        if (wallet.status !== 'Active') {
            return res.status(403).json({ success: false, message: `Wallet is "${wallet.status}". Cannot disburse loan.` });
        }

        // Disburse — credit the customer wallet
        wallet.balance += loan.amount;
        await wallet.save();

        // Set due date relative to approval date
        const dueDate = new Date();
        dueDate.setMonth(dueDate.getMonth() + loan.durationMonths);

        loan.status     = 'active';
        loan.approvedBy = userId;
        loan.approvedAt = new Date();
        loan.dueDate    = dueDate;
        await loan.save();

        // Create a credit transaction record for the disbursement
        const txRef = await generateTxRef(Transaction);
        await Transaction.create({
            reference: txRef,
            receiverWallet: wallet._id,
            amount: loan.amount,
            type: 'credit',
            status: 'success',
            narration: `Loan disbursement — Loan Ref: ${loan.reference}`
        });

        return res.status(200).json({
            success: true,
            message: 'Loan approved and wallet credited successfully',
            data: loan
        });

    } catch (err) {
        console.error('[approveLoan]', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

/**
 * PATCH /api/loan/:loanId/reject
 * Staff/Admin rejects a pending loan application.
 */
const rejectLoan = async (req, res) => {
    try {
        const { loanId } = req.params;
        const { role } = req;

        if (!['staff', 'admin'].includes(role)) {
            return res.status(403).json({ success: false, message: 'Only staff or admin can reject loans' });
        }

        const loan = await Loan.findById(loanId);
        if (!loan) {
            return res.status(404).json({ success: false, message: 'Loan not found' });
        }
        if (loan.status !== 'pending') {
            return res.status(400).json({ success: false, message: `Cannot reject a loan with status "${loan.status}"` });
        }

        loan.status = 'rejected';
        await loan.save();

        return res.status(200).json({ success: true, message: 'Loan rejected', data: loan });

    } catch (err) {
        console.error('[rejectLoan]', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

/**
 * POST /api/loan/:loanId/repay
 * Customer makes a repayment — debits their wallet.
 * Body: { amount }
 */
const repayLoan = async (req, res) => {
    try {
        const { loanId } = req.params;
        const { userId, role } = req;
        const { amount } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Loan repayment unauthorized" })
        }
        if (role !== 'customer') {
            return res.status(403).json({ success: false, message: "Only customer can repay loan" })
        }

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'A valid repayment amount is required' });
        }

        const loan = await Loan.findById(loanId);
        if (!loan) {
            return res.status(404).json({ success: false, message: 'Loan not found' });
        }
        if (loan.user.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Not authorized to repay this loan' });
        }
        if (loan.status !== 'active') {
            return res.status(400).json({ success: false, message: `Loan is "${loan.status}" and cannot be repaid` });
        }

        // Cap repayment at outstanding balance to prevent overpayment
        const remaining = loan.totalRepayable - loan.amountRepaid;
        const repayAmount = Math.min(amount, remaining);

        const wallet = await Wallet.findById(loan.wallet);
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Wallet not found' });
        }
        if (wallet.balance < repayAmount) {
            return res.status(400).json({ success: false, message: 'Insufficient wallet balance for repayment' });
        }

        wallet.balance -= repayAmount;
        await wallet.save();

        loan.amountRepaid += repayAmount;
        if (loan.amountRepaid >= loan.totalRepayable) {
            loan.status = 'repaid';
        }
        await loan.save();

        const txRef = await generateTxRef(Transaction);
        await Transaction.create({
            reference: txRef,
            senderWallet: wallet._id,
            amount: repayAmount,
            type: 'debit',
            status: 'success',
            narration: `Loan repayment — Loan Ref: ${loan.reference}`
        });

        return res.status(200).json({
            success: true,
            message: `Repayment of ₦${repayAmount} successful`,
            data: {
                loan,
                remainingBalance: parseFloat((loan.totalRepayable - loan.amountRepaid).toFixed(2))
            }
        });

    } catch (err) {
        console.error('[repayLoan]', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

/**
 * GET /api/loan/my-loans
 * Returns the authenticated customer's own loans (paginated).
 * Query: ?status=pending|active|repaid|rejected&page=1&limit=10
 */
const getMyLoans = async (req, res) => {
    try {
        const { userId, role } = req;
        const { status, page = 1, limit = 10 } = req.query;
        
        if (!userId) {
            return res.status(401).json({ success: false, message: "Loan application unauthorized" })
        }
        if (role !== 'customer') {
            return res.status(403).json({ success: false, message: "Only customer can apply for loan" })
        }

        const filter = { user: userId };
        if (status) filter.status = status;

        const skip = (Number(page) - 1) * Number(limit);
        const [loans, total] = await Promise.all([
            Loan.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
            Loan.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            data: loans,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit))
            }
        });

    } catch (err) {
        console.error('[getMyLoans]', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

/**
 * GET /api/loan/all
 * Admin/Staff: paginated list of all loans with optional status filter.
 * Query: ?status=pending&page=1&limit=20
 */
const getAllLoans = async (req, res) => {
    try {
        const { role } = req;
        if (!['staff', 'admin'].includes(role)) {
            return res.status(403).json({ success: false, message: 'Only staff or admin can view all loans' });
        }

        const { status, page = 1, limit = 20 } = req.query;

        const filter = {};
        if (status) filter.status = status;

        const skip = (Number(page) - 1) * Number(limit);
        const [loans, total] = await Promise.all([
            Loan.find(filter)
                .populate('user', 'firstName lastName email phone')
                .populate('wallet', 'accountNumber balance')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            Loan.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            data: loans,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit))
            }
        });

    } catch (err) {
        console.error('[getAllLoans]', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = { applyLoan, approveLoan, rejectLoan, repayLoan, getMyLoans, getAllLoans };

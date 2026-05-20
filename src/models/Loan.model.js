// NEW FILE
// Reason: Loan feature requires its own model to track application lifecycle,
// disbursement, repayments, due dates, and who approved it.

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const loanSchema = new Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    wallet: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wallet',
        required: true
    },

    amount: {
        type: Number,
        required: true,
        min: 1000
    },

    // Stored as a percentage, e.g. 5 = 5% per month
    interestRate: {
        type: Number,
        required: true
    },

    durationMonths: {
        type: Number,
        required: true,
        min: 1
    },

    // amount + (amount * interestRate/100 * durationMonths), computed on creation
    totalRepayable: {
        type: Number,
        required: true
    },

    amountRepaid: {
        type: Number,
        default: 0
    },

    status: {
        type: String,
        enum: ['pending', 'approved', 'active', 'repaid', 'defaulted', 'rejected'],
        default: 'pending'
    },

    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    approvedAt: {
        type: Date,
        default: null
    },

    dueDate: {
        type: Date,
        default: null
    },

    narration: {
        type: String,
        default: null
    },

    reference: {
        type: String,
        unique: true
    }

}, { timestamps: true });

module.exports = mongoose.model('Loan', loanSchema);

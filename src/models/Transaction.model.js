const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const transactionSchema = new Schema({

    reference: {
      type: String,
      unique: true,
    },

    type: {
      type: String,

      enum: [
        "credit",
        "debit",
        "transfer"
      ],
    },

    senderWallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
    },

    receiverWallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
    },
    
    externalReceiverAccount: {
      type: String,
      minlength: 10,
      maxlength: 10
    },

    amount: {
        type: Number, 
        min: 10
    },

    status: {
      type: String,
      enum: ["pending", "success", "failed", "reversed"],
      default: "pending",
    },

    narration: {type: String},
    
}, {timestamps: true});

module.exports = mongoose.model('Transaction', transactionSchema);


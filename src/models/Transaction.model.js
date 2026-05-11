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

//  senderId: {
//     type: mongoose.Types.ObjectId,
//     ref: "Account",
//     // index: true,
//     // select: false
//   },
//   referenceId: {
//     type: String,
//     required: true,
//     unique: true
//   },
//   sender: {
//     type: String,
//     required: true,
//     minlength: 10,
//     maxlength: 10
//   },
//   senderName: {
//     type: String,
//     required: true,
//   },
//   receiverId: {
//     type: mongoose.Types.ObjectId,
//     ref: "Account",
//     // index: true,
//     // select: false
//   },
//   receiver: {
//     type: String,
//     required: true,
//     minlength: 10,
//     maxlength: 10
//   },
//   receiverName: {
//     type: String,
//     required: true,
//   },
//   amount: {
//     type: Number,
//     min: 10,
//     required: true
//   },
//   status: {
//     type: String,
//     required: true
//   }
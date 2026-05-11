const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const walletSchema = new Schema({
user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    accountNumber: {
      type: String,
      unique: true,
    },

    balance: {
      type: Number,
      default: 0,
    },

    currency: {
      type: String,
      default: "NGN",
    },

    status: {
      type: String,
      enum: ["Pending", "Active", "Suspended", "Frozen", "Closed", "Dormant"],
      default: "Pending",
    },

},{timestamps: true});

module.exports = mongoose.model('Wallet', walletSchema);
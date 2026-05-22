const mongoose = require('mongoose');
const { mainModule } = require('node:process');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    firstName: {
        type: String,
        required: true,
        trim: true
    },

    lastName: {
        type: String,
        required: true,
        trim: true
    },

    dob: {
        type: Date,
        required: true
    },

    email: {
        type: String,
        unique: true,
        sparse: true, // allows null values but keeps uniqueness
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, "Invalid email"]
    },

    bvn : {
        type: String,
        unique: true,
        sparse: true, // allows null values but keeps uniqueness
        minLength: 11,
        maxLength: 11
    },

    nin: {
        type: String,
        unique: true,
        sparse: true, // allows null values but keeps uniqueness
        minLength: 11,
        maxLength: 11
    },

    phone: {
        type: String,
        required: [true, "Phone is required"],
    },

    password: {
        type: String,
        required: true,
        // select: false 
    },

    role: {
        type: String,
        enum: ['customer', 'staff', 'admin', 'super-admin'],
    },

    kycType: {
        type: String,
        required: true,
        enum: ['NIN', 'BVN']
    },

    isVerified: {
        type: Boolean,
        default: true
    }, 

    refreshToken: {
        type: String,
        default: null
    },

    txPin: {
        type: String,
        select: false
    }

},{ timestamps: true });

module.exports = mongoose.model('User', userSchema);
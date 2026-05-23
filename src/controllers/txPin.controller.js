const User = require('../models/User.model');
const Wallet = require('../models/Wallet.model')
const { hashPin, comparePin } = require('../utils/password.encrypt');

/**
 * POST /api/auth/set-tx-pin
 * Set a transaction PIN for the first time.
 * Body: { pin } — must be a 4-digit numeric string
 */
const setTxPin = async (req, res) => {
    try {
        const { userId, role } = req;
        if (role !== 'customer') {
            return res.status(403).json({ 
                success: false, 
                message: "Only a customer is allowed to create transaction pin" })
        }
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: "Unauthorized to create a transaction pin." 
            });
        }
        const { pin } = req.body;
        if (!pin) {
            return res.status(400).json({ 
                success: false, 
                message: 'PIN is required' });
        }
        if (!/^\d{4}$/.test(pin)) {
            return res.status(400).json({ 
                success: false, 
                message: 'PIN must be exactly 4 digits' });
        }

        const [user, wallet] = await Promise.all([
            User.findById(userId).select('+txPin'),
            Wallet.findOne({ user: userId })
        ]);

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' });
        }
        if (!wallet) {
            return res.status(401).json({ 
                success: false, 
                message: "User must have an account to create transaction pin "})
        }
        if (user.txPin) {
            return res.status(409).json({
                success: false,
                message: 'TX PIN already set. Use change-tx-pin to update it.'
            });
        }

        user.txPin = await hashPin(pin);
        await user.save();

        return res.status(200).json({ 
            success: true, 
            message: 'Transaction PIN set successfully' });

    } catch (err) {
        console.error('[setTxPin]', err);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error' });
    }
};

/**
 * PATCH /api/auth/change-tx-pin
 * Change an existing transaction PIN.
 * Body: { currentPin, newPin }
 */
const changeTxPin = async (req, res) => {
    try {
        const { userId, role } = req;
        if (role !== 'customer') {
            return res.status(403).json({ 
                success: false, 
                message: "Only a customer is allowed to change transaction pin" })
        }
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: "Unauthorized to change a transaction pin." 
            });
        }

        const { currentPin, newPin } = req.body;
        if (!currentPin || !newPin) {
            return res.status(400).json({ 
                success: false, 
                message: 'currentPin and newPin are required' });
        }
        if (!/^\d{4}$/.test(newPin)) {
            return res.status(400).json({ 
                success: false, 
                message: 'New PIN must be exactly 4 digits' });
        }
        if (currentPin === newPin) {
            return res.status(400).json({ 
                success: false, 
                message: 'New PIN must be different from current PIN' });
        }

        const [user, wallet] = await Promise.all([
            User.findById(userId).select('+txPin'),
            Wallet.findOne({ user: userId })
        ]);

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' });
        }
        if (!wallet) {
            return res.status(401).json({ 
                success: false, 
                message: "User must have an account to create transation pin "})
        }
        if (!user.txPin) {
            return res.status(400).json({
                success: false,
                message: 'No TX PIN set. Use set-tx-pin first.'
            });
        }

        const isMatch = await comparePin(currentPin, user.txPin);
        if (!isMatch) {
            return res.status(401).json({ 
                success: false, 
                message: 'Current PIN is incorrect' });
        }

        user.txPin = await hashPin(newPin);
        await user.save();

        return res.status(200).json({ 
            success: true, 
            message: 'Transaction PIN changed successfully' });

    } catch (err) {
        console.error('[changeTxPin]', err);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error' });
    }
};

/**
 * Utility — NOT a route handler.
 * Used internally by transfer controllers to verify the PIN before processing.
 * Returns true/false so the calling controller decides what to do on failure.
 */
const verifyTxPin = async (res, sender, pin) => {
    if (!sender?.user?.txPin) {        
        return res.status(400).json({ 
            success: false, 
            message: "Sender doesn't have transaction pin set, click set transaction pin!" 
        })
    };
    console.log(pin, sender.user.txPin);
    
    return (await comparePin(pin, sender?.user?.txPin));
};

module.exports = { setTxPin, changeTxPin, verifyTxPin };

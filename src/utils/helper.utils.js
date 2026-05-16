const crypto = require("crypto");
const Wallet = require('../models/Wallet.model')

const generateTxRef = async (Transaction) => {
    let num;
    let exists = true
    while (exists) {
        num = crypto.randomInt(1000000000000, 9999999999999);
        exists = await Transaction.exists({ reference: `TX${num}` });
    }
    
    
    return `TX${num}`;
};

//check transaction ownership
const checkTransactionOwnership = async (Wallet, liveTx, userId) => {
    const [senderAccount, receiverAccount] = await Promise.all([
        Wallet.findOne(
            { accountNumber: liveTx.from },
            "user"
        ),
        Wallet.findOne(
            { accountNumber: liveTx.to },
            "user"
        )
    ]);
    return {
        isSender: senderAccount?.user?.toString() === userId,
        isReceiver: receiverAccount?.user?.toString() === userId
    };
};

module.exports = { generateTxRef, checkTransactionOwnership }

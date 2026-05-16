/**
 * Generate a unique 10-digit account number.
 * Retries up to 5 times to avoid collisions.
 */
// const generateAccountNumber = async () => {
//   for (let attempt = 0; attempt < 5; attempt++) {
//     const number = Math.floor(1000000000 + Math.random() * 9000000000).toString();
//     const exists = await Wallet.findOne({ accountNumber: number });
//     if (!exists) return number;
//   }
//   throw new Error("Failed to generate a unique account number. Try again.");
// }

const Wallet = require("../models/Wallet.model");

const generateAccountNumber = async () => {
  let accountNumber; // Declare variable to hold the generated account number
  let exists = true; // Initialize to true to enter the loop
  while (exists) {
    // Generate a random 10-digit number
    accountNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    exists = await Wallet.exists({ accountNumber }); // Check if the generated number already exists
  }
  return accountNumber; // Return the unique account number
};

module.exports = { generateAccountNumber };
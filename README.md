# NibssByPhoenix - Digital Wallet & Payment Processing System

A secure and scalable Digital Wallet and Payment Processing System built with Node.js, Express.js, MongoDB, and JWT Authentication.

The system allows users to:

- Register and authenticate accounts
- Create and manage wallets
- Fund wallets
- Transfer money between wallets
- Perform bank transfers
- Verify BVN and account numbers
- View transaction history
- Secure transactions using Transaction PINs
- Generate JWT access tokens
- Process payment transactions securely

---

# Features

## Authentication & Authorization
- User Registration
- User Login
- JWT Authentication
- Refresh Tokens
- Password Hashing using bcrypt

## Wallet Management
- Automatic Wallet Creation
- Wallet Balance Management
- Wallet Funding
- Wallet-to-Wallet Transfer
- Bank Transfers
- Balance Inquiry

## Loan Management
- Apply for loan
- Approve or reject loan 
- repay loan

## Payment Processing
- Transaction Processing
- Transaction History
- Debit & Credit Operations
- Transaction Status Tracking

## Security
- Transaction PIN Validation
- Secure Password Storage
- JWT Protected Routes
- Input Validation
- Error Handling Middleware

## Banking Integrations
- BVN Verification
- Account Name Enquiry
- Bank Account Validation
- External Bank Transfers

---

# Tech Stack

## Backend
- Node.js
- Express.js

## Database
- MongoDB
- Mongoose ODM

## Authentication & Security
- JWT (JSON Web Token)
- bcryptjs

## Other Tools
- Axios
- dotenv
- Morgan
- Cors
- Winston

## Install dependencies
- npm install

## Development Mode
- npm run dev
- npm start


---

# Project Structure

```bash
src/
│
├── config/
│   └── db.connect.js
│
├── controllers/
│   ├── auth.controller.js
│   ├── wallet.controller.js
│   ├── Loan.controller.js
│   ├── transactions.controller.js
│   └── txPin.controller.js
│
├── middleware/
│   ├── errorHandler.middleware.js
│   ├── verify.jwt.js
│   └── verify.role.js
│
├── models/
│   ├── User.model.js
│   ├── Wallet.model.js
│   ├── Loan.model.js
│   └── Transaction.model.js
│    
├── routes/
│   ├── auth.route.js
│   ├── loan.route.js
│   ├── wallet.route.js
│   ├── transaction.route.js
│   └── main.route.js
│
├── services/
│   ├── nibbs.service.js
│
├── utils/
│   ├── generateJWT.util.js
│   ├── logger.utils.js
│   └── password.encrypt.js
│    └── helper.utils.js
│
└── app.js

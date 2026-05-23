# Digital Wallet and Payment Processing System (NibssByphoenix)

## Project Description

This project is a capstone effort to develop a robust Digital Wallet and Payment Processing System. It aims to provide functionalities for user authentication, secure wallet management, intra-bank and inter-bank fund transfers, and a loan management system. The system integrates with the NIBSS (Nigeria Inter-Bank Settlement System) API for external payment processing and KYC verification.

## Features

*   **User Authentication:** Secure registration, login, refresh token, and password reset functionalities for customers, staff, and administrators.
*   **Wallet Management:** Creation and management of digital wallets for users, including balance tracking and status updates.
*   **KYC Verification:** Integration with NIBSS for BVN (Bank Verification Number) and NIN (National Identification Number) verification to activate wallets.
*   **Fund Transfers:**
    *   **Intra-bank Transfers:** Seamless transfers between wallets within the system.
    *   **Inter-bank Transfers:** Integration with NIBSS for transfers to external bank accounts.
*   **Loan Management:** Functionality for customers to apply for loans, and for staff/administrators to approve, reject, and track loan repayments.
*   **Transaction History:** Comprehensive logging and retrieval of all transaction details.
*   **Role-Based Access Control:** Different access levels for customers, staff, and administrators.

## Technologies Used

*   **Backend:** Node.js, Express.js
*   **Database:** MongoDB (via Mongoose ODM)
*   **Authentication:** JWT (JSON Web Tokens), bcryptjs
*   **External APIs:** NIBSS API for payment processing and KYC
*   **Logging:** Winston
*   **Security:** Helmet, express-rate-limit
*   **Other:** Dotenv, Axios, Cookie-parser, CORS, Morgan

## Project Structure

The project follows a clean folder structure to ensure maintainability and scalability:

```
src/
├── configs/             # Database connection and other configurations
├── controllers/         # Business logic for handling requests
├── middleware/          # Express middleware for authentication, error handling, etc.
├── models/              # Mongoose schemas and models
├── routes/              # API route definitions
├── services/            # External service integrations (e.g., NIBSS API)
├── utils/               # Utility functions (e.g., JWT generation, password encryption, logging)
└── app.js               # Main application entry point
```

## Setup Instructions

To get this project up and running on your local machine, follow these steps:

### Prerequisites

*   Node.js (v18 or higher recommended)
*   MongoDB (local instance or cloud-hosted like MongoDB Atlas)
*   Git

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/AhmadAbdulwahab-scriptix/Banking-System.git
    cd Banking-System
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root directory of the project based on the `sample.env` provided. Populate it with your specific configurations.

4.  **Database Setup:**
    Ensure your MongoDB instance is running and accessible via the `MONGO_URI` provided in your `.env` file.

### Running the Application

*   **Development Mode (with Nodemon for auto-restarts):**
    ```bash
    npm run dev
    ```

*   **Production Mode:**
    ```bash
    npm start
    ```

The server will start on the port specified in your `.env` file (default: `5000`).

## API Documentation

API documentation will be available at `http://localhost:<PORT>/api-docs` once Swagger is integrated and the server is running.

## Sample `.env` File

Refer to `sample.env` for required environment variables.

## Contribution Guidelines

We welcome contributions to this project. Please follow these guidelines:

1.  Fork the repository.
2.  Create a new feature branch (`git checkout -b feature/your-feature-name`).
3.  Make your changes and commit them with descriptive messages.
4.  Push your branch to your fork.
5.  Open a pull request to the `development` branch of the main repository.

## License

This project is licensed under the ISC License.

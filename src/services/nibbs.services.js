const axios = require("axios");
let cachedToken = null;
let tokenExpiry = null;

const getNibssToken = async () => {
    const now = Date.now();

    // Return cached token if still valid (60s buffer before expiry)
    if (cachedToken && tokenExpiry && now < tokenExpiry - 60_000) {
        return cachedToken;
    }

    const response = await axios.post(
        `${process.env.NIBSS_BASE_URL}/api/auth/token`,
        {
            apiKey: process.env.NIBSS_API_KEY,
            apiSecret: process.env.NIBSS_API_SECRET, // ← add this to your .env
        },
        {
            headers: { "Content-Type": "application/json" },
        }
    );

    cachedToken = response.data.token;
    tokenExpiry = now + 3600_000; // Token is valid for 1 hour per the docs

    return cachedToken;
};

const API = axios.create({
    baseURL: process.env.NIBSS_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true,
});

// Attach fresh Bearer token to every request
API.interceptors.request.use(async (config) => {
    const token = await getNibssToken();
    config.headers["Authorization"] = `Bearer ${token}`;
    return config;
});

// Auto-retry once if token expired mid-session
API.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            cachedToken = null; // Bust the cache, force fresh login
            tokenExpiry = null;

            const freshToken = await getNibssToken();
            originalRequest.headers["Authorization"] = `Bearer ${freshToken}`;
            return API(originalRequest);
        }

        return Promise.reject(error);
    }
);

const validateBVN = async (bvn) => {
    const response = await API.post(`/api/validateBvn`, { bvn });
    return response.data;
};

const validateNIN = async (nin) => {
    const response = await API.post(`/api/validateNin`, { nin });
    return response.data;
};

const nameEnquiry = async (account_number) => {
    const response = await API?.get(`/api/account/name-enquiry/${account_number}`);
    return response.data;
};

const interbankTransfer = async (payload) => {
    const response = await API.post("/api/transfer", payload);
    return response.data;
};

const dashboard = async () => {
    const response = await API.get("/api/fintech/onboard");
    return response.data;
};

const transactionStatus = async (reference) => {
    const response = await API.get(`/api/transaction/${reference}`)
    return response.data
}

const createAccount = async (payload) => {
    const response = await API.post("/api/account/create", payload);
    return response.data.account.accountNumber
}

module.exports = {
    interbankTransfer,
    nameEnquiry,
    validateBVN,
    validateNIN,
    dashboard,
    transactionStatus,
    createAccount
};
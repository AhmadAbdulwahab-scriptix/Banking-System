const API = axios.create({
    baseURL: process.env.NIBSS_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
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

export const verifyBVN = async (bvn) => {
    const response = await API.post(`/api/validateBvn`, { bvn });
    return response.data;
};

export const validateNIN = async (nin) => {
    const response = await API.post(`/api/validateNin`, { nin });
    return response.data;
};

export const nameEnquiry = async (account_number) => {
    const response = await API.get(`/api/account/name-enquiry/${account_number}`);
    return response.data;
};

export const interbankTransfer = async (payload) => {
    const response = await API.post("/api/transfer", payload);
    return response.data;
};

export const dashboard = async () => {
    const response = await API.get("/api/fintech/onboard");
    return response.data;
};

export default {
    interbankTransfer,
    nameEnquiry,
    verifyBVN,
    validateNIN,
    dashboard,
};
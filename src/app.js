const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose')
require('dotenv').config();
const cookieParser = require('cookie-parser')
const helmet = require('helmet');
const morgan = require('morgan');
// const Redis = require('ioredis');
// const {RedisStore} = require('rate-limit-redis');
const rateLimit = require('express-rate-limit');


// Importing custom/local modules
const connectDB = require('./configs/db.connect');
const mainRoutes = require('./routes/main.route');
const logger = require('./utils/loggers.utils');
const { errorHandler, notFound } = require('./middleware/errorHandler.middleware');

// Initialize Redis client
//REDIS CLIENT 
// const redisClient = new Redis(process.env.REDIS_URL );

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(helmet());
app.use(morgan("dev"));

// Connect to MongoDB
connectDB();

//DDOS protection and rate Limiting
const rateLimitOption = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler : (req, res)=> {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}`)
        res.status(429).json({
            success : false,
            message : "Too many requests from this IP, please try again later."
        })
    },
    // message: "Too many requests from this IP, please try again later.",
    // store : new RedisStore({
    //     sendCommand: (...args) => redisClient.call(...args),
    // }),
});
app.use(rateLimitOption);

// Middleware for logging requests
app.use((req, res, next) =>{
    logger.info(`Received ${req.method} request to ${req.url}`);
    logger.info(`Request Body, ${req.body}`); // This will leak confidential infos on leak
    next();
});

app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "success",
        message: "Fintech Backend server is running fine",
        data: {
            time: new Date().toISOString()
        }
    });
});

app.use("/api", mainRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// mongoose.connection.once('open', () => {
//     app.listen(PORT, () => {
//         console.log(`Server running on port ${PORT}`);
//     });
// })

app.listen(PORT, ()=>{
    console.log(`Server is running on http://localhost:${PORT}`);
});
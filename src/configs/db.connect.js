const mongoose = require('mongoose');
mongoose.set('strictQuery', false);

// Connect to MongoDB
const connectDB = async () =>{
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
        });
        console.log(`Database connected: ${conn.connection.name}`);
        conn.connection.on('error', (err) => {
            console.log("mongoDB", err)
        });
    } catch (error) {
         console.error(`Error Connection to MongoDB: ${error.message}`);
         process.exit(1);    
     }
};

module.exports = connectDB;
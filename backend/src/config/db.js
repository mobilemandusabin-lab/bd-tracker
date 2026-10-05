const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,  // fail fast if MongoDB is unreachable
      connectTimeoutMS: 5000,           // don't hang on TCP handshake
      // Some hosts resolve Atlas SRV records to an unreachable NAT64/IPv6
      // address intermittently. Prefer IPv4 so concurrent dashboard requests
      // do not clear the Mongo connection pool and return 500s.
      family: 4
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;

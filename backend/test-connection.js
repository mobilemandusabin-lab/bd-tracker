const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

console.log('Connecting with URI:', process.env.MONGODB_URI.substring(0, 50) + '...');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB Connected Successfully!');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Connection Error:', e.message);
    process.exit(1);
  });

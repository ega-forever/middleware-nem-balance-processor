require('dotenv').config();

const config = {
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/data'
  },	
};

module.exports = config;

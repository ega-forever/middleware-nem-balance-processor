require('dotenv').config();

const config = {
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/data-nem'
  },
  nis: {
    server:  process.env.NIS || 'http://localhost:7890',
    network: process.env.NETWORK || 'testnet',
  },
  rabbit: {
    url: process.env.RABBIT_URI || 'amqp://localhost:5672',
    serviceName: process.env.RABBIT_SERVICE_NAME || 'app_nem'
  },
};

module.exports = config;

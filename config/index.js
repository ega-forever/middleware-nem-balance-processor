require('dotenv').config();

const config = {
  mongo: {
    accounts: {
      uri: process.env.MONGO_ACCOUNTS_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/data',
      collectionPrefix: process.env.MONGO_COLLECTION_PREFIX || 'nem'
    }
  },
  nis: {
    server: process.env.NIS || 'http://localhost:7890',
    network: process.env.NETWORK || 'testnet',
  },
  rabbit: {
    url: process.env.RABBIT_URI || 'amqp://localhost:5672',
    serviceName: process.env.RABBIT_SERVICE_NAME || 'app_nem'
  },
};

module.exports = config;

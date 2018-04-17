/* 
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
* @author Kirill Sergeev <cloudkserg11@gmail.com>
*/

require('dotenv').config();

const config = {
  mongo: {
    accounts: {
      uri: process.env.MONGO_ACCOUNTS_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/data',
      collectionPrefix: process.env.MONGO_ACCOUNTS_COLLECTION_PREFIX || process.env.MONGO_COLLECTION_PREFIX || 'nem'
    }
  },
  nis: {
    server: process.env.NIS || 'http://localhost:7890',
    network: parseInt(process.env.NETWORK) || -104,
  },
  rabbit: {
    url: process.env.RABBIT_URI || 'amqp://localhost:5672',
    serviceName: process.env.RABBIT_SERVICE_NAME || 'app_nem'
  },
};

module.exports = config;

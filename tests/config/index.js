/** 
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
* @author Kirill Sergeev <cloudkserg11@gmail.com>
*/
require('dotenv').config();
const config = require('../../config');

const providerURI = (process.env.PROXY_PROVIDER || 'http://192.3.61.243:7890@http://192.3.61.243:7778').split('@');


config.dev = {
  accounts: [process.env.ADDRESS_ONE ,process.env.ADDRESS_TWO],
  targeProxy: {
    http: providerURI[0],
    ws: providerURI[1]
  }
};

module.exports =  config;

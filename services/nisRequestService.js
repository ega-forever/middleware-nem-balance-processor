const request = require('request-promise'),
  config = require('../config'),
  { URL } = require('url'),
  bunyan = require('bunyan'),
  log = bunyan.createLogger({name: 'nemBalanceProcessor.requestService'});

const baseUrl = config.nis.server;

const getMosaicsForAccount = async addr => get(`/account/mosaic/owned?address=${addr}`);
const getAccount = async addr => get(`/account/get?address=${addr}`);
const getUnconfirmedTransactions = async addr => get(`/account/unconfirmedTransactions?address=${addr}`);

const get = query => makeRequest(query, 'GET');

const makeRequest = (path, method, body) => {
  const options = {
    method,
    body,
    uri: new URL(path, baseUrl),
    json: true
  };
  return request(options).catch(e => errorHandler(e));
};

const errorHandler = err => {
  log.error(err);
};

module.exports = { 
  getAccount,
  getMosaicsForAccount,
  getUnconfirmedTransactions
};

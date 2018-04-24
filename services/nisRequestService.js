/* 
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
* @author Kirill Sergeev <cloudkserg11@gmail.com>
*/
const request = require('request-promise'),
  config = require('../config'),
  { URL } = require('url'),
  bunyan = require('bunyan'),
  log = bunyan.createLogger({name: 'nemBalanceProcessor.requestService'});

const baseUrl = config.nis.server;

const getMosaicsForAccount = async addr => get(`/account/mosaic/owned?address=${addr}`);
const getMosaicsDefinition = async id => get(`/namespace/mosaic/definition/page?namespace=${id}`);
const getAccount = async addr => get(`/account/get?address=${addr}`);
const getUnconfirmedTransactions = async addr => get(`/account/unconfirmedTransactions?address=${addr}`);
const getBlock = async (blockHeight) => post('/block/at/public', {height: blockHeight});

const get = query => makeRequest(query, 'GET');
const post = (query, body) => makeRequest(query, 'POST', body);

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
  getUnconfirmedTransactions,
  getMosaicsDefinition,
  getBlock
};

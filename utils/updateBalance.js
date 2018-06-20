/**
 * Middleware service for handling user balance.
 * Update balances for accounts, which addresses were specified
 * in received transactions from blockParser via amqp
 *
 * @module Chronobank/nem-balance-processor
 * 
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Kirill Sergeev <cloudkserg11@gmail.com>
 */

const _ = require('lodash'),
  nem = require('nem-sdk').default,
  utils = require('../utils'),
  accountModel = require('../models/accountModel');


const getUnconfirmedBalance = async (addr, unconfirmedTxs, network) => {
  return _.chain(unconfirmedTxs.data)
    .transform((result, item) => {

      const sender = nem.model.address.toAddress(item.transaction.signer, network);

      if (addr === item.transaction.recipient && !_.has(item, 'transaction.mosaics'))
        result.val += item.transaction.amount;

      if (addr === sender && !_.has(item, 'transaction.mosaics'))
        result.val -= item.transaction.amount;

      if (addr === sender)
        result.val -= item.transaction.fee;

      return result;
    }, {val: 0})
    .get('val')
    .value();
};

const getMosaics = async (nisMosaics, addr, initMosaics, unconfirmedTxs, network, tx) => {
  const  accMosaics = _.get(nisMosaics, 'data', {}),
    allKeys = utils.intersectByMosaic(_.get(tx, 'mosaics', {}), accMosaics),
    mosaicsConfirmed = utils.flattenMosaics(accMosaics);
  

  let mosaicsUnconfirmed = _.chain(unconfirmedTxs.data)
    .filter(item => _.has(item, 'transaction.mosaics'))
    .transform((result, item) => {

      if (item.transaction.recipient === nem.model.address.toAddress(item.transaction.signer, network)) //self transfer
        return;

      if (addr === item.transaction.recipient)
        item.transaction.mosaics.forEach(mosaic => {
          result[`${mosaic.mosaicId.namespaceId}:${mosaic.mosaicId.name}`] = 
            (result[`${mosaic.mosaicId.namespaceId}:${mosaic.mosaicId.name}`] || 0) + 
            mosaic.quantity;
        });

      if (addr === nem.model.address.toAddress(item.transaction.signer, network))
        item.transaction.mosaics.forEach(mosaic => {
          result[`${mosaic.mosaicId.namespaceId}:${mosaic.mosaicId.name}`] = 
          (result[`${mosaic.mosaicId.namespaceId}:${mosaic.mosaicId.name}`] || 0) - 
          mosaic.quantity;
        });

      return result;
    }, {})
    .pick(allKeys)
    .toPairs()
    .transform((result, pair) => {
      result[pair[0]] = (mosaicsConfirmed[pair[0]] || 0) + pair[1];
    }, {})
    .value();


  return _.merge({mosaics: initMosaics || {}}, {
    mosaics: _.chain(allKeys)
      .transform((result, key) => {
        result[key] = {
          confirmed: mosaicsConfirmed[key] || 0,
          unconfirmed: mosaicsUnconfirmed[key] || mosaicsConfirmed[key] || 0
        };
      }, {})
      .value()
  });
};



module.exports = async (nis, address, initMosaics = {}, network, tx) => {
  const accObj = await nis.getAccount(address),
    balance = _.get(accObj, 'account.balance'),
    vestedBalance = _.get(accObj, 'account.vestedBalance'),
    unconfirmedTxs = await nis.getUnconfirmedTransactions(address);

  const accUpdateObj = _.isNumber(balance) ? {
    balance: {
      confirmed: balance,
      vested: vestedBalance,
      unconfirmed: balance + getUnconfirmedBalance(address, unconfirmedTxs, network)
    }
  } : {};

  const nisMosaics = await nis.getMosaicsForAccount(address);
  accUpdateObj['mosaics'] = await getMosaics(
    nisMosaics, address, initMosaics, unconfirmedTxs, network, tx
  );


  return await accountModel.findOneAndUpdate(
    {address}, 
    {$set: accUpdateObj}, 
    {new: true}
  );
};

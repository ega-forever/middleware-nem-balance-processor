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
  config = require('../../config'),
  providerService = require('../../services/providerService'),
  mosaicsUtil = require('../mosaics/mosaics');

const getUnconfirmedBalance = (addr, unconfirmedTxs) => {
  return _.chain(unconfirmedTxs.data)
    .transform((result, item) => {

      const sender = nem.model.address.toAddress(item.transaction.signer, config.node.network);

      if (addr === item.transaction.recipient)
        result.val += item.transaction.amount || 0;

      if (addr === sender)
        result.val -= item.transaction.amount || 0;

      if (addr === sender)
        result.val -= item.transaction.fee;

      return result;
    }, {val: 0})
    .get('val')
    .value();
};

const getMosaics = async (address, initMosaics, unconfirmedTxs, tx) => {

  const provider = await providerService.get();
  const nisMosaics = await provider.getMosaicsForAccount(address);

  const accMosaics = _.get(nisMosaics, 'data', {}),
    allKeys = mosaicsUtil.intersectByMosaic(_.get(tx, 'mosaics', {}), accMosaics),
    mosaicsConfirmed = mosaicsUtil.flattenMosaics(accMosaics);


  let mosaicsUnconfirmed = _.chain(unconfirmedTxs.data)
    .filter(item => _.has(item, 'transaction.mosaics'))
    .transform((result, item) => {

      if (item.transaction.recipient === nem.model.address.toAddress(item.transaction.signer, config.node.network)) //self transfer
        return;

      if (address === item.transaction.recipient)
        item.transaction.mosaics.forEach(mosaic => {
          result[`${mosaic.mosaicId.namespaceId}:${mosaic.mosaicId.name}`] =
            (result[`${mosaic.mosaicId.namespaceId}:${mosaic.mosaicId.name}`] || 0) +
            mosaic.quantity;
        });

      if (address === nem.model.address.toAddress(item.transaction.signer, config.node.network))
        item.transaction.mosaics.forEach(mosaic => {
          result[`${mosaic.mosaicId.namespaceId}:${mosaic.mosaicId.name}`] =
            (result[`${mosaic.mosaicId.namespaceId}:${mosaic.mosaicId.name}`] || 0) -
            mosaic.quantity;
        });

      return result;
    }, {})
    //.pick(allKeys)
    .toPairs()
    .transform((result, pair) => {
      result[pair[0]] = (mosaicsConfirmed[pair[0]] || 0) + pair[1];
    }, {})
    .value();


  let mosaics = _.merge(initMosaics || {},
    _.transform(allKeys, (result, key) => {
      result[key] = {
        confirmed: mosaicsConfirmed[key] || 0,
        unconfirmed: mosaicsUnconfirmed[key] || mosaicsConfirmed[key] || 0
      };
    }, {})
  );

  mosaics = _.toPairs(mosaics);

  for (let item of mosaics) {

    let definition = item[0];
    let mosaic = item[1];

    if (mosaic.decimals)
      continue;

    if (definition === 'nem:xem') {
      mosaic.decimals = 6;
      continue;
    }

    mosaic.decimals = await mosaicsUtil.getMosaicDivisibility(_.fromPairs([item]));
  }

  return _.fromPairs(mosaics);
};


module.exports = async (address, initMosaics = {}, tx) => {

  const provider = await providerService.get();

  const accObj = await provider.getAccount(address),
    balance = _.get(accObj, 'account.balance'),
    vestedBalance = _.get(accObj, 'account.vestedBalance'),
    unconfirmedTxs = await provider.getUnconfirmedTransactions(address);

  const accUpdateObj = _.isNumber(balance) ? {
    balance: {
      confirmed: balance,
      vested: vestedBalance,
      unconfirmed: balance + getUnconfirmedBalance(address, unconfirmedTxs)
    }
  } : {};

  accUpdateObj.mosaics = await getMosaics(address, initMosaics, unconfirmedTxs, tx);


  return accUpdateObj;
};

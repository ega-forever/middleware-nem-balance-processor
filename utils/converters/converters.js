/**
 * NEM utils set
 *
 * @module Chronobank/utils
 *
 *
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Kirill Sergeev <cloudkserg11@gmail.com>
 */

const _ = require('lodash');

const convertBalanceWithDivisibility = (balance) => {

  let confirmed = _.get(balance, 'confirmed', 0);
  let unconfirmed = _.get(balance, 'unconfirmed', 0);
  let vested = _.get(balance, 'vested', 0);

  return {
    confirmed: {
      value: confirmed,
      amount: `${(confirmed / 1000000).toFixed(6)}`
    },
    unconfirmed: {
      value: unconfirmed,
      amount: `${(unconfirmed / 1000000).toFixed(6)}`
    },
    vested: {
      value: vested,
      amount: `${(vested / 1000000).toFixed(6)}`
    }
  };
};

const convertMosaicsWithDivisibility = mosaics => {

  return _.chain(mosaics)
    .toPairs()
    .map(pair => {
      let name = pair[0];
      let data = pair[1];

      data = {
        confirmed: {
          amount: data.confirmed / Math.pow(10, data.decimals),
          value: data.confirmed
        },
        unconfirmed: {
          amount: data.unconfirmed / Math.pow(10, data.decimals),
          value: data.unconfirmed
        },
        decimals: data.decimals
      };

      return [name, data];
    })
    .fromPairs()
    .value();

};

module.exports = {
  convertBalanceWithDivisibility,
  convertMosaicsWithDivisibility
};

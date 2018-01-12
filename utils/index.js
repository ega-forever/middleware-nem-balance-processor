/**
 * NEM utils set
 * 
 * @module Chronobank/utils
 * 
 */

const _ = require('lodash');

const flattenMosaics = mosObj =>
  _.transform(mosObj, (acc, m) => acc[`${m.mosaicId.namespaceId}:${m.mosaicId.name}`] = m.quantity, {});


const intersectByMosaic = (m1, m2) =>
  _.intersection(_.keys(flattenMosaics(m1)), _.keys(flattenMosaics(m2)));




module.exports = {
  flattenMosaics,
  intersectByMosaic
};

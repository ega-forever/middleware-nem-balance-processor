/**
 * Middleware service for handling user balance.
 * Update balances for accounts, which addresses were specified
 * in received transactions from blockParser via amqp
 *
 * @module Chronobank/nem-balance-processor
 * @requires config
 * @requires models/accountModel
 */

const _ = require('lodash'),
  Promise = require('bluebird'),
  mongoose = require('mongoose'),
  bunyan = require('bunyan'),
  amqp = require('amqplib'),
  config = require('./config'),
  nem = require('nem-sdk').default,
  utils = require('./utils'),
  nis = require('./services/nisRequestService'),
  accountModel = require('./models/accountModel'),
  log = bunyan.createLogger({name: 'nem-balance-processor'});

const TX_QUEUE = `${config.rabbit.serviceName}_transaction`;

mongoose.Promise = Promise;
mongoose.connect(config.mongo.accounts.uri, {useMongoClient: true});

mongoose.connection.on('disconnected', function () {
  log.error('Mongo disconnected!');
  process.exit(0);
});

const init = async () => {
  let conn = await amqp.connect(config.rabbit.url)
    .catch(() => {
      log.error('Rabbitmq is not available!');
      process.exit(0);
    });

  let channel = await conn.createChannel();

  channel.on('close', () => {
    log.error('Rabbitmq process has finished!');
    process.exit(0);
  });

  try {
    await channel.assertExchange('events', 'topic', {durable: false});
    await channel.assertQueue(`${config.rabbit.serviceName}.balance_processor`);
    await channel.bindQueue(`${config.rabbit.serviceName}.balance_processor`, 'events', `${TX_QUEUE}.*`);
  } catch (e) {
    log.error(e);
    channel = await conn.createChannel();
  }

  channel.prefetch(2);

  channel.consume(`${config.rabbit.serviceName}.balance_processor`, async (data) => {
    try {
      const tx = JSON.parse(data.content.toString()),
        addr = data.fields.routingKey.slice(TX_QUEUE.length + 1),
        accObj = await nis.getAccount(addr),
        balance = _.get(accObj, 'account.balance'),
        vestedBalance = _.get(accObj, 'account.vestedBalance');

      let account = await accountModel.findOne({address: addr});

      if (!account)
        return channel.ack(data);

      let unconfirmedTxs = await nis.getUnconfirmedTransactions(addr);


      let balanceDelta = _.chain(unconfirmedTxs.data)
        .transform((result, item) => {

          if (addr === item.transaction.recipient) {
            result.val += item.transaction.amount;
            return;
          }

          if (addr === nem.model.address.toAddress(item.transaction.signer, config.nis.network)) {
            result.val -= item.transaction.amount;
            if (item.transaction.unconfirmed)
              result.val -= item.transaction.fee;
          }
          return result;
        }, {val: 0})
        .get('val')
        .value();

      console.log('address: ', addr, 'delta: ', balanceDelta);
      console.log(tx.hash);

      let accUpdateObj = balance ? {
        balance: {
          confirmed: balance,
          vested: vestedBalance,
          unconfirmed: balance + balanceDelta
        }
      } : {};

      let accMosaics = await nis.getMosaicsForAccount(addr);
      accMosaics = _.get(accMosaics, 'data', {});
      const commonKeys = utils.intersectByMosaic(_.get(tx, 'mosaics'), accMosaics);
      const flattenedMosaics = utils.flattenMosaics(accMosaics);

      let mosaicsUnconfirmed = _.chain(unconfirmedTxs.data)
        .filter(item => _.has(item, 'transaction.mosaics'))
        .transform((result, item) => {

          if (item.transaction.recipient === nem.model.address.toAddress(item.transaction.signer, config.nis.network)) //self transfer
          {
            return;
          }

          if (addr === item.transaction.recipient) {
            item.transaction.mosaics.forEach(mosaic => {
              result[`${mosaic.mosaicId.namespaceId}:${mosaic.mosaicId.name}`] = (result[`${mosaic.mosaicId.namespaceId}:${mosaic.mosaicId.name}`] || 0) + mosaic.quantity;
            });

          }

          if (addr === nem.model.address.toAddress(item.transaction.signer, config.nis.network)) {
            item.transaction.mosaics.forEach(mosaic => {
              result[`${mosaic.mosaicId.namespaceId}:${mosaic.mosaicId.name}`] = (result[`${mosaic.mosaicId.namespaceId}:${mosaic.mosaicId.name}`] || 0) - mosaic.quantity;
            });
          }
          return result;
        }, {})
        .pick(commonKeys)
        .toPairs()
        .transform((result, pair) => {
          result[pair[0]] = (flattenedMosaics[pair[0]] || 0) + pair[1];
        }, {})
        .value();

      let mosaicsConfirmed = _.pick(utils.flattenMosaics(accMosaics), commonKeys);

      _.merge(accUpdateObj, _.chain(commonKeys)
        .map(key => [
          [`mosaics.${key}.confirmed`, mosaicsConfirmed[key]],
          [`mosaics.${key}.unconfirmed`, mosaicsUnconfirmed[key] || mosaicsConfirmed[key]]
        ])
        .flatten()
        .fromPairs()
        .value()
      );

      account = await accountModel.findOneAndUpdate({address: addr}, accUpdateObj, {new: true});

      let convertedBalance = utils.convertBalanceWithDivisibility(_.merge(account.balance, accUpdateObj.balance));
      let convertedMosaics = await utils.convertMosaicsWithDivisibility(_.merge(account.mosaics, accUpdateObj.mosaics));

      await channel.publish('events', `${config.rabbit.serviceName}_balance.${addr}`, new Buffer(JSON.stringify({
        address: addr,
        balance: convertedBalance,
        mosaics: convertedMosaics,
        tx: tx
      })));

    } catch (e) {
      log.error(e);
      return channel.nack(data);
    }
    channel.ack(data);
  });
};

module.exports = init();

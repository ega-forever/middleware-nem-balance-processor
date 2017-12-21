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

const flattenMosaics = mosObj =>
  _.transform(mosObj, (acc, m) => acc[`${m.mosaicId.namespaceId}:${m.mosaicId.name}`] = m.quantity, {});

const intersectByMosaic = (m1, m2) =>
  _.intersection(_.keys(flattenMosaics(m1)), _.keys(flattenMosaics(m2)));

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
  } catch(e) {
    log.error(e);
    channel = await conn.createChannel();
  }
  
  channel.prefetch(2);

  channel.consume(`${config.rabbit.serviceName}.balance_processor`, async (data) => {
    try {
      const block = JSON.parse(data.content.toString()),
        addr = data.fields.routingKey.slice(TX_QUEUE.length + 1),
        accObj = await nis.getAccount(addr),
        balance = _.get(accObj, 'account.balance');

      let accUpdateObj = balance ? {balance} : {};
      
      if(_.get(block, 'mosaics')) {
        let accMosaics = await nis.getMosaicsForAccount(addr);
        accMosaics = _.get(accMosaics, 'data', {});
        const commonKeys = intersectByMosaic(_.get(block, 'mosaics'), accMosaics);
        accUpdateObj['mosaics'] = _.pick(flattenMosaics(accMosaics), commonKeys);
        delete(accUpdateObj.mosaics['nem:xem']);
      }
      await accountModel.update({address: addr}, accUpdateObj);
      await channel.publish('events', `${config.rabbit.serviceName}_balance.${addr}`, new Buffer(JSON.stringify({
          address: addr,
          balance: balance,
          mosaics: accUpdateObj['mosaics'],
          tx: block
        })));

    } catch(e) {
      log.error(e);
    }
    channel.ack(data);
  });  
};

module.exports = init();

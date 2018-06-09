/**
 * Middleware service for handling user balance.
 * Update balances for accounts, which addresses were specified
 * in received transactions from blockParser via amqp
 *
 * @module Chronobank/nem-balance-processor
 * @requires config
 * @requires models/accountModel
 * 
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Kirill Sergeev <cloudkserg11@gmail.com>
 */

const _ = require('lodash'),
  Promise = require('bluebird'),
  mongoose = require('mongoose'),
  bunyan = require('bunyan'),
  amqp = require('amqplib'),
  config = require('./config'),
  updateBalance = require('./utils/updateBalance'),
  utils = require('./utils'),
  requestsService = require('./services/nisRequestService'),
  accountModel = require('./models/accountModel'),
  ProviderService = require('./services/providerService'),
  UserCreatedService = require('./services/UserCreatedService'),
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

  const providerService = new ProviderService(channel, config.node.providers, config.rabbit.serviceName);
  await providerService.start();
  await providerService.selectProvider();

  const nis = requestsService(providerService);

  const userCreatedService = new UserCreatedService(
    nis, config.node.network, channel, config.rabbit.serviceName
  );
  await userCreatedService.start();


  channel.prefetch(2);

  channel.consume(`${config.rabbit.serviceName}.balance_processor`, async (data) => {
    try {
      const tx = JSON.parse(data.content.toString()),
        addr = data.fields.routingKey.slice(TX_QUEUE.length + 1);

      let account = await accountModel.findOne({address: addr});
      
      if (!account)
        return channel.ack(data);

      account = await updateBalance(
        nis,
        account.address, 
        _.get(account, 'mosaics', {}), 
        config.node.network, 
        tx
      );

      let convertedBalance = utils.convertBalanceWithDivisibility(account.balance);
      let convertedMosaics = await utils.convertMosaicsWithDivisibility(account.mosaics, nis);

      
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

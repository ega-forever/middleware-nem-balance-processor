require('dotenv/config');

const config = require('../config'),
  mongoose = require('mongoose'),
  Promise = require('bluebird');

mongoose.Promise = Promise;
mongoose.connect(config.mongo.accounts.uri, {useMongoClient: true});

const expect = require('chai').expect,
  nis = require('../services/nisRequestService'),
  accountModel = require('../models/accountModel'),
  amqp = require('amqplib'),
  ctx = {};

describe('core/balance processor', function () {

  after(() => {
    return mongoose.disconnect();
  });

  it('find first block with transactions', async () => {

    let findBlock = async (height) => {
      let block = await nis.getBlock(height);
      if (block.transactions.length === 0)
        return await findBlock(height + 1);
      return block;
    };

    let block = await findBlock(800);

    expect(block).to.have.property('transactions');
    ctx.block = block;
  });

  it('add recipient from first tx of found block', async () => {
    await new accountModel({address: ctx.block.transactions[0].recipient}).save();
  });

  it('validate notification via amqp about new tx', async () => {

    let amqpInstance = await amqp.connect(config.rabbit.url);
    let channel = await amqpInstance.createChannel();

    try {
      await channel.assertExchange('events', 'topic', {durable: false});
      await channel.assertQueue(`app_${config.rabbit.serviceName}_test.balance`);
      await channel.bindQueue(`app_${config.rabbit.serviceName}_test.balance`, 'events', `${config.rabbit.serviceName}_balance.${ctx.block.transactions[0].recipient}`);
    } catch (e) {
      channel = await amqpInstance.createChannel();
    }

    return Promise.all([
      (async () => {
        return await channel.publish('events', `${config.rabbit.serviceName}_transaction.${ctx.block.transactions[0].recipient}`, new Buffer(JSON.stringify(ctx.block.transactions[0])));
      })(),
      (async () => {
        return await new Promise(res => {
          channel.consume(`app_${config.rabbit.serviceName}_test.balance`, () => {
            amqpInstance.close();
            res();
          }, {noAck: true})
        });
      })()
    ]);

  });

});

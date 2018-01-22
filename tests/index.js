require('dotenv/config');

const config = require('../config'),
  mongoose = require('mongoose'),
  _ = require('lodash'),
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

      let data = await Promise.map(block.transactions, async tx => {
        let account = await nis.getAccount(tx.recipient);
        return {tx, account};
      });

      let tx = _.chain(data)
        .find(item => _.get(item, 'account.account.balance') > 0)
        .get('tx')
        .value();

      if (!tx)
        return await findBlock(height + 1);

      return tx;
    };

    ctx.tx = await findBlock(800);
    expect(ctx.tx).to.have.property('recipient');
  });

  it('add recipient from first tx of found block', async () => {
    await new accountModel({address: ctx.tx.recipient}).save();
  });

  it('validate notification via amqp about new tx', async () => {

    let amqpInstance = await amqp.connect(config.rabbit.url);
    let channel = await amqpInstance.createChannel();

    try {
      await channel.assertExchange('events', 'topic', {durable: false});
      await channel.assertQueue(`app_${config.rabbit.serviceName}_test.balance`);
      await channel.bindQueue(`app_${config.rabbit.serviceName}_test.balance`, 'events', `${config.rabbit.serviceName}_balance.${ctx.tx.recipient}`);
    } catch (e) {
      channel = await amqpInstance.createChannel();
    }

    return Promise.all([
      (async () => {
        return await channel.publish('events', `${config.rabbit.serviceName}_transaction.${ctx.tx.recipient}`, new Buffer(JSON.stringify(ctx.tx)));
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


  it('validate balance changes', async () => {
    let account = await accountModel.findOne({address: ctx.tx.recipient});
    expect(account).to.have.property('balance');
    expect(account.balance.confirmed.toNumber()).to.be.above(0);
  });

});

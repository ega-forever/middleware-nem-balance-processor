/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Kirill Sergeev <cloudkserg11@gmail.com>
 */
const Promise = require('bluebird'),
  URL = require('url').URL,
  config = require('./config'),
  expect = require('chai').expect,
  providerService = require('../services/providerService'),
  findProcess = require('find-process'),
  amqp = require('amqplib');

let amqpInstance;

describe('core/block processor -  change provider', function () {


  before(async () => {
    amqpInstance = await amqp.connect(config.rabbit.url);
    let channel = await amqpInstance.createChannel();
    await providerService.setRabbitmqChannel(channel, config.rabbit.serviceName);
  });

  after(async () => {
    await amqpInstance.close();
  });


  it('send nem and check that operation through provider 8010 (get from rabbitmq message 8010 and 8011)', async () => {
    const provider = await providerService.get();
    const block = await provider.getBlockByNumber(1000);
    expect(block).to.have.property('signature');
  });

  it('kill provider 8010 and check that provider 8020', async () => {
    let provider = await providerService.get();
    const port = (new URL(provider.http)).port;

    const processInfo = await findProcess('port', port);
    process.kill(processInfo[0].pid, 'SIGKILL');

    await Promise.delay(20000);
    provider = await providerService.get();
    const block = await provider.getBlockByNumber(1000);
    expect(block).to.have.property('signature');
  });


});

/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

const bunyan = require('bunyan'),
  config = require('../config'),
  Api = require('../utils/api/Api'),
  sem = require('semaphore')(1),
  uniqid = require('uniqid'),
  providerServiceInterface = require('middleware-common-components/interfaces/blockProcessor/providerServiceInterface'),
  Promise = require('bluebird'),
  EventEmitter = require('events'),
  log = bunyan.createLogger({name: 'app.services.providerService'});

/**
 * @service
 * @description the service for handling connection to node
 * @returns Object<ProviderService>
 */

class ProviderService {

  constructor() {
    this.events = new EventEmitter();
    this.connector = null;
    this.id = uniqid();
  }

  /**
   * @function
   * @description set rabbitmqChannel
   * @param rabbitmqChannel
   * @return {Promise<void>}
   */
  async setRabbitmqChannel(rabbitmqChannel) {
    this.rabbitmqChannel = rabbitmqChannel;
    await rabbitmqChannel.assertQueue(`${config.rabbit.serviceName}_balance_provider.${this.id}`, {durable: false});
    await rabbitmqChannel.bindQueue(`${config.rabbit.serviceName}_balance_provider.${this.id}`, 'internal', `${config.rabbit.serviceName}_current_provider.set`);
    this._startListenProviderUpdates();
  }

  /** @function
   * @description reset the current connection
   * @return {Promise<void>}
   */
  async resetConnector() {
    this.connector = null;
    this.switchConnector();
    this.events.emit('disconnected');
  }


  /**
   * @function
   * @description start listen for provider updates from block processor
   * @return {Promise<void>}
   * @private
   */
  _startListenProviderUpdates() {

    this.rabbitmqChannel.consume(`${config.rabbit.serviceName}_balance_provider.${this.id}`, async (message) => {
      message = JSON.parse(message.content.toString());
      const providerURI = config.node.providers[message.index];

      if (this.connector && this.connector.http === providerURI.http)
        return;

      if(this.connector)
        this.connector.wsProvider.disconnect();

      this.connector = new Api(providerURI);
      await this.connector.openWSProvider();

      this.connector.events.on('disconnect', () => this.resetConnector());
      this.events.emit('provider_set');
    }, {noAck: true});

  }

  /**
   * @function
   * @description choose the connector
   * @return {Promise<null|*>}
   */
  async switchConnector() {

    await new Promise(res => {
      this.events.once('provider_set', res);
      this.rabbitmqChannel.publish('internal', `${config.rabbit.serviceName}_current_provider.get`, new Buffer(JSON.stringify({})));
    }).timeout(10000).catch(() => {
      log.error('provider hasn\'t been chosen');
      process.exit(0);
    });

    return this.connector;
  }

  /**
   * @function
   * @description safe connector switching, by moving requests to
   * @return {Promise<bluebird>}
   */
  async switchConnectorSafe() {
    return new Promise(res => {
      sem.take(async () => {
        await this.switchConnector();
        res(this.connector);
        sem.leave();
      });
    });
  }

  /**
   * @function
   * @description
   * @return {Promise<*|bluebird>}
   */
  async get() {
    return this.connector || await this.switchConnectorSafe();
  }

}

module.exports = providerServiceInterface(new ProviderService());

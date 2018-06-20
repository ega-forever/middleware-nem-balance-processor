/** 
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
* @author Kirill Sergeev <cloudkserg11@gmail.com>
*/

const _ = require('lodash'),
  bunyan = require('bunyan'),
  Promise = require('bluebird'),
  log = bunyan.createLogger({name: 'nem.balanceProcessor.providerService'}),
  Provider = require('../models/provider');

class ProviderService {
  constructor (channel, configProviders, rabbitPrefix) {
    this.channel = channel;
    this.providers = this.createProviders(configProviders);
    this.rabbitPrefix = rabbitPrefix;
  }


  createProviders (configProviders) {
    return _.map(configProviders, (configProvider, key) => {
      return new Provider(key, configProvider.ws, configProvider.http, 0);
    });
  }

  /**
   * 
   * 
   * @returns {Promise return Provider}
   * 
   * @memberOf ProviderService
   */
  async getProvider () {
    if (this._provider === undefined)
      await this.selectProvider();
    return this._provider;
  }

  async sendWhatProviderEvent () {
    await this.channel.publish('internal', `${this.rabbitPrefix}_current_provider.get`, new Buffer('what'));
  }

  /**
   * @memberOf ProviderService
   */
  async start () {
    await this.channel.assertQueue(`${this.rabbitPrefix}_balance_provider`);
    await this.channel.bindQueue(`${this.rabbitPrefix}_balance_provider`, 'internal', `${this.rabbitPrefix}_current_provider.set`);
    this.channel.consume(`${this.rabbitPrefix}_balance_provider`, async (message) => {
      message = JSON.parse(message.content.toString());
      this.chooseProvider(message.index);
    }, {noAck: true});
  }

  chooseProvider (key) {
    if (!this.providers[key]) {
      log.error('not found provider for key from block_processor[through rabbit mq] key = ' + key);
      process.exit(0);
    }
    log.info('select provider: ' + this.providers[key].getHttp());
    this._provider = this.providers[key];
  }

  /**
   * 
   * @memberOf ProviderService
   */
  async selectProvider () {
    await this.sendWhatProviderEvent();
    await this.checkOnWhat().catch(e => {
      log.error('block_processor not exist or not send info about provider, info:' + e);
      process.exit(0);
    });
  }

  async checkOnWhat () {
    await this.channel.assertQueue(`${this.rabbitPrefix}_current_provider.get`, {durable: false});
    await this.channel.bindQueue(`${this.rabbitPrefix}_current_provider.get`, 'internal', `${this.rabbitPrefix}_current_provider.get`);
    await Promise.delay(3000);
    if (!this._provider) 
      throw new Error('not found provider'); 
    
  }

}

module.exports = ProviderService;

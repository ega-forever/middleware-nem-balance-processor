/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Kirill Sergeev <cloudkserg11@gmail.com>
 */

const updateBalance = require('../utils/updateBalance');

const EXCHANGE_NAME = 'internal';

/**
 * @class UserCreatedService
 *
 * Class, that listen events from rest about user.created
 * and update balance for this user in database
 *
 *
 */
class UserCreatedService {

  /**
   *
   * Constructor, that only create main variables in class
   * not done anything work
   *
   * @param {nisRequestService} nis Object of class services/nisRequestService
   * @param {String} networkName name from config config.node.network
   * @param {AmqpClient} _channel [from amqplib] _channel Channel, through send and response messages
   * @param {String} rabbitPrefix config.rabbit.serviceName | 'app_eth'
   *
   * @memberOf MasterNode
   */
  constructor (nis, networkName, channel, rabbitPrefix) {
    this.nis = nis;
    this.networkName = networkName;
    this.rabbitPrefix = rabbitPrefix;
    this.channel = channel;
  }

  /**
   *
   * Async start function
   * in this function process subscribe on main events in rabbitmq, connected to elections
   * and through MASTER_UPDATE_TIMEOUT run periodic checkMasterProcess
   *
   * @memberOf MasterNode
   */
  async start () {
    await this.channel.assertExchange(EXCHANGE_NAME, 'topic', {durable: false});
    await this.channel.assertQueue(`${this.rabbitPrefix}_balance_user.created`);
    await this.channel.bindQueue(`${this.rabbitPrefix}_balance_user.created`, EXCHANGE_NAME, 
      `${this.rabbitPrefix}_user.created`);

    this.channel.consume(`${this.rabbitPrefix}_balance_user.created`, async (message) => {
      const accData = JSON.parse(message.content);
      if (accData['address']) 
        await updateBalance(
          this.nis,
          accData['address'],
          {} ,
          this.networkName 
        );
      this.channel.ack(message);
    });
  }

}

module.exports = UserCreatedService;

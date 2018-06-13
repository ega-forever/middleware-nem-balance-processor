# middleware-nem-balance-processor [![Build Status](https://travis-ci.org/ChronoBank/middleware-nem-balance-processor.svg?branch=master)](https://travis-ci.org/ChronoBank/middleware-nem-balance-processor)

Middleware service for handling user balance

### Installation

This module is a part of middleware services. You can install it in 2 ways:

1) through core middleware installer  [middleware installer](https://github.com/ChronoBank/middleware)
2) by hands: just clone the repo, do 'npm install', set your .env - and you are ready to go

##### About
This module is used for updating balances for the specified addresses (see a description of addresses manipulation in [rest module](https://github.com/ChronoBank/middleware-nem-rest)).

#### How does it work?

Block processor send message about transaction through rabbitmq to this middleware. Then middleware update balance and assets
for changed accounts. After middleware send message throught rabbitmq with the following format:

```
{ 
 address: 'TCUPVQC77TAMH7QKPFP5OT3TLUV4JYRPV6CEGJXW',
 balance: {
    "unconfirmed" : 110818180900,
    "vested" : 110241162911,
    "confirmed" : 110818180900
 },
 mosaics: {
    "prx:xpx" : {
        "unconfirmed" : 9997989670.0,
        "confirmed" : 9997989670.0
    },
    "nem:xem" : {
        "unconfirmed" : 110818180900.0,
        "confirmed" : 110818180900.0
    }
},
 tx:
  { timeStamp: 389582,
    amount: 10000000000000,
    signature: '72da7b981c9dac6845169fb6f81e410b352c83eefc030ecd903b5b24bd84d0b2c04f991914a9e83784d5ba8883143c770ee317cacec116de104b67b1c0837c08',
    fee: 154000000,
    recipient: 'TCUPVQC77TAMH7QKPFP5OT3TLUV4JYRPV6CEGJXW',
    type: 257,
    deadline: 393182,
    message: {},
    version: -1744830463,
    signer: 'f60ab8a28a42637062e6ed43a20793735c58cb3e8f3a0ab74148d591a82eba4d' } 
 }
```


##### сonfigure your .env

To apply your configuration, create a .env file in root folder of repo (in case it's not present already).
Below is the expamle configuration:

```
MONGO_ACCOUNTS_URI=mongodb://localhost:27017/data
MONGO_ACCOUNTS_COLLECTION_PREFIX=nem
RABBIT_URI=amqp://localhost:5672
RABBIT_SERVICE_NAME=app_nem
NETWORK=development
NIS=http://localhost:7890
```

The options are presented below:

| name | description|
| ------ | ------ |
| MONGO_URI   | the URI string for mongo connection
| MONGO_COLLECTION_PREFIX   | the default prefix for all mongo collections. The default value is 'nem'
| MONGO_ACCOUNTS_URI   | the URI string for mongo connection, which holds users accounts (if not specified, then default MONGO_URI connection will be used)
| MONGO_ACCOUNTS_COLLECTION_PREFIX   | the collection prefix for accounts collection in mongo (If not specified, then the default MONGO_COLLECTION_PREFIX will be used)
| RABBIT_URI   | rabbitmq URI connection string
| RABBIT_SERVICE_NAME   | namespace for all rabbitmq queues, like 'app_nem_transaction'
| NETWORK   | network name (alias)- is used for connecting via ipc (see block processor section)
| NIS   | the path to node rest api for get balance for user

License
----
 [GNU AGPLv3](LICENSE)

Copyright
----
LaborX PTY

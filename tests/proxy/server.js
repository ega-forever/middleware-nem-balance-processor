/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Kirill Sergeev <cloudkserg11@gmail.com>
 */
const httpProxy = require('http-proxy'),
  config = require('../config'),
  bunyan = require('bunyan'),
  log = bunyan.createLogger({name: 'app.proxy'});

// create a server
const provider = config.dev.targeProxy;

if (!process.argv[2] || !process.argv[3]) {
  log.error('not set argument 2 as port for proxy/server.js');
  process.exit(0);
}


const port = process.argv[2];
const portWs = process.argv[3];

httpProxy.createProxyServer({target: provider.http})
  .listen(port);


httpProxy.createProxyServer({target: provider.ws, ws: true})
  .listen(portWs);

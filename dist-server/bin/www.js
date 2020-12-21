#!/usr/bin/env node

/* eslint-disable no-console */

/* eslint-disable func-names */

/* eslint-disable no-shadow */

/* eslint-disable no-use-before-define */

/**
 * Module dependencies.
 */
"use strict";

var _debug = _interopRequireDefault(require("debug"));

var _http = _interopRequireDefault(require("http"));

var _socket = _interopRequireDefault(require("socket.io-redis"));

var _app = _interopRequireDefault(require("../app"));

var _lzqgame = _interopRequireDefault(require("../lzqgame"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var debug = (0, _debug["default"])('your-project-name:server');
/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '3000');

_app["default"].set('port', port);
/**
 * Create HTTP server.
 */


var server = _http["default"].createServer(_app["default"]);

var options = {
  maxHttpBufferSize: 1e8,
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST']
  }
};

var io = require('socket.io')(server, options); // io.adapter(redisAdapter({ host: 'localhost', port: 6379 }));
// eslint-disable-next-line prefer-arrow-callback


io.sockets.on('connection', function (socket) {
  console.log('client connected');

  _lzqgame["default"].initGame(io, socket);
});
/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);
/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (Number.isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}
/**
 * Event listener for HTTP server "error" event.
 */


function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string' ? "Pipe ".concat(port) : "Port ".concat(port); // handle specific listen errors with friendly messages

  switch (error.code) {
    case 'EACCES':
      console.error("".concat(bind, " requires elevated privileges"));
      process.exit(1);
      break;

    case 'EADDRINUSE':
      console.error("".concat(bind, " is already in use"));
      process.exit(1);
      break;

    default:
      throw error;
  }
}
/**
 * Event listener for HTTP server "listening" event.
 */


function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string' ? "pipe ".concat(addr) : "port ".concat(addr.port);
  console.log("Listening on ".concat(bind));
  debug("Listening on ".concat(bind));
}
#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable func-names */
/* eslint-disable no-shadow */
/* eslint-disable no-use-before-define */

/**
 * Module dependencies.
 */

const debugLib = require('debug');
const http = require('http');
const app = require('../app');
const lqz = require('../lzqgame');

const debug = debugLib('your-project-name:server');

/**
 * Get port from environment and store in Express.
 */

const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

/**
 * Create HTTP server.
 */

const server = http.createServer(app);
const options = {
  maxHttpBufferSize: 1e8,
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST'],
  },
};

// io.adapter(redisAdapter({ host: 'localhost', port: 6379 }));
const io = require('socket.io')(server, options);

// eslint-disable-next-line prefer-arrow-callback
io.sockets.on('connection', function (socket) {
  console.log('client connected');
  lqz.initGame(io, socket);
});

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port, '0.0.0.0');
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  const port = parseInt(val, 10);

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

  const bind = typeof port === 'string'
    ? `Pipe ${port}`
    : `Port ${port}`;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`${bind} is already in use`);
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
  const addr = server.address();
  const bind = typeof addr === 'string'
    ? `pipe ${addr}`
    : `port ${addr.port}`;
  console.log(`Listening on ${bind}`);
  debug(`Listening on ${bind}`);
}

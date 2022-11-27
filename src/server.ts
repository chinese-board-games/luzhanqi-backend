#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable func-names */
/* eslint-disable no-shadow */
/* eslint-disable no-use-before-define */

/**
 * Module dependencies.
 */

 import debugLib from 'debug';
 import http from 'http';
 import app from './app';
 import lqz from './lzqgame';
 
 const debug = debugLib('your-project-name:server');
 
 /**
  * Create HTTP server.
  */
 
 const server = http.createServer(app);
 const options = {
     maxHttpBufferSize: 1e8,
     cors: {
         origin: [
             'http://localhost:3000',
             'http://localhost:3001',
             'http://lzq.surge.sh',
             'https://lzq.surge.sh',
         ],
         methods: ['GET', 'POST'],
     },
 };

 interface ServerToClientEvents {
    noArg: () => void;
    basicEmit: (a: number, b: string, c: Buffer) => void;
    withAck: (d: string, callback: (e: number) => void) => void;
  }
  
  interface ClientToServerEvents {
    hello: () => void;
  }
  
  interface InterServerEvents {
    ping: () => void;
  }
  
  interface SocketData {
    name: string;
    age: number;
  }  
 
 // io.adapter(redisAdapter({ host: 'localhost', port: 6379 }));
 // TODO: how tf do you get this to work with typescript imports?
 // eslint-disable-next-line @typescript-eslint/no-var-requires
 const io = require('socket.io')(server, options);
 
 // eslint-disable-next-line prefer-arrow-callback
 io.sockets.on('connection', function (socket: any) {
     console.log('client connected');
     lqz.initGame(io, socket);
 });
 
 /**
  * Listen on provided port, on all network interfaces.
  */
 
 server.listen(process.env.PORT || 3000);
 server.on('error', onError);
 server.on('listening', onListening);
 
 /**
  * Event listener for HTTP server "error" event.
  */
 
 function onError(error: any) {
     if (error.syscall !== 'listen') {
         throw error;
     }
 
     const bind =
         typeof error.port === 'string'
             ? `Pipe ${process.env.PORT || 3000}`
             : `Port ${process.env.PORT || 3000}`;
 
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
     const bind =
         typeof addr === 'string' ? `pipe ${addr}` : `port ${addr?.port}`;
     console.log(`Listening on ${bind}`);
     debug(`Listening on ${bind}`);
 }
 
#!/usr/bin/env node

/**
 * Module dependencies.
 */

import debugLib from 'debug';
import http from 'http';
import app from './app';
import { initGame } from './lzqgame';
import { Socket } from 'socket.io';
import HTTPSocketIOServer from './HTTPSocketIOServer';

const debug = debugLib('your-project-name:server');

/**
 * Create HTTP server.
 */

const server = http.createServer(app);

const io = HTTPSocketIOServer(server);

io.on('connection', (socket: Socket) => {
    console.info(`Client connected on ${socket.id}`);
    console.info(`Socket recovered: ${socket.recovered}`);
    initGame(socket);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line no-fallthrough
        case 'EADDRINUSE':
            console.error(`${bind} is already in use`);
            process.exit(1);
        // eslint-disable-next-line no-fallthrough
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
    console.info(`Listening on ${bind}`);
    debug(`Listening on ${bind}`);
}

export default io;

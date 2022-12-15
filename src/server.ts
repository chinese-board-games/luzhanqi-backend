#!/usr/bin/env node
/* eslint-disable no-fallthrough */

/**
 * Module dependencies.
 */

import debugLib from 'debug';
import http from 'http';
import app from './app';
import { initGame } from './lzqgame';
import { Server, Socket } from 'socket.io';

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
            /.*lzq\.surge\.sh.*/,
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

const io = new Server(server, options);
io.on('connection', (socket: Socket) => {
    console.log('client connected');
    initGame(io, socket);
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
        case 'EADDRINUSE':
            console.error(`${bind} is already in use`);
            process.exit(1);
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

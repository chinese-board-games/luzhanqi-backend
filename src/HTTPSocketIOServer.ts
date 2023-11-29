import http from 'http';
import { Server } from 'socket.io';

const HTTPSocketIOServer = (server: http.Server) => {
    const options = {
        maxHttpBufferSize: 1e8,
        cors: {
            origin: [
                /http:\/\/localhost:\d+\/*/, // local development
                /.*lzq\.surge\.sh.*/,
                /.*lzq-staging\.surge\.sh.*/,
                /.*luzhanqi\.netlify\.app.*/,
                /.*luzhanqi-staging\.netlify\.app.*/,
            ],
            methods: ['GET', 'POST'],
        },
        connectionStateRecovery: {
            maxDisconnectionDuration: 2 * 60 * 1000,
            skipMiddlewares: true,
        },
    };
    return new Server(server, options);
};
export default HTTPSocketIOServer;

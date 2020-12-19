import express from 'express';
import http from 'http';
import { socker } from './socker';
import { API_PORT, host } from './env';

const app = express();
const server = new http.Server(app);
socker(server);

app.listen(API_PORT, () => {
  logger.info(`Api listening on port ${Number(API_PORT)}!`);
});

server.listen(Number(API_PORT) + 1, () => {
  logger.info(`Socker listening on port ${Number(API_PORT) + 1}!`);
  logger.info(`Api and socker whitelisted for ${host}`);
});

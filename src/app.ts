import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import express from 'express';
import rateLimit from 'express-rate-limit';
import user from './routes/user';
import game from './routes/games';
import cors from 'cors';

dotenv.config();

const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME } = process.env;

const LOCAL_MONGO_URI = `mongodb://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}streamhatchet?directConnection=true&authSource=admin`;

// DB Setup
const mongoURI = process.env.MONGODB_URI || LOCAL_MONGO_URI;
mongoose.connect(mongoURI);
// set mongoose promises to es6 default
mongoose.Promise = global.Promise;

const app = express();
app.use(cors());

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// used by CI/CD promotion checks and Render's own health checks - reports
// 503 while Mongo is unreachable rather than a false-positive 200, since a
// disconnected DB makes every real route unusable anyway
app.get('/health', (_req, res) => {
    const mongoConnected = mongoose.connection.readyState === 1;
    res.status(mongoConnected ? 200 : 503).send({
        status: mongoConnected ? 'ok' : 'degraded',
        mongo: mongoConnected ? 'connected' : 'disconnected',
    });
});

// gameplay itself goes over socket.io (lzqgame.ts), not these REST routes -
// they're only hit for account/history operations, so a generous per-IP
// window is plenty to stop abuse without affecting real usage
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/user', apiLimiter, user);
app.use('/games', apiLimiter, game);

export default app;

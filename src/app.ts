import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import express from 'express';
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

app.use('/user', user);
app.use('/games', game);

export default app;

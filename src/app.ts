import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import express from 'express';

dotenv.config();

// DB Setup
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost/luzhanqi';
mongoose.connect(mongoURI, {
    useFindAndModify: false,
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
// set mongoose promises to es6 default
mongoose.Promise = global.Promise;

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

export default app;

// router for the user
// Path: src\routes\user\index.ts

import { Router } from 'express';
// import functions from the controller
import {
    createUser,
    getUser,
    addGame,
    removeGame,
    getGames,
    getRank,
    setRank,
} from '../../controllers/userController';

const user = Router();

// start urls with "user/"

// create a user
user.post('/users/:userId', createUser);
user.get('/users/:userId', getUser);
user.post('/users/:userId/games/:gameId', (req, res) => {
    addGame(req.params.userId, req.params.gameId);
});
user.delete('/users/:userId/games/:gameId', (req, res) => {
    removeGame(req.params.userId, req.params.gameId);
});
user.get('/users/:userId/games', getGames);
user.get('/users/:userId/rank', getRank);
user.put('/users/:userId/rank', (req, res) => {
    setRank(req.params.userId, req.body.rank);
});

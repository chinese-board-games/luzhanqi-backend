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
user.post('/:userId', async (req, res) => {
    console.log('createUser');
    const myUser = await createUser(req.params.userId);
    res.status(200).send(myUser);
});
user.get('/:userId', async (req, res) => {
    console.log('getUser');
    const myUser = await getUser(req.params.userId);
    if (myUser) {
        res.status(200).send(myUser);
        console.log('sending user');
    } else {
        res.status(200).send('User not found');
    }
});
user.post('/:userId/games/:gameId', (req, res) => {
    addGame(req.params.userId, req.params.gameId);
});
user.delete('/:userId/games/:gameId', (req, res) => {
    removeGame(req.params.userId, req.params.gameId);
});
user.get('/:userId/games', getGames);
user.get('/:userId/rank', getRank);
user.put('/:userId/rank', (req, res) => {
    setRank(req.params.userId, req.body.rank);
});

export default user;

// router for the user
// Path: src\routes\user\index.ts

import { Router, Request, Response, NextFunction } from 'express';
// import functions from the controller
import {
    createUser,
    getUser,
    addGame,
    removeGame,
    archiveGame,
    unarchiveGame,
    setRank,
} from '../../controllers/userController';
import { requireAuth } from '../../middleware/auth';

const user = Router();

// start urls with "user/"

// every route below operates on :userId's own data - require the caller to
// be authenticated as that exact user; no legitimate cross-user access
// exists in the current UI (a user only ever reads/writes their own profile)
function requireSelf(req: Request, res: Response, next: NextFunction) {
    if (req.uid !== req.params.userId) {
        res.status(403).send('You may only access your own user data.');
        return;
    }
    next();
}

user.use('/:userId', requireAuth, requireSelf);

// create a user
user.post('/:userId', async (req, res) => {
    console.info('createUser');
    const myUser = await createUser(req.params.userId);
    if (myUser) {
        res.status(200).send(myUser);
        console.info('sending created user');
    } else {
        res.status(404).send('User could not be created');
    }
});
user.get('/:userId', async (req, res) => {
    console.info('getUser');
    const myUser = await getUser(req.params.userId);
    if (myUser) {
        res.status(200).send(myUser);
        console.info('sending got user');
    } else {
        res.status(404).send('User not found');
    }
});
user.post('/:userId/games/:gameId', async (req, res) => {
    const myUser = await addGame(req.params.userId, req.params.gameId);
    if (myUser) {
        res.status(200).send(myUser);
        console.info('sending user');
    } else {
        res.status(404).send('User not found');
    }
});
user.delete('/:userId/games/:gameId', async (req, res) => {
    const myUser = await removeGame(req.params.userId, req.params.gameId);
    if (myUser) {
        res.status(200).send(myUser);
    } else {
        res.status(404).send('User not found');
    }
});
user.post('/:userId/games/:gameId/archive', async (req, res) => {
    const myUser = await archiveGame(req.params.userId, req.params.gameId);
    if (myUser) {
        res.status(200).send(myUser);
    } else {
        res.status(404).send('User not found');
    }
});
user.delete('/:userId/games/:gameId/archive', async (req, res) => {
    const myUser = await unarchiveGame(req.params.userId, req.params.gameId);
    if (myUser) {
        res.status(200).send(myUser);
    } else {
        res.status(404).send('User not found');
    }
});
user.get('/:userId/games', async (req, res) => {
    const myUser = await getUser(req.params.userId);
    if (myUser) {
        res.status(200).send(myUser.games);
    } else {
        res.status(404).send('User not found');
    }
});
user.get('/:userId/rank', async (req, res) => {
    const myUser = await getUser(req.params.userId);
    if (myUser) {
        res.status(200).send({ rank: myUser.rank });
    } else {
        res.status(404).send('User not found');
    }
});
user.put('/:userId/rank', async (req, res) => {
    const myUser = await setRank(req.params.userId, req.body.rank);
    if (myUser) {
        res.status(200).send(myUser);
    } else {
        res.status(404).send('User not found');
    }
});

export default user;

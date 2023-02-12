// router for the game
// Path: src\routes\game\index.ts

import { Router } from 'express';
// import functions from the controller
import { getGameById } from '../../controllers/gameController';

const game = Router();

// start urls with "game/"

game.get('/:gameId', async (req, res) => {
    console.log('getGame');
    const myGame = await getGameById(req.params.gameId);
    if (myGame) {
        res.status(200).send(myGame);
        console.log('sending game');
    } else {
        res.status(200).send('Game not found');
    }
});

export default game;

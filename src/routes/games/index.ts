// router for the game
// Path: src\routes\games\index.ts

import { Router } from 'express';
// import functions from the controller
import {
    getGameById,
    sanitizeGameForClient,
} from '../../controllers/gameController';
import { emplaceBoardFog } from '../../utils';
import { requireAuth, optionalAuth } from '../../middleware/auth';
import { Piece as FoggablePiece } from '../../types';

const games = Router();

// start urls with "games/"

games.get('/:gameId', optionalAuth, async (req, res) => {
    const myGame = await getGameById(req.params.gameId);
    if (!myGame) {
        res.status(404).send('Game not found');
        return;
    }

    // this endpoint's one current legitimate use (UserModal's game history)
    // never reads board/deadPieces/moves - a caller with no verified
    // identity, or whose identity doesn't match a participant in this game,
    // gets those fields stripped entirely rather than guessed-fogged; a
    // verified participant gets their own fogged view, same as they'd see
    // in-game
    const playerIndex = req.uid
        ? myGame.players.findIndex(
              (name) => myGame.playerToUidMap.get(name) === req.uid,
          )
        : -1;

    if (playerIndex === -1) {
        const {
            board: _board,
            deadPieces: _deadPieces,
            moves: _moves,
            ...rest
        } = sanitizeGameForClient(myGame);
        res.status(200).send(rest);
        return;
    }

    const view = myGame.config.fogOfWar
        ? emplaceBoardFog(
              myGame as unknown as {
                  board: FoggablePiece[][];
                  deadPieces: FoggablePiece[];
              },
              playerIndex,
          )
        : myGame;
    res.status(200).send(sanitizeGameForClient(view));
});

// links the calling player's own verified uid to their seat in a game
games.post('/:gameId/:playerName', requireAuth, async (req, res) => {
    const { gameId, playerName } = req.params;
    const myGame = await getGameById(gameId);
    if (myGame) {
        myGame.playerToUidMap.set(playerName, req.uid as string);
        myGame.save();
        res.status(200).send(sanitizeGameForClient(myGame));
    } else {
        res.status(404).send('Game not found');
    }
});

export default games;

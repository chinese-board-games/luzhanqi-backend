// Sentinel identity for the AI opponent's virtual "seat" in a game.
// It occupies players[1] like a real guest, but has no real socket connection.
export const AI_PLAYER_NAME = 'Computer';
export const AI_SOCKET_SENTINEL = '__ai__';

/**
 * Tunable weights for the AI opponent's heuristic move scorer
 * (src/utils/aiPlayer.ts). Set per-game via config.aiSettings.
 */
export type AiWeights = {
    /** how much random noise is added to each candidate move's score -
     * higher makes the AI's play less predictable */
    randomness: number;
    /** how strongly the AI favors advancing an empty-tile move toward your
     * HQ over holding position */
    positionalDrive: number;
    /** how strongly the AI avoids moving a valuable piece onto a square a
     * visible (if unidentified) enemy piece could reach next turn */
    caution: number;
    /** how much extra value the AI places on capturing pieces (both known
     * and still-hidden targets) */
    aggression: number;
};

export const DEFAULT_AI_WEIGHTS: AiWeights = {
    randomness: 1.5,
    positionalDrive: 0.15,
    caution: 0.5,
    aggression: 1,
};

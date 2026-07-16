import { Request, Response, NextFunction } from 'express';
import { verifyIdToken } from '../utils/firebaseAdmin';

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            uid?: string | null;
        }
    }
}

function extractToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return null;
    }
    return header.slice('Bearer '.length);
}

/**
 * Requires a valid Firebase ID token in the Authorization header, and sets
 * req.uid to the verified uid. Responds 401 if the token is missing or
 * invalid, rather than falling back to anonymous - these routes have no
 * legitimate anonymous caller.
 * @see requireAuth
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    try {
        const uid = await verifyIdToken(extractToken(req));
        if (!uid) {
            res.status(401).send('Authentication required.');
            return;
        }
        req.uid = uid;
        next();
    } catch (err) {
        console.error('Token verification failed:', err);
        res.status(401).send('Invalid or expired authentication token.');
    }
}

/**
 * Verifies a Firebase ID token if one is present, but never blocks the
 * request - sets req.uid to the verified uid, or null if no/an invalid
 * token was given. For routes with a legitimate anonymous caller, where the
 * handler itself decides how much to reveal based on whether req.uid is set.
 * @see optionalAuth
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
    try {
        req.uid = await verifyIdToken(extractToken(req));
    } catch (err) {
        console.error('Token verification failed (optional):', err);
        req.uid = null;
    }
    next();
}

import type { App } from 'firebase-admin/app';

// both the App initialization AND the require() calls below are deferred
// until first actual use (not just top-level `import`): firebase-admin/auth
// pulls in a transitively-ESM-only dependency (jose, via jwks-rsa) that
// Jest's CommonJS transform can't parse - a static top-level import would
// load that code (and therefore break) the moment any test imports
// anything that transitively imports this module (e.g. gameplayService.ts
// via utils/index.ts), even if verifyIdToken is never called. A deferred
// require() only executes when this function actually runs, which no
// existing test does. This also sidesteps the dotenv.config() ordering
// issue noted below for the same reason.
function getAdminApp(): App {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { initializeApp, cert, getApps } = require('firebase-admin/app');
    const [existing] = getApps();
    if (existing) {
        return existing;
    }
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } =
        process.env;
    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
        throw new Error(
            'Firebase Admin credentials are not configured (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY)',
        );
    }
    return initializeApp({
        credential: cert({
            projectId: FIREBASE_PROJECT_ID,
            clientEmail: FIREBASE_CLIENT_EMAIL,
            // .env can't hold literal newlines, so the key is stored with
            // escaped \n sequences that need to be restored here
            privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
}

/**
 * Verifies a Firebase ID token and returns the uid it belongs to, or null if
 * no token was given (anonymous play is allowed throughout this app). Throws
 * if a token WAS given but failed verification (expired, malformed, wrong
 * project) - callers should treat that as an error, not silently fall back
 * to anonymous, since a present-but-invalid token means either a stale
 * client or a spoofing attempt.
 * @see verifyIdToken
 */
export async function verifyIdToken(
    idToken?: string | null,
): Promise<string | null> {
    if (!idToken) {
        return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getAuth } = require('firebase-admin/auth');
    const decoded = await getAuth(getAdminApp()).verifyIdToken(idToken);
    return decoded.uid;
}

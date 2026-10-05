const admin = require('firebase-admin');
const AppError = require('../utils/AppError');

/**
 * Firebase Admin is only used to verify the ID tokens that Google sign-in and
 * phone OTP (both handled by Firebase on the client) send to us.
 *
 * Verifying tokens needs just FIREBASE_PROJECT_ID. A service account
 * (FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY, newlines escaped as \n) is optional.
 */
const getFirebaseAuth = () => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new AppError('Google and phone sign-in aren’t set up on the server yet.', 503);
  }

  if (!admin.apps.length) {
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    admin.initializeApp(
      clientEmail && privateKey
        ? { credential: admin.credential.cert({ projectId, clientEmail, privateKey }) }
        : { projectId }
    );
  }
  return admin.auth();
};

/** Returns the decoded token, or throws a 401 AppError if it's invalid or expired. */
exports.verifyFirebaseIdToken = async (idToken) => {
  if (!idToken) throw new AppError('Missing sign-in token.', 400);
  const auth = getFirebaseAuth();
  try {
    return await auth.verifyIdToken(idToken);
  } catch {
    throw new AppError('That sign-in didn’t work or has expired. Please try again.', 401);
  }
};

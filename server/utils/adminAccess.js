/**
 * Who may use the admin panel. Decided on the server only, never from anything the browser sends.
 *
 * server/.env:
 *   FOUNDER_EMAILS=founder@gmail.com
 *   COFOUNDER_EMAILS=cofounder@gmail.com,other@gmail.com
 *
 * The founder can also grant access to other accounts from the panel (stored as user.adminRole).
 * The email must be verified (Google sign-in or the emailed sign-up code), so nobody can claim
 * an admin's address by typing it.
 */
const list = (name) =>
  String(process.env[name] || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/** 'founder' | 'cofounder' | null */
const adminRoleOf = (user) => {
  if (!user || user.isDeleted || user.isSuspended) return null;
  const email = user.email?.toLowerCase();
  if (email && user.emailVerified) {
    if (list('FOUNDER_EMAILS').includes(email)) return 'founder';
    if (list('COFOUNDER_EMAILS').includes(email)) return 'cofounder';
  }
  return user.adminRole || null;
};

/** Admins listed in server/.env can't be suspended or demoted from the panel */
const isConfiguredAdmin = (user) => {
  const email = user?.email?.toLowerCase();
  return Boolean(email && (list('FOUNDER_EMAILS').includes(email) || list('COFOUNDER_EMAILS').includes(email)));
};

module.exports = { adminRoleOf, isConfiguredAdmin };

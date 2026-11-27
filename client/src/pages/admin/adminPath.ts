/**
 * Where the admin panel lives: /admin, linked from a small "Admin" link in the front page footer.
 * VITE_ADMIN_PATH can move it elsewhere if ever needed.
 *
 * Anyone can open the sign-in page, but only the founder and co-founder get in: every admin
 * API checks on the server that the signed-in account is one of them.
 */
const configured = (import.meta.env.VITE_ADMIN_PATH as string | undefined)?.trim().replace(/\/+$/, '');

export const ADMIN_ENABLED = true;
export const ADMIN = configured ? (configured.startsWith('/') ? configured : `/${configured}`) : '/admin';

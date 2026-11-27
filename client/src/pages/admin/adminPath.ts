/**
 * Where the admin panel lives. Set VITE_ADMIN_PATH (e.g. /team-k3x9q2) in client/.env and in Vercel,
 * so the panel isn't at a guessable address. Without it, the panel is only at /admin in local
 * development and is switched off in production builds.
 *
 * Hiding the address is only the outer layer: every admin API still checks on the server
 * that the signed-in account is the founder or co-founder.
 */
const configured = (import.meta.env.VITE_ADMIN_PATH as string | undefined)?.trim().replace(/\/+$/, '');

export const ADMIN_ENABLED = Boolean(configured) || import.meta.env.DEV;
export const ADMIN = configured ? (configured.startsWith('/') ? configured : `/${configured}`) : '/admin';

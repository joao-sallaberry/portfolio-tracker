/**
 * Whether the page was opened from a password reset email link. Must be evaluated before the
 * Supabase client is created (imported first in main.tsx): the client reads the tokens from the
 * URL and clears it, and it can emit PASSWORD_RECOVERY before the app subscribes to auth events.
 * The link carries `type=recovery` in the hash and may land on the Site URL instead of
 * /redefinir-senha when that redirect isn't allow-listed in Supabase.
 */
export const openedFromRecoveryLink = /(^#|&)type=recovery(&|$)/.test(window.location.hash);

// lib/config.ts — Centralized application configuration

/**
 * Returns the application URL, failing loudly in production if not set.
 * Prevents OAuth redirects and links from falling back to localhost.
 */
export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'NEXT_PUBLIC_APP_URL environment variable must be set in production'
      );
    }
    return 'http://localhost:3000';
  }
  return url.replace(/\/+$/, '');
}

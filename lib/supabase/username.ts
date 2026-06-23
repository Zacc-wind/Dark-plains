const AUTH_EMAIL_DOMAIN = 'darkplains.game';

export function usernameToAuthEmail(username: string): string {
  const normalized = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  return `${normalized}@${AUTH_EMAIL_DOMAIN}`;
}

export function isValidGameUsername(username: string): boolean {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username.trim());
}

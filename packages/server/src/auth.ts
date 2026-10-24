import { randomBytes, timingSafeEqual } from 'node:crypto';

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

/** Single shared admin password. No accounts: a correct password gets a session token. */
export class AdminAuth {
  private sessions = new Map<string, number>();
  private draftTokens = new Set<string>();

  constructor(private password: string) {}

  login(attempt: string): string | null {
    const a = Buffer.from(attempt);
    const b = Buffer.from(this.password);
    if (!this.password || a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const token = randomBytes(24).toString('hex');
    this.sessions.set(token, Date.now() + SESSION_MS);
    return token;
  }

  /** Checks an `Authorization: Bearer <token>` header. */
  isAdmin(header: string | undefined): boolean {
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const expires = token ? this.sessions.get(token) : undefined;
    if (!token || !expires) return false;
    if (expires < Date.now()) {
      this.sessions.delete(token);
      return false;
    }
    return true;
  }

  /** A one-off token that lets a new match use the unpublished draft config. */
  issueDraftToken(): string {
    const token = randomBytes(16).toString('hex');
    this.draftTokens.add(token);
    return token;
  }

  isDraftToken(token: string | undefined): boolean {
    return !!token && this.draftTokens.has(token);
  }
}

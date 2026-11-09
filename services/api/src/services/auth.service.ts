import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[FATAL] JWT_SECRET must be configured in production environment.');
    }
    return 'my-recipes-jwt-secret-commercial-saas-dev-only-2026';
  }
  return secret;
}

export interface GoogleUserInfo {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

export interface UserSession {
  userId: string;
  email: string;
  name?: string;
  isPro: boolean;
  proTier: string;
}

export class AuthService {
  /**
   * Verify Google ID token against Google's public tokeninfo endpoint
   */
  public static async verifyGoogleToken(idToken: string): Promise<GoogleUserInfo | null> {
    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!response.ok) {
        return null;
      }
      const data = (await response.json()) as Record<string, any>;
      if (!data.sub || !data.email) {
        return null;
      }

      // Fail-closed audience verification
      const expectedClientId = process.env.GOOGLE_CLIENT_ID;
      if (!expectedClientId) {
        if (process.env.NODE_ENV === 'production') {
          console.error('[AUTH] GOOGLE_CLIENT_ID must be configured in production environment.');
          return null;
        }
      } else if (data.aud !== expectedClientId && data.azp !== expectedClientId) {
        console.warn(`[AUTH] Audience mismatch. Expected ${expectedClientId}, received ${data.aud}`);
        return null;
      }

      return {
        sub: data.sub,
        email: data.email,
        name: data.name,
        picture: data.picture,
      };
    } catch (err) {
      console.error('[AUTH] Failed to verify Google ID token:', err);
      return null;
    }
  }

  /**
   * Get or create user in Neon DB from Google profile
   */
  public static async authenticateWithGoogle(googleUser: GoogleUserInfo): Promise<{ user: UserSession; token: string }> {
    const db = getDb();
    const userId = `usr_${googleUser.sub}`;

    let isPro = false;
    let proTier = 'free';

    if (db) {
      try {
        const existingUsers = await db.select().from(schema.users).where(eq(schema.users.googleId, googleUser.sub)).limit(1);
        if (existingUsers.length > 0) {
          const u = existingUsers[0];
          isPro = u.isPro;
          proTier = u.proTier;
          await db.update(schema.users).set({
            name: googleUser.name || u.name,
            avatarUrl: googleUser.picture || u.avatarUrl,
            updatedAt: new Date(),
          }).where(eq(schema.users.id, u.id));
        } else {
          await db.insert(schema.users).values({
            id: userId,
            googleId: googleUser.sub,
            email: googleUser.email,
            name: googleUser.name || 'משתמש חדש',
            avatarUrl: googleUser.picture,
            isPro: false,
            proTier: 'free',
          });
        }
      } catch (err) {
        console.error('[AUTH] Error syncing user with Neon DB:', err);
      }
    }

    const session: UserSession = {
      userId,
      email: googleUser.email,
      name: googleUser.name,
      isPro,
      proTier,
    };

    const token = jwt.sign(session, getJwtSecret(), { expiresIn: '30d' });

    return { user: session, token };
  }

  /**
   * Verify and extract session from Bearer token
   */
  public static verifySessionToken(token: string): UserSession | null {
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as UserSession;
      return decoded;
    } catch {
      return null;
    }
  }
}

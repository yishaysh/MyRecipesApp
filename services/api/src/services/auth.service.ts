import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { SyncService } from './sync.service.js';

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

    // Check VIP Whitelist from environment variable
    const vipEmails = (process.env.VIP_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const isVipEmail = Boolean(googleUser.email && vipEmails.includes(googleUser.email.trim().toLowerCase()));

    let isPro = isVipEmail;
    let proTier = isVipEmail ? 'family_vip' : 'free';

    if (db) {
      try {
        const existingUsers = await db.select().from(schema.users).where(eq(schema.users.googleId, googleUser.sub)).limit(1);
        if (existingUsers.length > 0) {
          const u = existingUsers[0];
          isPro = isVipEmail || u.isPro;
          proTier = isVipEmail ? 'family_vip' : u.proTier;
          await db.update(schema.users).set({
            name: googleUser.name || u.name,
            avatarUrl: googleUser.picture || u.avatarUrl,
            isPro,
            proTier,
            updatedAt: new Date(),
          }).where(eq(schema.users.id, u.id));
        } else {
          await db.insert(schema.users).values({
            id: userId,
            googleId: googleUser.sub,
            email: googleUser.email,
            name: googleUser.name || 'משתמש חדש',
            avatarUrl: googleUser.picture,
            isPro: isVipEmail,
            proTier: isVipEmail ? 'family_vip' : 'free',
          });
        }
      } catch (err) {
        console.error('[AUTH] Error syncing user with Neon DB:', err);
      }
    }

    if (isPro) {
      SyncService.inMemoryProUsers.add(userId);
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
   * Issue an anonymous guest session for mobile users who haven't logged in with Google yet
   */
  public static async createGuestSession(): Promise<{ user: UserSession; token: string }> {
    const guestId = `usr_guest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const session: UserSession = {
      userId: guestId,
      email: `${guestId}@guest.myrecipes.app`,
      name: 'אורח',
      isPro: false,
      proTier: 'free',
    };
    const token = jwt.sign(session, getJwtSecret(), { expiresIn: '30d' });
    return { user: session, token };
  }

  /**
   * Redeem a secret promo / VIP code to upgrade user to Chef Pro
   */
  public static async redeemPromoCode(
    session: UserSession,
    code: string
  ): Promise<{ success: boolean; message: string; user?: UserSession; token?: string }> {
    if (!code || typeof code !== 'string') {
      return { success: false, message: 'נא להזין קוד הטבה תקף' };
    }

    const normalizedCode = code.trim().toUpperCase();
    const validCodes = (process.env.PROMO_CODES || 'FAMILY2026,CHEFVIP,MYRECIPESVIP')
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    if (!validCodes.includes(normalizedCode)) {
      return { success: false, message: 'קוד ההטבה שהוזן שגוי או שפג תוקפו' };
    }

    const db = getDb();
    let userEmail = session.email;
    let userName = session.name || 'VIP שף';

    if (db) {
      try {
        const userRows = await db.select().from(schema.users).where(eq(schema.users.id, session.userId)).limit(1);
        if (userRows.length > 0) {
          userEmail = userRows[0].email;
          userName = userRows[0].name || session.name || 'VIP שף';
          await db.update(schema.users).set({
            isPro: true,
            proTier: 'promo_vip',
            updatedAt: new Date(),
          }).where(eq(schema.users.id, session.userId));
        } else {
          // If guest or new session not yet in DB, insert record
          await db.insert(schema.users).values({
            id: session.userId,
            googleId: `guest_${session.userId}`,
            email: userEmail,
            name: userName,
            isPro: true,
            proTier: 'promo_vip',
          }).onConflictDoNothing();
        }
      } catch (err) {
        console.error('[AUTH] Error updating user promo status in Neon DB:', err);
      }
    }

    SyncService.inMemoryProUsers.add(session.userId);

    const updatedSession: UserSession = {
      userId: session.userId,
      email: userEmail,
      name: userName,
      isPro: true,
      proTier: 'promo_vip',
    };

    const newToken = jwt.sign(updatedSession, getJwtSecret(), { expiresIn: '30d' });

    return {
      success: true,
      message: 'קוד ההטבה הופעל בהצלחה! שודרגת ל-Chef Pro ללא הגבלה 🌟',
      user: updatedSession,
      token: newToken,
    };
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

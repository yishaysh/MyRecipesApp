import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { SyncService } from './sync.service.js';
import { AdminService } from './admin.service.js';
import { EntitlementService, isEntitlementProActive, UserEntitlement } from './entitlement.service.js';
import { getJwtSecret } from './guest-cookie.util.js';

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

      // Fail-closed audience & authorized party verification (supports both Web and Android clients)
      const defaultWebClientId = '1096327742778-q792b51k802ocfbs4f9pcn28bigb63ol.apps.googleusercontent.com';
      const defaultAndroidClientId = '1096327742778-acoah2folli95a8n4e7phbv8enhbjqs6.apps.googleusercontent.com';

      const validClientIds = [
        process.env.GOOGLE_CLIENT_ID || defaultWebClientId,
        process.env.GOOGLE_ANDROID_CLIENT_ID || defaultAndroidClientId,
      ].filter(Boolean) as string[];

      const matchesAud = validClientIds.includes(data.aud);
      if (!matchesAud) {
        console.warn(`[AUTH] Audience mismatch. Expected one of [${validClientIds.join(', ')}], received aud: ${data.aud}`);
        return null;
      }
      if (data.azp && !validClientIds.includes(data.azp)) {
        console.warn(`[AUTH] Authorized party mismatch. Expected one of [${validClientIds.join(', ')}], received azp: ${data.azp}`);
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
  public static async authenticateWithGoogle(
    googleUser: GoogleUserInfo,
    guestUserIdToMerge?: string,
  ): Promise<{ user: UserSession; token: string; entitlement?: UserEntitlement }> {
    const db = getDb();
    let actualUserId = `usr_${googleUser.sub}`;

    // Check VIP Whitelist from AdminService (DB + process.env.VIP_EMAILS)
    const isVipEmail = await AdminService.isEmailVip(googleUser.email);

    let isPro = isVipEmail;
    let proTier = isVipEmail ? 'family_vip' : 'free';

    if (db) {
      try {
        const existingUsers = await db.select().from(schema.users).where(eq(schema.users.googleId, googleUser.sub)).limit(1);
        if (existingUsers.length > 0) {
          const u = existingUsers[0];
          actualUserId = u.id;
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
            id: actualUserId,
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

    let entitlement: UserEntitlement;
    if (isVipEmail) {
      entitlement = await EntitlementService.grantVipEntitlement(actualUserId, 'vip_email');
    } else if (guestUserIdToMerge && guestUserIdToMerge !== actualUserId) {
      entitlement = await EntitlementService.mergeGuestEntitlementToUser(guestUserIdToMerge, actualUserId);
    } else {
      entitlement = await EntitlementService.getEntitlement(actualUserId);
    }

    if (isEntitlementProActive(entitlement)) {
      isPro = true;
      proTier = entitlement.plan === 'pro_vip'
        ? (isVipEmail ? 'family_vip' : 'promo_vip')
        : entitlement.plan;
      SyncService.inMemoryProUsers.add(actualUserId);
    }

    const session: UserSession = {
      userId: actualUserId,
      email: googleUser.email,
      name: googleUser.name,
      isPro,
      proTier,
    };

    const token = jwt.sign(session, getJwtSecret(), { expiresIn: '30d' });

    return { user: session, token, entitlement };
  }

  /**
   * Issue or resume an anonymous guest session bound to the browser's signed guest cookie
   */
  public static async createGuestSession(existingGuestId?: string): Promise<{ user: UserSession; token: string; entitlement: UserEntitlement }> {
    const validExisting = typeof existingGuestId === 'string' && /^usr_guest_[a-zA-Z0-9_-]{4,80}$/.test(existingGuestId.trim());
    const guestId = validExisting
      ? existingGuestId!.trim()
      : `usr_guest_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    await EntitlementService.ensureUserExists(guestId, `${guestId}@guest.myrecipes.app`, 'אורח');
    const entitlement = await EntitlementService.getEntitlement(guestId);
    const isPro = isEntitlementProActive(entitlement);
    const proTier = isPro ? (entitlement.plan === 'pro_vip' ? 'promo_vip' : entitlement.plan) : 'free';

    const session: UserSession = {
      userId: guestId,
      email: `${guestId}@guest.myrecipes.app`,
      name: 'אורח',
      isPro,
      proTier,
    };
    const token = jwt.sign(session, getJwtSecret(), { expiresIn: '30d' });
    return { user: session, token, entitlement };
  }

  /**
   * Redeem a secret promo / VIP code to upgrade user to Chef Pro
   */
  public static async redeemPromoCode(
    session: UserSession,
    code: string
  ): Promise<{ success: boolean; message: string; user?: UserSession; token?: string; entitlement?: UserEntitlement }> {
    if (!code || typeof code !== 'string') {
      return { success: false, message: 'נא להזין קוד הטבה תקף' };
    }

    const normalizedCode = code.trim().toUpperCase();
    const promoCheck = await AdminService.isPromoCodeValid(normalizedCode);

    if (!promoCheck.valid) {
      return { success: false, message: 'קוד ההטבה שהוזן שגוי, אינו פעיל או שפג תוקפו' };
    }

    // Record usage count in database
    await AdminService.recordPromoCodeUse(normalizedCode);

    const proTier = promoCheck.discountType === 'lifetime_pro' ? 'promo_vip' : promoCheck.discountType;

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
            proTier,
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
            proTier,
          }).onConflictDoNothing();
        }
      } catch (err) {
        console.error('[AUTH] Error updating user promo status in Neon DB:', err);
      }
    }

    await EntitlementService.ensureUserExists(session.userId, userEmail, userName);
    const entitlement = await EntitlementService.grantVipEntitlement(session.userId, 'promo_code');
    SyncService.inMemoryProUsers.add(session.userId);

    const updatedSession: UserSession = {
      userId: session.userId,
      email: userEmail,
      name: userName,
      isPro: true,
      proTier,
    };

    const newToken = jwt.sign(updatedSession, getJwtSecret(), { expiresIn: '30d' });

    return {
      success: true,
      message: 'שודרגת ל-Chef Pro! 👨‍🍳',
      user: updatedSession,
      token: newToken,
      entitlement,
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

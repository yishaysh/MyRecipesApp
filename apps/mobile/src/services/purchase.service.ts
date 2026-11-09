import { Platform } from 'react-native';
import Purchases, { PurchasesPackage, CustomerInfo, LOG_LEVEL } from 'react-native-purchases';
import { useAuthStore } from '../store/authStore';

// Public API Keys for RevenueCat (Configured in EXPO_PUBLIC_* or fallback to demo)
const REVENUECAT_GOOGLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY || 'goog_sample_key_myrecipes';
const REVENUECAT_APPLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY || 'appl_sample_key_myrecipes';
const PRO_ENTITLEMENT_ID = 'pro_access';

export class PurchaseService {
  private static isConfigured = false;

  /**
   * Initialize RevenueCat SDK
   */
  public static async init(userId?: string): Promise<void> {
    if (this.isConfigured || Platform.OS === 'web') return;

    try {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);

      const apiKey = Platform.OS === 'ios' ? REVENUECAT_APPLE_KEY : REVENUECAT_GOOGLE_KEY;

      if (!apiKey || apiKey.includes('sample_key')) {
        console.log('[PURCHASES] RevenueCat running in Demo/Simulation mode.');
        this.isConfigured = true;
        return;
      }

      await Purchases.configure({
        apiKey,
        appUserID: userId || null,
      });

      this.isConfigured = true;

      // Listen for real-time customer subscription updates
      Purchases.addCustomerInfoUpdateListener((info: CustomerInfo) => {
        this.updateUserProStatusFromInfo(info);
      });

      console.log('[PURCHASES] RevenueCat initialized successfully.');
    } catch (err) {
      console.warn('[PURCHASES] Failed to initialize RevenueCat:', err);
    }
  }

  /**
   * Identify user when they sign in with Google
   */
  public static async identify(userId: string): Promise<void> {
    if (!this.isConfigured || Platform.OS === 'web') return;
    try {
      const { customerInfo } = await Purchases.logIn(userId);
      this.updateUserProStatusFromInfo(customerInfo);
    } catch (err) {
      console.warn('[PURCHASES] Error identifying user in RevenueCat:', err);
    }
  }

  /**
   * Log out user from RevenueCat when logging out
   */
  public static async reset(): Promise<void> {
    if (!this.isConfigured || Platform.OS === 'web') return;
    try {
      await Purchases.logOut();
    } catch (err) {
      console.warn('[PURCHASES] Error logging out of RevenueCat:', err);
    }
  }

  /**
   * Fetch current subscription packages from RevenueCat Offerings
   */
  public static async getPackages(): Promise<{ monthly: PurchasesPackage | null; yearly: PurchasesPackage | null }> {
    if (!this.isConfigured || Platform.OS === 'web') {
      return { monthly: null, yearly: null };
    }

    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current && offerings.current.availablePackages.length > 0) {
        const monthly = offerings.current.monthly || offerings.current.availablePackages.find(p => p.packageType === 'MONTHLY') || null;
        const yearly = offerings.current.annual || offerings.current.availablePackages.find(p => p.packageType === 'ANNUAL') || null;
        return { monthly, yearly };
      }
    } catch (err) {
      console.warn('[PURCHASES] Could not fetch offerings:', err);
    }
    return { monthly: null, yearly: null };
  }

  /**
   * Purchase a package with Google Play / Apple StoreKit
   */
  public static async purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return this.updateUserProStatusFromInfo(customerInfo);
    } catch (err: any) {
      if (err.userCancelled) {
        console.log('[PURCHASES] User cancelled purchase.');
        return false;
      }
      throw err;
    }
  }

  /**
   * Restore previous purchases
   */
  public static async restorePurchases(): Promise<boolean> {
    if (!this.isConfigured || Platform.OS === 'web') return false;
    try {
      const customerInfo = await Purchases.restorePurchases();
      return this.updateUserProStatusFromInfo(customerInfo);
    } catch (err) {
      console.warn('[PURCHASES] Failed to restore purchases:', err);
      return false;
    }
  }

  /**
   * Helper to check entitlement and update auth store
   */
  private static updateUserProStatusFromInfo(info: CustomerInfo): boolean {
    const isPro = typeof info.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';
    const currentUser = useAuthStore.getState().user;

    if (isPro) {
      useAuthStore.setState({
        user: {
          id: currentUser?.id || 'usr_pro',
          email: currentUser?.email || 'chef@myrecipes.app',
          name: currentUser?.name || 'Chef Pro',
          isPro: true,
          proTier: 'chef_pro',
        },
        usage: {
          allowed: true,
          remaining: 9999,
          totalLimit: 9999,
          used: 0,
          isPro: true,
          period: 'unlimited',
        },
      });
      return true;
    }

    return false;
  }
}

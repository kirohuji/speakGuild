import {
  LOG_LEVEL,
  PACKAGE_TYPE,
  Purchases,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesOfferings,
  type PurchasesPackage,
} from '@revenuecat/purchases-capacitor';
import {
  PAYWALL_RESULT,
  PaywallPresentationConfiguration,
  RevenueCatUI,
  type PaywallResult,
} from '@revenuecat/purchases-capacitor-ui';
import { isNative } from './platform';

export const REVENUECAT_API_KEY = import.meta.env.VITE_REVENUECAT_API_KEY;

export const REVENUECAT_UNLIMITED_ENTITLEMENT_ID = 'pro_member';

export const REVENUECAT_PRODUCT_IDS = {
  yearly: 'lourd.manyuding.app.yearly',
  monthly: 'lourd.manyuding.app.monthly',
} as const;

export type RevenueCatProductKey = keyof typeof REVENUECAT_PRODUCT_IDS;

export interface RevenueCatState {
  configured: boolean;
  customerInfo: CustomerInfo | null;
  hasUnlimited: boolean;
  activeEntitlementId: string | null;
  managementURL: string | null;
}

export interface RevenueCatAPI {
  configure(appUserID?: string | null): Promise<CustomerInfo | null>;
  identify(appUserID: string): Promise<CustomerInfo | null>;
  reset(): Promise<CustomerInfo | null>;
  getCustomerInfo(): Promise<CustomerInfo | null>;
  refreshCustomerInfo(): Promise<CustomerInfo | null>;
  getOfferings(): Promise<PurchasesOfferings | null>;
  getCurrentOffering(): Promise<PurchasesOffering | null>;
  getPackage(product: RevenueCatProductKey): Promise<PurchasesPackage | null>;
  purchasePackage(product: RevenueCatProductKey): Promise<CustomerInfo | null>;
  restorePurchases(): Promise<CustomerInfo | null>;
  presentPaywall(): Promise<PaywallResult | null>;
  presentPaywallIfNeeded(): Promise<PaywallResult | null>;
  presentCustomerCenter(): Promise<void>;
  subscribe(callback: (state: RevenueCatState) => void): () => void;
  getState(): RevenueCatState;
}

const initialState: RevenueCatState = {
  configured: false,
  customerInfo: null,
  hasUnlimited: false,
  activeEntitlementId: null,
  managementURL: null,
};

let state: RevenueCatState = initialState;
let configurePromise: Promise<CustomerInfo | null> | null = null;
let listenerId: string | null = null;
const subscribers = new Set<(state: RevenueCatState) => void>();

function emit(next: RevenueCatState) {
  state = next;
  subscribers.forEach((callback) => callback(next));
}

function toState(customerInfo: CustomerInfo | null): RevenueCatState {
  const entitlement = customerInfo?.entitlements.active[REVENUECAT_UNLIMITED_ENTITLEMENT_ID] ?? null;
  return {
    configured: state.configured,
    customerInfo,
    hasUnlimited: !!entitlement?.isActive,
    activeEntitlementId: entitlement?.identifier ?? null,
    managementURL: customerInfo?.managementURL ?? null,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const maybe = error as { message?: string; readableErrorCode?: string; code?: string };
    return maybe.message || maybe.readableErrorCode || maybe.code || 'RevenueCat request failed';
  }
  return 'RevenueCat request failed';
}

function assertNative() {
  if (!isNative()) {
    throw new Error('RevenueCat purchases are available only in the native iOS/Android app.');
  }
}

async function ensureConfigured(appUserID?: string | null): Promise<CustomerInfo | null> {
  assertNative();

  if (!REVENUECAT_API_KEY) {
    throw new Error('Missing VITE_REVENUECAT_API_KEY.');
  }

  if (state.configured && !appUserID) {
    return state.customerInfo;
  }

  if (!configurePromise) {
    configurePromise = (async () => {
      await Purchases.setLogLevel({
        level: import.meta.env.DEV ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO,
      });

      await Purchases.configure({
        apiKey: REVENUECAT_API_KEY,
        appUserID: appUserID || undefined,
      });

      if (!listenerId) {
        listenerId = await Purchases.addCustomerInfoUpdateListener((customerInfo) => {
          emit({ ...toState(customerInfo), configured: true });
        });
      }

      const { customerInfo } = await Purchases.getCustomerInfo();
      emit({ ...toState(customerInfo), configured: true });
      return customerInfo;
    })().catch((error) => {
      configurePromise = null;
      console.warn('[RevenueCat] configure failed:', getErrorMessage(error), error);
      throw error;
    });
  }

  return configurePromise;
}

function findPackage(offering: PurchasesOffering, product: RevenueCatProductKey): PurchasesPackage | null {
  if (product === 'yearly' && offering.annual) return offering.annual;
  if (product === 'monthly' && offering.monthly) return offering.monthly;

  const productId = REVENUECAT_PRODUCT_IDS[product];
  const expectedPackageType =
    product === 'yearly'
        ? PACKAGE_TYPE.ANNUAL
        : PACKAGE_TYPE.MONTHLY;

  return offering.availablePackages.find((pkg) => {
    return (
      pkg.identifier === productId ||
      pkg.product.identifier === productId ||
      pkg.packageType === expectedPackageType
    );
  }) ?? null;
}

export const revenueCat: RevenueCatAPI = {
  async configure(appUserID) {
    if (!isNative()) return null;
    return ensureConfigured(appUserID);
  },

  async identify(appUserID) {
    if (!isNative()) return null;
    await ensureConfigured();
    const { customerInfo } = await Purchases.logIn({ appUserID });
    emit({ ...toState(customerInfo), configured: true });
    return customerInfo;
  },

  async reset() {
    if (!isNative() || !state.configured) return null;
    const { customerInfo } = await Purchases.logOut();
    emit({ ...toState(customerInfo), configured: true });
    return customerInfo;
  },

  async getCustomerInfo() {
    if (!isNative()) return null;
    await ensureConfigured();
    return state.customerInfo;
  },

  async refreshCustomerInfo() {
    if (!isNative()) return null;
    await ensureConfigured();
    const { customerInfo } = await Purchases.getCustomerInfo();
    emit({ ...toState(customerInfo), configured: true });
    return customerInfo;
  },

  async getOfferings() {
    if (!isNative()) return null;
    await ensureConfigured();
    return Purchases.getOfferings();
  },

  async getCurrentOffering() {
    const offerings = await this.getOfferings();
    return offerings?.current ?? null;
  },

  async getPackage(product) {
    const offering = await this.getCurrentOffering();
    if (!offering) return null;
    return findPackage(offering, product);
  },

  async purchasePackage(product) {
    if (!isNative()) return null;
    await ensureConfigured();
    const aPackage = await this.getPackage(product);
    if (!aPackage) {
      throw new Error(`RevenueCat package not found for product "${product}".`);
    }
    const { customerInfo } = await Purchases.purchasePackage({ aPackage });
    emit({ ...toState(customerInfo), configured: true });
    return customerInfo;
  },

  async restorePurchases() {
    if (!isNative()) return null;
    await ensureConfigured();
    const { customerInfo } = await Purchases.restorePurchases();
    emit({ ...toState(customerInfo), configured: true });
    return customerInfo;
  },

  async presentPaywall() {
    if (!isNative()) return null;
    await ensureConfigured();
    return RevenueCatUI.presentPaywall({
      presentationConfiguration: PaywallPresentationConfiguration.DEFAULT,
      displayCloseButton: true,
      listener: {
        onPurchaseCompleted: ({ customerInfo }) => {
          emit({ ...toState(customerInfo), configured: true });
        },
        onRestoreCompleted: ({ customerInfo }) => {
          emit({ ...toState(customerInfo), configured: true });
        },
        onPurchaseError: ({ error }) => {
          console.warn('[RevenueCat] purchase error:', getErrorMessage(error), error);
        },
        onRestoreError: ({ error }) => {
          console.warn('[RevenueCat] restore error:', getErrorMessage(error), error);
        },
      },
    });
  },

  async presentPaywallIfNeeded() {
    if (!isNative()) return null;
    await ensureConfigured();
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: REVENUECAT_UNLIMITED_ENTITLEMENT_ID,
      presentationConfiguration: PaywallPresentationConfiguration.DEFAULT,
      displayCloseButton: true,
      listener: {
        onPurchaseCompleted: ({ customerInfo }) => {
          emit({ ...toState(customerInfo), configured: true });
        },
        onRestoreCompleted: ({ customerInfo }) => {
          emit({ ...toState(customerInfo), configured: true });
        },
      },
    });

    if (result.result === PAYWALL_RESULT.PURCHASED || result.result === PAYWALL_RESULT.RESTORED) {
      await this.refreshCustomerInfo();
    }

    return result;
  },

  async presentCustomerCenter() {
    if (!isNative()) return;
    await ensureConfigured();
    await RevenueCatUI.presentCustomerCenter();
    await this.refreshCustomerInfo().catch(() => null);
  },

  subscribe(callback) {
    subscribers.add(callback);
    callback(state);
    return () => {
      subscribers.delete(callback);
    };
  },

  getState() {
    return state;
  },
};

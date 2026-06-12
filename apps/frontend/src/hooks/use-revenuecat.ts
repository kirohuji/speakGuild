import { useEffect, useMemo, useState } from 'react';
import { revenueCat, type RevenueCatState } from '@/lib/native/revenuecat';

export function useRevenueCat() {
  const [state, setState] = useState<RevenueCatState>(revenueCat.getState());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => revenueCat.subscribe(setState), []);

  return useMemo(() => ({
    ...state,
    isLoading,
    error,
    configure: async (appUserID?: string | null) => {
      setIsLoading(true);
      setError(null);
      try {
        return await revenueCat.configure(appUserID);
      } catch (err: any) {
        const message = err?.message || 'RevenueCat configure failed';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    refreshCustomerInfo: async () => {
      setIsLoading(true);
      setError(null);
      try {
        return await revenueCat.refreshCustomerInfo();
      } catch (err: any) {
        const message = err?.message || 'Unable to refresh subscription status';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    purchasePackage: async (product: 'lifetime' | 'yearly' | 'monthly') => {
      setIsLoading(true);
      setError(null);
      try {
        return await revenueCat.purchasePackage(product);
      } catch (err: any) {
        const message = err?.message || 'Purchase failed';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    restorePurchases: async () => {
      setIsLoading(true);
      setError(null);
      try {
        return await revenueCat.restorePurchases();
      } catch (err: any) {
        const message = err?.message || 'Restore failed';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    presentPaywall: async () => {
      setIsLoading(true);
      setError(null);
      try {
        return await revenueCat.presentPaywall();
      } catch (err: any) {
        const message = err?.message || 'Unable to show paywall';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    presentPaywallIfNeeded: async () => {
      setIsLoading(true);
      setError(null);
      try {
        return await revenueCat.presentPaywallIfNeeded();
      } catch (err: any) {
        const message = err?.message || 'Unable to show paywall';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    presentCustomerCenter: async () => {
      setIsLoading(true);
      setError(null);
      try {
        await revenueCat.presentCustomerCenter();
      } catch (err: any) {
        const message = err?.message || 'Unable to open subscription management';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
  }), [state, isLoading, error]);
}

import React from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useAuth } from '@/contexts/AuthContext';
import {
  useOfferings,
  useHasHuntAccess,
  usePurchasePackage,
  useRestorePurchases,
  useLoginRevenueCat,
  useLogoutRevenueCat,
} from '@/hooks/useRevenueCat';
import { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { useEffect, useRef, useMemo, useCallback } from 'react';

interface PaymentContextType {
  offering: PurchasesOffering | null;
  isOfferingLoading: boolean;
  hasHuntAccess: boolean;
  purchasePackage: (pkg: PurchasesPackage) => Promise<void>;
  isPurchasing: boolean;
  purchaseError: string | null;
  restorePurchases: () => Promise<void>;
  isRestoring: boolean;
}

const [PaymentProviderInternal, usePaymentInternal] = createContextHook((): PaymentContextType => {
  const { user } = useAuth();
  const prevUserIdRef = useRef<string | null>(null);

  const loginRC = useLoginRevenueCat();
  const logoutRC = useLogoutRevenueCat();

  useEffect(() => {
    const currentId = user?.id ?? null;
    if (currentId === prevUserIdRef.current) return;
    prevUserIdRef.current = currentId;

    if (currentId) {
      console.log('[Payment] User logged in, syncing with RevenueCat:', currentId);
      loginRC.mutate(currentId);
    } else {
      console.log('[Payment] User logged out, logging out of RevenueCat');
      logoutRC.mutate();
    }
  }, [user?.id, loginRC, logoutRC]);

  const { data: offering, isLoading: isOfferingLoading } = useOfferings();
  const hasHuntAccess = useHasHuntAccess();

  const purchaseMutation = usePurchasePackage();
  const restoreMutation = useRestorePurchases();

  const purchasePackage = useCallback(async (pkg: PurchasesPackage) => {
    await purchaseMutation.mutateAsync(pkg);
  }, [purchaseMutation]);

  const restorePurchases = useCallback(async () => {
    await restoreMutation.mutateAsync();
  }, [restoreMutation]);

  const purchaseError = purchaseMutation.error
    ? (purchaseMutation.error as Error).message
    : null;

  return useMemo(() => ({
    offering: offering ?? null,
    isOfferingLoading,
    hasHuntAccess,
    purchasePackage,
    isPurchasing: purchaseMutation.isPending,
    purchaseError,
    restorePurchases,
    isRestoring: restoreMutation.isPending,
  }), [offering, isOfferingLoading, hasHuntAccess, purchaseMutation.isPending, purchaseError, restoreMutation.isPending, purchasePackage, restorePurchases]);
});

export function usePayment(): PaymentContextType {
  const context = usePaymentInternal();
  if (!context) {
    return {
      offering: null,
      isOfferingLoading: false,
      hasHuntAccess: false,
      purchasePackage: async () => {},
      isPurchasing: false,
      purchaseError: null,
      restorePurchases: async () => {},
      isRestoring: false,
    };
  }
  return context;
}

export function PaymentWrapper({ children }: { children: React.ReactNode }) {
  return (
    <PaymentProviderInternal>
      {children}
    </PaymentProviderInternal>
  );
}

export const PaymentProvider = PaymentProviderInternal;

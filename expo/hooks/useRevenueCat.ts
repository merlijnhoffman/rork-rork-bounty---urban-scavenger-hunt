
import { Platform } from 'react-native';
import Purchases, { PurchasesOffering, PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TICKET } from '@/constants/payment';

function getRCApiKey(): string | undefined {
  if (__DEV__ || Platform.OS === 'web') {
    return process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
  }
  return Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
    default: process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY,
  });
}

let isRCConfigured = false;

export function configureRevenueCat() {
  if (isRCConfigured) {
    console.log('[RevenueCat] Already configured');
    return;
  }

  const apiKey = getRCApiKey();
  if (!apiKey) {
    console.warn('[RevenueCat] No API key found for platform:', Platform.OS);
    return;
  }

  try {
    Purchases.configure({ apiKey });
    isRCConfigured = true;
    console.log('[RevenueCat] Configured successfully for platform:', Platform.OS);
  } catch (error) {
    console.error('[RevenueCat] Configuration error:', error);
  }
}

export function useLoginRevenueCat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      if (!isRCConfigured) {
        console.warn('[RevenueCat] Not configured, skipping login');
        return null;
      }
      console.log('[RevenueCat] Logging in user:', userId);
      const { customerInfo } = await Purchases.logIn(userId);
      return customerInfo;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rc-customer-info'] });
      void queryClient.invalidateQueries({ queryKey: ['rc-offerings'] });
    },
  });
}

export function useLogoutRevenueCat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!isRCConfigured) return null;
      console.log('[RevenueCat] Logging out');
      const customerInfo = await Purchases.logOut();
      return customerInfo;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rc-customer-info'] });
    },
  });
}

export function useOfferings() {
  return useQuery({
    queryKey: ['rc-offerings'],
    queryFn: async (): Promise<PurchasesOffering | null> => {
      if (!isRCConfigured) {
        console.warn('[RevenueCat] Not configured, cannot fetch offerings');
        return null;
      }
      console.log('[RevenueCat] Fetching offerings...');
      const offerings = await Purchases.getOfferings();
      console.log('[RevenueCat] Offerings fetched:', JSON.stringify(Object.keys(offerings.all)));

      const huntOffering = offerings.all[TICKET.rcOfferingId] ?? offerings.current;
      if (!huntOffering) {
        console.warn('[RevenueCat] No hunt_ticket offering found');
        return null;
      }
      console.log('[RevenueCat] Hunt offering found with packages:', huntOffering.availablePackages.length);
      return huntOffering;
    },
    staleTime: 300000,
    retry: 2,
    enabled: isRCConfigured,
  });
}

export function useCustomerInfo() {
  return useQuery({
    queryKey: ['rc-customer-info'],
    queryFn: async (): Promise<CustomerInfo | null> => {
      if (!isRCConfigured) {
        return null;
      }
      const customerInfo = await Purchases.getCustomerInfo();
      console.log('[RevenueCat] Customer info fetched, entitlements:', JSON.stringify(Object.keys(customerInfo.entitlements.active)));
      return customerInfo;
    },
    staleTime: 30000,
    refetchInterval: 60000,
    enabled: isRCConfigured,
  });
}

export function useHasHuntAccess(): boolean {
  const { data: customerInfo } = useCustomerInfo();
  if (!customerInfo) return false;
  const hasAccess = !!customerInfo.entitlements.active[TICKET.rcEntitlementId];
  return hasAccess;
}

export function usePurchasePackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pkg: PurchasesPackage) => {
      if (!isRCConfigured) {
        throw new Error('RevenueCat is not configured');
      }
      console.log('[RevenueCat] Purchasing package:', pkg.identifier);
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      console.log('[RevenueCat] Purchase complete, entitlements:', JSON.stringify(Object.keys(customerInfo.entitlements.active)));
      return customerInfo;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rc-customer-info'] });
      void queryClient.invalidateQueries({ queryKey: ['ticket-status'] });
    },
  });
}

export function useRestorePurchases() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!isRCConfigured) {
        throw new Error('RevenueCat is not configured');
      }
      console.log('[RevenueCat] Restoring purchases...');
      const customerInfo = await Purchases.restorePurchases();
      console.log('[RevenueCat] Restore complete, entitlements:', JSON.stringify(Object.keys(customerInfo.entitlements.active)));
      return customerInfo;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rc-customer-info'] });
      void queryClient.invalidateQueries({ queryKey: ['ticket-status'] });
    },
  });
}

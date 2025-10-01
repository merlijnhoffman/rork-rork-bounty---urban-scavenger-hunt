import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_RORK_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  }

  // Fallback for development
  if (__DEV__) {
    console.warn('EXPO_PUBLIC_RORK_API_BASE_URL not set, using fallback');
    return 'http://localhost:3000';
  }

  throw new Error(
    "No base url found, please set EXPO_PUBLIC_RORK_API_BASE_URL"
  );
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      fetch: async (url, options) => {
        try {
          const response = await fetch(url, {
            ...options,
            headers: {
              'Content-Type': 'application/json',
              ...options?.headers,
            },
          });
          
          if (!response.ok) {
            console.error(`HTTP ${response.status}: ${response.statusText}`);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          return response;
        } catch (error) {
          console.error('tRPC fetch error:', error);
          if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error('Unable to connect to server. Please check your internet connection and try again.');
          }
          throw error;
        }
      },
    }),
  ],
});

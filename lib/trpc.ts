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
    console.warn('Make sure your backend server is running on http://localhost:3000');
    return 'http://localhost:3000';
  }

  throw new Error(
    "No base url found, please set EXPO_PUBLIC_RORK_API_BASE_URL"
  );
};

// Test backend connection on startup
const testBackendConnection = async () => {
  if (__DEV__) {
    try {
      const baseUrl = getBaseUrl();
      const response = await fetch(`${baseUrl}/`, { method: 'GET' });
      if (response.ok) {
        console.log('✅ Backend server is running at:', baseUrl);
      } else {
        console.warn('⚠️ Backend server responded with status:', response.status);
      }
    } catch (error) {
      console.warn('⚠️ Backend server is not running. Payment features will not work.');
      console.warn('To start the backend server, run: bun run dev:backend');
    }
  }
};

// Test connection on startup
if (__DEV__) {
  testBackendConnection();
}

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      fetch: async (url, options) => {
        try {
          console.log('Making tRPC request to:', url);
          
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
          
          if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            const baseUrl = getBaseUrl();
            console.error('Backend server connection failed. Expected server at:', baseUrl);
            console.error('Please ensure your backend server is running.');
            
            if (__DEV__) {
              throw new Error(`Unable to connect to backend server at ${baseUrl}. Please start your backend server and try again.`);
            } else {
              throw new Error('Unable to connect to server. Please check your internet connection and try again.');
            }
          }
          
          throw error;
        }
      },
    }),
  ],
});

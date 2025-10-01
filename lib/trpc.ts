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
          
          const baseUrl = getBaseUrl();
          
          // Handle different types of network errors
          if (error instanceof TypeError) {
            if (error.message.includes('Failed to fetch') || error.message.includes('Network request failed')) {
              console.error('❌ Backend server connection failed');
              console.error('Expected server at:', baseUrl);
              console.error('Please ensure your backend server is running.');
              
              if (__DEV__) {
                console.error('\n🔧 Troubleshooting steps:');
                console.error('1. Start backend: bun run dev:backend');
                console.error('2. Check if backend is running at:', baseUrl);
                console.error('3. If testing on mobile device, update EXPO_PUBLIC_RORK_API_BASE_URL in .env.local with your computer\'s IP address');
                console.error('4. Find your IP: Mac/Linux: ifconfig | grep "inet " | Windows: ipconfig');
                console.error('5. Make sure your device and computer are on the same network');
                
                throw new Error(`Unable to connect to backend server at ${baseUrl}.\n\nPlease start your backend server with: bun run dev:backend\n\nIf testing on a mobile device, make sure EXPO_PUBLIC_RORK_API_BASE_URL in .env.local uses your computer's IP address instead of localhost.`);
              } else {
                throw new Error('Unable to connect to server. Please check your internet connection and try again.');
              }
            }
          }
          
          throw error;
        }
      },
    }),
  ],
});

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import { AppState } from 'react-native';

import type { Database } from './database.types';
import { withJwtSkewRetry } from './resilientFetch';

// React Native has no Web Crypto. Without it supabase-js builds its PKCE verifier from
// Math.random and downgrades the challenge to "plain". Shim the two pieces it uses:
// getRandomValues (verifier) and subtle.digest (SHA-256 challenge). Once `crypto`
// exists, supabase-js calls both, so both must be defined.
if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
}
if (typeof globalThis.crypto.getRandomValues !== 'function') {
  Object.defineProperty(globalThis.crypto, 'getRandomValues', {
    value: <T extends ArrayBufferView>(array: T): T => Crypto.getRandomValues(array as never) as unknown as T,
    configurable: true,
  });
}
if (!globalThis.crypto.subtle) {
  Object.defineProperty(globalThis.crypto, 'subtle', {
    value: {
      digest: (algorithm: string, data: BufferSource) =>
        Crypto.digest(algorithm as Crypto.CryptoDigestAlgorithm, data),
    },
    configurable: true,
  });
}

const supabaseUrl =process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values.'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
  // Every request goes through here: retry the brief "JWT issued at future" rejection that can
  // follow a token refresh on app open, instead of surfacing it as a load error.
  global: { fetch: withJwtSkewRetry((input, init) => fetch(input, init)) },
});

// Only keep refreshing the token while the app is in the foreground (Supabase's recommendation
// for React Native); coming back to the foreground refreshes it straight away if it's due.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

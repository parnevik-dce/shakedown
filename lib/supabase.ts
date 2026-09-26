import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';

// React Native has no crypto.subtle; without it supabase-js downgrades PKCE to the
// weaker "plain" challenge. Shim just the SHA-256 digest it needs.
if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

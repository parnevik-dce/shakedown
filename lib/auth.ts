import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';

import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

const redirectTo = makeRedirectUri();

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Supabase did not return an OAuth URL.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    return;
  }

  const { params, errorCode } = QueryParams.getQueryParams(result.url);
  if (errorCode) throw new Error(errorCode);

  const { code } = params;
  if (!code) throw new Error('No auth code returned from Supabase.');

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

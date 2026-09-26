import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';

import { signInWithGoogle, signOut } from './lib/auth';
import { useSession } from './lib/useSession';

export default function App() {
  const { session, loading } = useSession();
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign-in failed', err);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
    } catch (err) {
      console.error('Sign-out failed', err);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {session ? (
        <>
          <Text>Signed in as {session.user.email}</Text>
          <Button title="Sign out" onPress={handleSignOut} disabled={busy} />
        </>
      ) : (
        <Button title="Sign in with Google" onPress={handleSignIn} disabled={busy} />
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
});

import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signInWithGoogle } from '@/lib/auth';
import { colors, spacing } from '@/lib/theme';

export default function SignIn() {
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign-in failed', err);
      Alert.alert('Sign-in failed', err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <View style={styles.logo}>
          <Ionicons name="wallet-outline" size={34} color={colors.muted} />
        </View>
        <Text style={styles.title}>Shakedown</Text>
        <Text style={styles.subtitle}>Split what you share. Skip the awkward math.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={handleSignIn}
          disabled={busy}
          style={({ pressed }) => [styles.google, (busy || pressed) && { opacity: 0.6 }]}
        >
          <Ionicons name="logo-google" size={18} color={colors.primary} />
          <Text style={styles.googleText}>{busy ? 'Signing in…' : 'Continue with Google'}</Text>
        </Pressable>
        <Text style={styles.footnote}>Google is the only sign-in method in v1.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.md },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { fontSize: 36, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 18, color: colors.muted, lineHeight: 25, marginBottom: spacing.lg },
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: 12,
    paddingVertical: 15,
  },
  googleText: { fontSize: 17, fontWeight: '600', color: colors.text },
  footnote: { fontSize: 13, color: colors.muted },
});

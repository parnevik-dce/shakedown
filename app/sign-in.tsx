import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenBackground } from '@/components/ScreenBackground';
import { signInWithGoogle } from '@/lib/auth';
import { colors, radii, shadows, spacing } from '@/lib/theme';

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
    <ScreenBackground>
      <SafeAreaView style={styles.screen}>
        <View style={styles.body}>
          <View style={styles.logo}>
            <Ionicons name="cash-outline" size={36} color={colors.primary} />
          </View>
          <Text style={styles.title}>Shakedown</Text>
          <Text style={styles.subtitle}>Track what's owed. Nobody skips out.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={handleSignIn}
            disabled={busy}
            style={({ pressed }) => [styles.google, pressed && styles.googlePressed]}
          >
            <Ionicons name="logo-google" size={18} color={colors.primary} />
            <Text style={styles.googleText}>{busy ? 'Signing in…' : 'Continue with Google'}</Text>
          </Pressable>
          <Text style={styles.footnote}>Google is the only sign-in method in v1.</Text>
        </View>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.md },
  logo: {
    width: 80,
    height: 80,
    borderRadius: radii.xl,
    backgroundColor: colors.tint,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(140,22,32,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  subtitle: { fontSize: 18, color: colors.muted, lineHeight: 25, marginBottom: spacing.lg },
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: 16,
    ...shadows.card,
  },
  googlePressed: { backgroundColor: colors.tint, transform: [{ scale: 0.98 }] },
  googleText: { fontSize: 17, fontWeight: '700', color: colors.text },
  footnote: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: spacing.sm },
});

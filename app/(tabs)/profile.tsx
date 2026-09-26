import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui';
import { signOut } from '@/lib/auth';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';

type Profile = { display_name: string; email: string | null; avatar_url: string | null };

export default function ProfileScreen() {
  const { session } = useSession();
  const userId = session!.user.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      supabase
        .from('profiles')
        .select('display_name, email, avatar_url')
        .eq('id', userId)
        .single()
        .then(({ data }) => setProfile(data));
    }, [userId])
  );

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
    } catch (err) {
      Alert.alert('Sign-out failed', err instanceof Error ? err.message : 'Please try again.');
      setBusy(false);
    }
  }

  const name = profile?.display_name ?? session?.user.user_metadata?.full_name ?? '';
  const email = profile?.email ?? session?.user.email ?? '';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.photo} />
        ) : (
          <Avatar name={name} size={64} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {email}
          </Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={handleSignOut}
          disabled={busy}
          style={({ pressed }) => [styles.signOut, (busy || pressed) && { opacity: 0.6 }]}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  photo: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.tint },
  name: { fontSize: 24, fontWeight: '800', color: colors.text },
  email: { fontSize: 15, color: colors.muted, marginTop: 2 },
  footer: { padding: spacing.lg },
  signOut: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  signOutText: { fontSize: 17, fontWeight: '600', color: colors.text },
});

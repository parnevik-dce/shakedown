import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenBackground } from '@/components/ScreenBackground';
import { Avatar, SectionLabel } from '@/components/ui';
import { signOut } from '@/lib/auth';
import { fetchOverallBalances, type OverallBalances, type PersonBalance } from '@/lib/balances';
import { formatCents } from '@/lib/money';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors, radii, shadows, spacing } from '@/lib/theme';

type Profile = { display_name: string; email: string | null; avatar_url: string | null };

function PersonRow({ person, open, onToggle }: { person: PersonBalance; open: boolean; onToggle: () => void }) {
  const owesMe = person.cents > 0;
  return (
    <View>
      <Pressable accessibilityRole="button" onPress={onToggle} style={styles.personRow}>
        <Avatar name={person.displayName} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={styles.personName}>{person.displayName}</Text>
          <Text style={styles.personSub} numberOfLines={1}>
            {person.groups.map((g) => g.groupName).join(' · ') || 'Across groups'}
          </Text>
        </View>
        <Text style={[styles.personAmount, { color: owesMe ? colors.positive : colors.negative }]}>
          {formatCents(person.cents)}
        </Text>
      </Pressable>
      {open &&
        person.groups.map((g) => (
          <Pressable
            key={g.groupId}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/groups/[id]', params: { id: g.groupId, tab: 'balances' } })}
            style={styles.groupLine}
          >
            <Text style={styles.groupLineName}>{g.groupName}</Text>
            <Text style={styles.groupLineText}>
              {g.cents > 0 ? `owes you ${formatCents(g.cents)}` : `you owe ${formatCents(g.cents)}`}
            </Text>
          </Pressable>
        ))}
    </View>
  );
}

export default function ProfileScreen() {
  const { session } = useSession();
  const userId = session!.user.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [overall, setOverall] = useState<OverallBalances | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      supabase
        .from('profiles')
        .select('display_name, email, avatar_url')
        .eq('id', userId)
        .single()
        .then(({ data }) => setProfile(data));
      fetchOverallBalances(userId).then(setOverall, () => setOverall(null));
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
  const total = overall?.totalCents ?? 0;

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32, gap: spacing.md }}>
          <View style={[styles.card, styles.header]}>
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

          <View style={styles.card}>
            <SectionLabel>Overall balance</SectionLabel>
            <Text style={[styles.total, total > 0 && { color: colors.positive }, total < 0 && { color: colors.negative }]}>
              {total > 0 ? '+' : total < 0 ? '−' : ''}
              {formatCents(total)}
            </Text>
            <Text style={styles.totalSub}>
              {total === 0
                ? "You're all settled up."
                : `${total > 0 ? "you're owed" : 'you owe'} overall, across ${overall?.groupCount ?? 0} group${overall?.groupCount === 1 ? '' : 's'}`}
            </Text>
          </View>

          {overall && overall.owesMe.length > 0 && (
            <View style={styles.card}>
              <SectionLabel>Owes you</SectionLabel>
              {overall.owesMe.map((p) => (
                <PersonRow key={p.userId} person={p} open={open === p.userId} onToggle={() => setOpen(open === p.userId ? null : p.userId)} />
              ))}
            </View>
          )}
          {overall && overall.iOwe.length > 0 && (
            <View style={styles.card}>
              <SectionLabel>You owe</SectionLabel>
              {overall.iOwe.map((p) => (
                <PersonRow key={p.userId} person={p} open={open === p.userId} onToggle={() => setOpen(open === p.userId ? null : p.userId)} />
              ))}
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={handleSignOut}
            disabled={busy}
            style={({ pressed }) => [styles.card, styles.signOut, (busy || pressed) && { opacity: 0.6 }]}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.negative} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  card: {
    backgroundColor: colors.bg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.card,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  photo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.tint,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  name: { fontSize: 24, fontWeight: '800', color: colors.text },
  email: { fontSize: 15, color: colors.muted, marginTop: 2 },
  total: { fontSize: 40, fontWeight: '800', color: colors.text },
  totalSub: { fontSize: 14, color: colors.muted, marginTop: 2 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10 },
  personName: { fontSize: 16, fontWeight: '600', color: colors.text },
  personSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  personAmount: { fontSize: 16, fontWeight: '700' },
  groupLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: 52,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  groupLineName: { fontSize: 14, color: colors.text },
  groupLineText: { fontSize: 14, color: colors.muted },
  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  signOutText: { fontSize: 17, fontWeight: '600', color: colors.negative },
});

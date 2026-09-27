import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, EmptyState, LinkButton, SectionLabel } from '@/components/ui';
import {
  fetchGroup,
  getOrCreateInviteCode,
  inviteLink,
  leaveGroup,
  removeMember,
  type GroupDetail,
} from '@/lib/groups';
import { useSession } from '@/lib/session';
import { colors, spacing } from '@/lib/theme';

type Tab = 'activity' | 'members';

function messageOf(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
}

export default function GroupScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { session } = useSession();
  const me = session!.user.id;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab === 'members' ? 'members' : 'activity');

  const load = useCallback(async () => {
    try {
      const [g, c] = await Promise.all([fetchGroup(id), getOrCreateInviteCode(id)]);
      setGroup(g);
      setCode(c);
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function confirmLeave() {
    Alert.alert('Leave this group?', 'You can rejoin later with an invite code.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveGroup(id);
            router.replace('/');
          } catch (err) {
            Alert.alert("Can't leave yet", messageOf(err));
          }
        },
      },
    ]);
  }

  function confirmRemove(userId: string, name: string, email: string | null) {
    Alert.alert(`Remove ${name}${email ? ` (${email})` : ''}?`, 'They will lose access to this group.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMember(id, userId);
            await load();
          } catch (err) {
            Alert.alert("Can't remove", messageOf(err));
          }
        },
      },
    ]);
  }

  async function shareInvite() {
    if (!code || !group) return;
    await Share.share({
      message: `Join "${group.name}" on Shakedown. Use invite code ${code}, or open ${inviteLink(code)}`,
    });
  }

  async function copyCode() {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    Alert.alert('Copied', 'Invite code copied to your clipboard.');
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={styles.backText}>Groups</Text>
        </Pressable>
        <Text style={styles.navTitle} numberOfLines={1}>
          {group?.name ?? ''}
        </Text>
        <View style={{ width: 70 }} />
      </View>

      {error ? (
        <View style={styles.center}>
          <EmptyState icon="alert-circle-outline" title="Couldn't load this group" message={error}>
            <LinkButton title="Try again" onPress={load} />
          </EmptyState>
        </View>
      ) : !group ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <>
          <View style={styles.summary}>
            <Text style={styles.summarySub}>
              {group.members.length} member{group.members.length === 1 ? '' : 's'} · no expenses yet
            </Text>
            <Text style={styles.summaryTitle}>Settled up</Text>
          </View>

          <View style={styles.tabs}>
            {(['activity', 'members'] as const).map((t) => (
              <Pressable key={t} accessibilityRole="tab" onPress={() => setTab(t)} style={styles.tab}>
                <Text style={[styles.tabText, tab === t && styles.tabActive]}>
                  {t === 'activity' ? 'Activity' : 'Members'}
                </Text>
                {tab === t && <View style={styles.tabUnderline} />}
              </Pressable>
            ))}
          </View>

          {tab === 'activity' ? (
            <View style={styles.center}>
              <EmptyState
                icon="receipt-outline"
                title="Nothing here yet"
                message="Add the first expense and everyone's balance starts keeping itself."
              >
                <LinkButton title="Invite people first" onPress={() => setTab('members')} />
              </EmptyState>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.membersBody}>
              <SectionLabel>Invite</SectionLabel>
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardLabel}>Invite code</Text>
                    <Text style={styles.code}>{code}</Text>
                  </View>
                  <LinkButton title="Copy" onPress={copyCode} />
                </View>
                <View style={styles.divider} />
                <Pressable accessibilityRole="button" onPress={shareInvite} style={styles.cardRow}>
                  <Ionicons name="share-outline" size={20} color={colors.primary} />
                  <Text style={styles.shareText}>Share invite</Text>
                </Pressable>
              </View>
              <Text style={styles.hint}>Codes expire after 7 days. Anyone with the code can join this group.</Text>

              <SectionLabel>Members</SectionLabel>
              <View style={styles.card}>
                {group.members.map((m, i) => (
                  <View key={m.userId}>
                    {i > 0 && <View style={styles.divider} />}
                    <View style={styles.cardRow}>
                      <Avatar name={m.displayName} size={38} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberName}>
                          {m.displayName}
                          {m.userId === me ? ' (you)' : ''}
                        </Text>
                        {m.email ? <Text style={styles.memberSub}>{m.email}</Text> : null}
                      </View>
                      {m.role === 'owner' ? (
                        <Text style={styles.memberSub}>Owner</Text>
                      ) : m.userId !== me ? (
                        <LinkButton title="Remove" danger onPress={() => confirmRemove(m.userId, m.displayName, m.email)} />
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>

              <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
                <LinkButton title="Leave group" danger onPress={confirmLeave} />
              </View>
            </ScrollView>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', paddingBottom: 60 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  back: { flexDirection: 'row', alignItems: 'center', width: 70 },
  backText: { fontSize: 17, color: colors.primary },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.text },
  summary: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  summarySub: { fontSize: 13, color: colors.muted },
  summaryTitle: { fontSize: 28, fontWeight: '800', color: colors.text, marginTop: 2 },
  tabs: {
    flexDirection: 'row',
    gap: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: { paddingVertical: spacing.md },
  tabText: { fontSize: 16, color: colors.muted, fontWeight: '500' },
  tabActive: { color: colors.primary, fontWeight: '700' },
  tabUnderline: { position: 'absolute', left: 0, right: 0, bottom: -StyleSheet.hairlineWidth, height: 2, backgroundColor: colors.primary },
  membersBody: { paddingHorizontal: spacing.lg, paddingBottom: 48 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  cardLabel: { fontSize: 13, color: colors.muted },
  code: { fontSize: 22, fontWeight: '700', letterSpacing: 3, color: colors.text, marginTop: 2 },
  shareText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  hint: { fontSize: 13, color: colors.muted, marginTop: spacing.sm, lineHeight: 18 },
  memberName: { fontSize: 16, fontWeight: '600', color: colors.text },
  memberSub: { fontSize: 13, color: colors.muted },
});

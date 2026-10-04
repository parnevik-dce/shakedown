import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenBackground } from '@/components/ScreenBackground';
import { EmptyState, LinkButton, PrimaryButton } from '@/components/ui';
import { fetchMyGroups, fetchMyInvites, respondToInvite, type GroupSummary, type MyInvite, type TripIcon } from '@/lib/groups';
import { formatCents } from '@/lib/money';
import { getTripCoverUrl } from '@/lib/tripCovers';
import { useSession } from '@/lib/session';
import { colors, radii, shadows, spacing } from '@/lib/theme';

function formatTripDates(start: string | null, end: string | null) {
  if (!start) return null;
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

function GroupRow({ group }: { group: GroupSummary }) {
  const dates = group.kind === 'trip' ? formatTripDates(group.startDate, group.endDate) : null;
  const members = `${group.memberCount} member${group.memberCount === 1 ? '' : 's'}`;
  const net = group.myNetCents;
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    if (group.coverImagePath) getTripCoverUrl(group.coverImagePath).then(setCoverUrl).catch(() => {});
  }, [group.coverImagePath]);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/groups/[id]', params: { id: group.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.thumb}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.thumbImage} />
        ) : (
          <Ionicons
            name={(group.icon as TripIcon) ?? (group.kind === 'trip' ? 'airplane-outline' : 'home-outline')}
            size={22}
            color={colors.primary}
          />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {[dates, members].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {net === 0 ? (
          <>
            <Text style={styles.amount}>—</Text>
            <Text style={styles.rowSub}>settled up</Text>
          </>
        ) : (
          <>
            <Text style={[styles.amount, { color: net > 0 ? colors.positive : colors.negative }]}>
              {formatCents(net)}
            </Text>
            <Text style={styles.rowSub}>{net > 0 ? "you're owed" : 'you owe'}</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

function InviteCard({ invite, onRespond }: { invite: MyInvite; onRespond: (invite: MyInvite, accept: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  async function respond(accept: boolean) {
    setBusy(true);
    await onRespond(invite, accept);
    setBusy(false);
  }
  return (
    <View style={styles.invite}>
      <View style={styles.inviteTop}>
        <View style={styles.thumb}>
          <Ionicons
            name={(invite.icon as TripIcon) ?? (invite.kind === 'trip' ? 'airplane-outline' : 'mail-open-outline')}
            size={22}
            color={colors.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {invite.groupName}
          </Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {invite.invitedBy ? `${invite.invitedBy} invited you` : 'You were invited'}
          </Text>
        </View>
      </View>
      <View style={styles.inviteActions}>
        <View style={{ flex: 1 }}>
          <PrimaryButton title="Join" onPress={() => respond(true)} loading={busy} />
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => respond(false)}
          style={({ pressed }) => [styles.decline, (busy || pressed) && { opacity: 0.6 }]}
        >
          <Text style={styles.declineText}>Decline</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function GroupsScreen() {
  const { session } = useSession();
  const userId = session!.user.id;
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [invites, setInvites] = useState<MyInvite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [g, i] = await Promise.all([fetchMyGroups(userId), fetchMyInvites().catch(() => [] as MyInvite[])]);
      setGroups(g);
      setInvites(i);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your groups.');
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleRespond(invite: MyInvite, accept: boolean) {
    const send = async () => {
      try {
        const groupId = await respondToInvite(invite.inviteId, accept);
        await load();
        if (accept) router.push({ pathname: '/groups/[id]', params: { id: groupId } });
      } catch (err) {
        Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
        await load();
      }
    };
    if (accept) return send();
    return new Promise<void>((resolve) => {
      Alert.alert(`Decline ${invite.groupName}?`, 'The person who invited you can send it again later.', [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
        { text: 'Decline', style: 'destructive', onPress: () => send().then(resolve) },
      ]);
    });
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Shakedown</Text>
            <Text style={styles.title}>Groups</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create a group"
            onPress={() => router.push('/groups/new')}
            style={({ pressed }) => [styles.plus, pressed && { transform: [{ scale: 0.94 }] }]}
          >
            <Ionicons name="add" size={26} color={colors.onPrimary} />
          </Pressable>
        </View>

        {error ? (
          <View style={styles.center}>
            <EmptyState icon="cloud-offline-outline" title="Couldn't load groups" message={error}>
              <LinkButton title="Try again" onPress={load} />
            </EmptyState>
          </View>
        ) : groups === null ? null : groups.length === 0 ? (
          <View style={styles.center}>
            <EmptyState
              icon="people-outline"
              title="No crews yet"
              message="Start one for your apartment, your trip, or whoever you keep splitting things with -- and keep the books straight."
            >
              <View style={{ alignSelf: 'stretch' }}>
                <PrimaryButton title="Create your first group" onPress={() => router.push('/groups/new')} />
              </View>
              <LinkButton title="Join with an invite code" onPress={() => router.push('/join')} />
            </EmptyState>
          </View>
        ) : (
          <FlatList
            data={groups}
            keyExtractor={(g) => g.id}
            renderItem={({ item }) => <GroupRow group={item} />}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}
            ListHeaderComponent={
              invites.length > 0 ? (
                <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
                  <Text style={styles.sectionTitle}>Invitations</Text>
                  {invites.map((inv) => (
                    <InviteCard key={inv.inviteId} invite={inv} onRespond={handleRespond} />
                  ))}
                  {groups.length > 0 && <Text style={styles.sectionTitle}>Your groups</Text>}
                </View>
              ) : null
            }
            ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  await load();
                  setRefreshing(false);
                }}
              />
            }
            ListFooterComponent={
              <View style={{ alignItems: 'center', padding: spacing.xl }}>
                <LinkButton title="Join with an invite code" onPress={() => router.push('/join')} />
              </View>
            }
          />
        )}
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  brand: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.accent,
    marginBottom: 2,
  },
  title: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  plus: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.button,
  },
  center: { flex: 1, justifyContent: 'center', paddingBottom: 60 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  rowPressed: { backgroundColor: colors.surface, transform: [{ scale: 0.99 }] },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.tint,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.muted,
    marginTop: spacing.sm,
  },
  invite: {
    backgroundColor: colors.bg,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.accent,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card,
  },
  inviteTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  inviteActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  decline: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  declineText: { fontSize: 16, fontWeight: '600', color: colors.negative },
  rowTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '700', color: colors.text },
});

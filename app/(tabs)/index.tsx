import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenBackground } from '@/components/ScreenBackground';
import { EmptyState, LinkButton, PrimaryButton } from '@/components/ui';
import { fetchMyGroups, type GroupSummary, type TripIcon } from '@/lib/groups';
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

export default function GroupsScreen() {
  const { session } = useSession();
  const userId = session!.user.id;
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setGroups(await fetchMyGroups(userId));
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

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Groups</Text>
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
              title="No groups yet"
              message="Make a group for your apartment, your trip, or whoever you keep splitting things with."
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
  title: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  plus: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
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
    ...shadows.card,
  },
  rowPressed: { backgroundColor: colors.surface, transform: [{ scale: 0.99 }] },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  rowTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '700', color: colors.text },
});

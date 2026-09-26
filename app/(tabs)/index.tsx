import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, LinkButton, PrimaryButton } from '@/components/ui';
import { fetchMyGroups, type GroupSummary } from '@/lib/groups';
import { formatCents } from '@/lib/money';
import { useSession } from '@/lib/session';
import { colors, spacing } from '@/lib/theme';

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

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/groups/[id]', params: { id: group.id } })}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
    >
      <View style={styles.thumb}>
        <Ionicons name={group.kind === 'trip' ? 'airplane-outline' : 'home-outline'} size={22} color={colors.primary} />
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
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Groups</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create a group"
          onPress={() => router.push('/groups/new')}
          style={styles.plus}
        >
          <Ionicons name="add" size={24} color={colors.text} />
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
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { fontSize: 32, fontWeight: '800', color: colors.text },
  plus: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, justifyContent: 'center', paddingBottom: 60 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  thumb: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '700', color: colors.text },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 76 },
});

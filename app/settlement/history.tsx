import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, EmptyState, LinkButton } from '@/components/ui';
import { fromDateString } from '@/lib/expenses';
import { formatCents } from '@/lib/money';
import { fetchGroupSettlements, paymentMethodLabel, type Settlement } from '@/lib/settlements';
import { useSession } from '@/lib/session';
import { colors, spacing } from '@/lib/theme';

function whenLabel(s: Settlement) {
  const d = fromDateString(s.settledOn);
  const today = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'Today';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(d.getFullYear() !== today.getFullYear() && { year: 'numeric' }) });
}

export default function SettlementHistory() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { session } = useSession();
  const me = session!.user.id;
  const [items, setItems] = useState<Settlement[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchGroupSettlements(groupId).then(
      (r) => {
        setItems(r);
        setError(null);
      },
      (err) => setError(err instanceof Error ? err.message : 'Could not load payments.')
    );
  }, [groupId]);

  useFocusEffect(load);

  const who = (id: string, name: string) => (id === me ? 'You' : name);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8} style={styles.side}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={styles.action}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Settlements</Text>
        <View style={styles.side} />
      </View>

      {error ? (
        <View style={styles.center}>
          <EmptyState icon="alert-circle-outline" title="Couldn't load payments" message={error}>
            <LinkButton title="Try again" onPress={load} />
          </EmptyState>
        </View>
      ) : items === null ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            icon="swap-horizontal-outline"
            title="No payments yet"
            message="When someone pays someone back, record it from the Balances tab and it shows up here."
          />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/settlement/[id]', params: { id: item.id } })}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
            >
              <Avatar name={item.payerName} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>
                  {who(item.paidBy, item.payerName)} paid {who(item.paidTo, item.payeeName)}
                </Text>
                <Text style={styles.rowSub}>
                  {whenLabel(item)} · recorded by {who(item.createdBy, item.creatorName)}
                  {paymentMethodLabel(item.paymentMethod, item.paymentMethodNote) &&
                    ` · via ${paymentMethodLabel(item.paymentMethod, item.paymentMethodNote)}`}
                </Text>
              </View>
              <Text style={styles.amount}>{formatCents(item.amountCents)}</Text>
            </Pressable>
          )}
        />
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  side: { flexDirection: 'row', alignItems: 'center', width: 70 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  action: { fontSize: 17, color: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '700', color: colors.text },
});

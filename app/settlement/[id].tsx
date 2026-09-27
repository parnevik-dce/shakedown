import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, LinkButton } from '@/components/ui';
import { fromDateString } from '@/lib/expenses';
import { formatCents } from '@/lib/money';
import { deleteSettlement, fetchSettlement, type Settlement } from '@/lib/settlements';
import { useSession } from '@/lib/session';
import { colors, spacing } from '@/lib/theme';

function messageOf(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
}

export default function SettlementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const me = session!.user.id;
  const [s, setS] = useState<Settlement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchSettlement(id).then(
        (r) => {
          setS(r);
          setError(null);
        },
        (err) => setError(messageOf(err))
      );
    }, [id])
  );

  function confirmDelete() {
    Alert.alert('Delete this payment?', 'Balances will go back to what they were before it was recorded.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteSettlement(id);
            router.back();
          } catch (err) {
            Alert.alert("Can't delete", messageOf(err));
            setBusy(false);
          }
        },
      },
    ]);
  }

  const who = (userId: string, name: string) => (userId === me ? 'You' : name);
  const mine = s?.createdBy === me;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8} style={styles.side}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={styles.action}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Settlement</Text>
        <View style={styles.side} />
      </View>

      {error ? (
        <View style={styles.center}>
          <EmptyState icon="alert-circle-outline" title="Can't open this payment" message={error}>
            <LinkButton title="Go back" onPress={() => router.back()} />
          </EmptyState>
        </View>
      ) : !s ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <View style={styles.body}>
          <Text style={styles.headline}>
            {who(s.paidBy, s.payerName)} paid {who(s.paidTo, s.payeeName)}
          </Text>
          <Text style={styles.amount}>{formatCents(s.amountCents)}</Text>
          <Text style={styles.meta}>
            {fromDateString(s.settledOn).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ·{' '}
            {s.groupName}
          </Text>
          <Text style={styles.note}>
            Recorded by {who(s.createdBy, s.creatorName)}. Balances updated immediately.
          </Text>
          {mine ? (
            <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
              <LinkButton title={busy ? 'Deleting…' : 'Delete settlement'} danger onPress={confirmDelete} />
            </View>
          ) : (
            <Text style={[styles.note, { textAlign: 'center', marginTop: spacing.xl }]}>
              Only {s.creatorName} can delete this payment.
            </Text>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center' },
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
  body: { padding: spacing.lg },
  headline: { fontSize: 22, fontWeight: '700', color: colors.text },
  amount: { fontSize: 40, fontWeight: '800', color: colors.text, marginTop: 4 },
  meta: { fontSize: 14, color: colors.muted, marginTop: 6 },
  note: { fontSize: 14, color: colors.muted, marginTop: spacing.lg },
});

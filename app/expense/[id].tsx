import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, EmptyState, LinkButton, SectionLabel } from '@/components/ui';
import { deleteExpense, fetchExpense, fromDateString, type ExpenseDetail } from '@/lib/expenses';
import { formatCents } from '@/lib/money';
import { getReceiptUrl } from '@/lib/receipts';
import { useSession } from '@/lib/session';
import { colors, spacing } from '@/lib/theme';

function ReceiptThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    getReceiptUrl(path).then(setUrl, () => {});
  }, [path]);
  return url ? <Image source={{ uri: url }} style={styles.receiptThumb} /> : <View style={styles.receiptThumb} />;
}

function messageOf(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
}

function describeSplit(e: ExpenseDetail) {
  if (e.splitMethod === 'equal') return `Split equally ${e.splits.length} way${e.splits.length === 1 ? '' : 's'}`;
  if (e.splitMethod === 'percent') return 'Split by percentage';
  return 'Split by exact amounts';
}

export default function ExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const me = session!.user.id;
  const [expense, setExpense] = useState<ExpenseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setExpense(await fetchExpense(id));
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

  function confirmDelete() {
    Alert.alert('Delete this expense?', 'Balances will update right away. This is recorded in the activity feed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteExpense(id);
            router.back();
          } catch (err) {
            Alert.alert("Can't delete", messageOf(err));
            setBusy(false);
          }
        },
      },
    ]);
  }

  const mine = expense?.createdBy === me;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8} style={styles.side}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={styles.action}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Expense</Text>
        <View style={[styles.side, { justifyContent: 'flex-end' }]}>
          {expense && mine && (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() =>
                router.push({ pathname: '/expense/new', params: { groupId: expense.groupId, expenseId: expense.id } })
              }
            >
              <Text style={styles.action}>Edit</Text>
            </Pressable>
          )}
        </View>
      </View>

      {error ? (
        <View style={styles.center}>
          <EmptyState icon="alert-circle-outline" title="Can't open this expense" message={error}>
            <LinkButton title="Go back" onPress={() => router.back()} />
          </EmptyState>
        </View>
      ) : !expense ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.description}>{expense.description}</Text>
          <Text style={styles.amount}>{formatCents(expense.amountCents)}</Text>
          <Text style={styles.meta}>
            Paid by {expense.paidBy === me ? 'You' : expense.payerName} ·{' '}
            {fromDateString(expense.expenseDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}{' '}
            · {describeSplit(expense)}
          </Text>

          <SectionLabel>Split</SectionLabel>
          <View style={styles.card}>
            {expense.splits.map((s, i) => (
              <View key={s.userId}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.splitRow}>
                  <Avatar name={s.displayName} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.splitName}>
                      {s.displayName}
                      {s.userId === me ? ' (you)' : ''}
                    </Text>
                    {expense.splitMethod === 'percent' && s.percent !== null ? (
                      <Text style={styles.splitSub}>{s.percent}%</Text>
                    ) : s.email ? (
                      <Text style={styles.splitSub}>{s.email}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.splitAmount}>{formatCents(s.owedCents)}</Text>
                </View>
              </View>
            ))}
          </View>

          {expense.receiptPath && (
            <>
              <SectionLabel>Receipt</SectionLabel>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/expense/receipt', params: { path: expense.receiptPath! } })}
                style={styles.receiptRow}
              >
                <ReceiptThumb path={expense.receiptPath} />
                <Text style={styles.receiptTapText}>tap to view</Text>
              </Pressable>
            </>
          )}

          {mine ? (
            <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
              <LinkButton title={busy ? 'Deleting…' : 'Delete expense'} danger onPress={confirmDelete} />
            </View>
          ) : (
            <Text style={styles.note}>Added by {expense.creatorName}. Only they can edit or delete it.</Text>
          )}
        </ScrollView>
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
  body: { padding: spacing.lg, paddingBottom: 48 },
  description: { fontSize: 22, fontWeight: '700', color: colors.text },
  amount: { fontSize: 40, fontWeight: '800', color: colors.text, marginTop: 4 },
  meta: { fontSize: 14, color: colors.muted, marginTop: 6, lineHeight: 20 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  splitName: { fontSize: 16, fontWeight: '600', color: colors.text },
  splitSub: { fontSize: 13, color: colors.muted },
  splitAmount: { fontSize: 16, fontWeight: '700', color: colors.text },
  note: { marginTop: spacing.xl, textAlign: 'center', fontSize: 14, color: colors.muted },
  receiptRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  receiptThumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: colors.surface },
  receiptTapText: { fontSize: 14, color: colors.muted },
});

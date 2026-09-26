import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, EmptyState, LinkButton, PrimaryButton } from '@/components/ui';
import { fetchGroup, type GroupDetail } from '@/lib/groups';
import { centsToInput, formatCents, parseDollars } from '@/lib/money';
import { recordSettlement } from '@/lib/settlements';
import { useSession } from '@/lib/session';
import { colors, spacing } from '@/lib/theme';

function messageOf(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
}

type Side = 'payer' | 'payee';

export default function SettleUp() {
  const { groupId, from, to, cents } = useLocalSearchParams<{ groupId: string; from?: string; to?: string; cents?: string }>();
  const { session } = useSession();
  const me = session!.user.id;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payer, setPayer] = useState(from ?? me);
  const [payee, setPayee] = useState(to ?? '');
  const [amountText, setAmountText] = useState(cents ? centsToInput(Number(cents)) : '');
  const [date, setDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [picking, setPicking] = useState<Side | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchGroup(groupId).then(setGroup, (err) => setLoadError(messageOf(err)));
  }, [groupId]);

  const nameOf = (id: string) =>
    id === me ? 'You' : (group?.members.find((m) => m.userId === id)?.displayName ?? 'Choose someone');
  const amount = parseDollars(amountText);
  const problem =
    !payee ? 'Choose who receives the payment.' : payer === payee ? 'Payer and recipient must be different people.' : null;
  const canSave = !saving && !!payee && payer !== payee && amount !== null && amount > 0;

  async function handleConfirm() {
    if (!canSave || amount === null) return;
    setSaving(true);
    try {
      await recordSettlement({ groupId, paidBy: payer, paidTo: payee, amountCents: amount, settledOn: date });
      router.back();
    } catch (err) {
      Alert.alert('Could not record payment', messageOf(err));
      setSaving(false);
    }
  }

  function PersonRow({ side, label }: { side: Side; label: string }) {
    const id = side === 'payer' ? payer : payee;
    const open = picking === side;
    return (
      <View>
        <Pressable style={styles.personRow} onPress={() => setPicking(open ? null : side)} accessibilityRole="button">
          <Avatar name={id ? nameOf(id) : '?'} size={40} />
          <Text style={styles.personName}>{nameOf(id)}</Text>
          <Text style={styles.personRole}>{label}</Text>
          <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.muted} />
        </Pressable>
        {open &&
          group?.members.map((m) => (
            <Pressable
              key={m.userId}
              style={styles.optionRow}
              onPress={() => {
                if (side === 'payer') setPayer(m.userId);
                else setPayee(m.userId);
                setPicking(null);
              }}
            >
              <Avatar name={m.displayName} size={28} />
              <Text style={styles.optionName}>
                {m.displayName}
                {m.userId === me ? ' (you)' : ''}
                {m.email ? `  ${m.email}` : ''}
              </Text>
              {id === m.userId && <Ionicons name="checkmark" size={18} color={colors.primary} />}
            </Pressable>
          ))}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Settle up</Text>
        <View style={{ width: 60 }} />
      </View>

      {loadError ? (
        <View style={styles.center}>
          <EmptyState icon="alert-circle-outline" title="Can't open this" message={loadError}>
            <LinkButton title="Go back" onPress={() => router.back()} />
          </EmptyState>
        </View>
      ) : !group ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
          {from && to ? (
            <Text style={styles.prefill}>Pre-filled from the balances. You can change anything before confirming.</Text>
          ) : null}

          <PersonRow side="payer" label="pays" />
          <View style={styles.divider} />
          <PersonRow side="payee" label="receives" />

          <View style={styles.amountRow}>
            <Text style={styles.currency}>$</Text>
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              placeholder="0.00"
              placeholderTextColor={colors.border}
              keyboardType="decimal-pad"
              selectTextOnFocus
              maxLength={13}
              style={[styles.amount, { width: Math.max(150, (amountText.length || 4) * 33 + 16) }]}
              accessibilityLabel="Amount"
            />
          </View>

          <View style={styles.rows}>
            <Pressable style={styles.row} onPress={() => setShowDate((v) => !v)} accessibilityRole="button">
              <Text style={styles.rowLabel}>Date</Text>
              <Text style={styles.rowValue}>
                {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
              <Ionicons name={showDate ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.muted} />
            </Pressable>
            {showDate && (
              <DateTimePicker
                value={date}
                mode="date"
                display="inline"
                maximumDate={new Date()}
                onChange={(_, d) => d && setDate(d)}
              />
            )}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Group</Text>
              <Text style={styles.rowValue}>{group.name}</Text>
            </View>
          </View>

          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            {problem && amountText.length > 0 ? <Text style={styles.problem}>{problem}</Text> : null}
            <PrimaryButton title="Confirm payment" onPress={handleConfirm} disabled={!canSave} loading={saving} />
            <Text style={styles.note}>
              This records the payment{amount ? ` of ${formatCents(amount)}` : ''}. No money moves through Shakedown.
            </Text>
          </View>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  cancel: { fontSize: 17, color: colors.muted, width: 60 },
  prefill: { fontSize: 13, color: colors.muted, padding: spacing.lg, paddingBottom: 0 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  personName: { flex: 1, fontSize: 18, fontWeight: '600', color: colors.text },
  personRole: { fontSize: 15, color: colors.muted },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  optionName: { flex: 1, fontSize: 15, color: colors.text },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: spacing.lg },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', paddingVertical: spacing.xl },
  currency: { fontSize: 28, color: colors.muted, marginRight: 4 },
  amount: { fontSize: 52, fontWeight: '800', color: colors.text, textAlign: 'center' },
  rows: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { width: 96, fontSize: 15, color: colors.muted },
  rowValue: { flex: 1, fontSize: 16, color: colors.text },
  problem: { fontSize: 13, color: colors.negative },
  note: { fontSize: 13, color: colors.muted, textAlign: 'center' },
});

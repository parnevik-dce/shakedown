import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, EmptyState, LinkButton, SectionLabel } from '@/components/ui';
import { fetchExpense, fromDateString, saveExpense } from '@/lib/expenses';
import { fetchGroup, type GroupDetail } from '@/lib/groups';
import { centsToInput, formatCents, parseDollars } from '@/lib/money';
import { useSession } from '@/lib/session';
import {
  checkSplit,
  defaultThousandths,
  equalSplit,
  thousandthsToInput,
  type SplitInput,
  type SplitMethod,
} from '@/lib/splits';
import { colors, spacing } from '@/lib/theme';

const METHODS: { key: SplitMethod; label: string }[] = [
  { key: 'equal', label: 'Equal' },
  { key: 'exact', label: 'Exact' },
  { key: 'percent', label: 'Percent' },
];

const HINTS: Record<SplitMethod, string> = {
  equal: 'Tap anyone to leave them out.',
  exact: 'Amounts must add up to the expense total.',
  percent: 'Percentages must add up to 100%.',
};

function messageOf(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
}

export default function ExpenseForm() {
  const { groupId, expenseId } = useLocalSearchParams<{ groupId: string; expenseId?: string }>();
  const { session } = useSession();
  const me = session!.user.id;
  const editing = !!expenseId;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [amountText, setAmountText] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [paidBy, setPaidBy] = useState(me);
  const [method, setMethod] = useState<SplitMethod>('equal');
  const [inputs, setInputs] = useState<SplitInput[]>([]);
  const [showDate, setShowDate] = useState(false);
  const [showPayer, setShowPayer] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const g = await fetchGroup(groupId);
        setGroup(g);
        if (expenseId) {
          const e = await fetchExpense(expenseId);
          if (e.createdBy !== me) throw new Error(`Only ${e.creatorName} can edit this expense.`);
          setAmountText(centsToInput(e.amountCents));
          setDescription(e.description);
          setDate(fromDateString(e.expenseDate));
          setPaidBy(e.paidBy);
          setMethod(e.splitMethod);
          const byUser = new Map(e.splits.map((s) => [s.userId, s]));
          // Include people already in the expense even if they've since left the group.
          const people = new Map(g.members.map((m) => [m.userId, m.displayName]));
          for (const s of e.splits) if (!people.has(s.userId)) people.set(s.userId, s.displayName);
          setInputs(
            [...people.keys()].map((userId) => {
              const s = byUser.get(userId);
              return {
                userId,
                included: !!s,
                text: !s
                  ? ''
                  : e.splitMethod === 'exact'
                    ? centsToInput(s.owedCents)
                    : e.splitMethod === 'percent' && s.percent !== null
                      ? String(s.percent)
                      : '',
              };
            })
          );
        } else {
          setInputs(g.members.map((m) => ({ userId: m.userId, included: true, text: '' })));
        }
      } catch (err) {
        setLoadError(messageOf(err));
      }
    })();
  }, [groupId, expenseId, me]);

  const names = useMemo(() => new Map(group?.members.map((m) => [m.userId, m.displayName]) ?? []), [group]);
  const nameOf = (userId: string) => (userId === me ? 'You' : (names.get(userId) ?? 'Former member'));

  const totalCents = parseDollars(amountText);
  const check = useMemo(
    () => checkSplit(method, totalCents !== null && totalCents > 0 ? totalCents : null, inputs, parseDollars, formatCents),
    [method, totalCents, inputs]
  );
  const canSave =
    !saving && description.trim().length > 0 && totalCents !== null && totalCents > 0 && check.ok;

  function updateInput(userId: string, patch: Partial<SplitInput>) {
    setInputs((prev) => prev.map((i) => (i.userId === userId ? { ...i, ...patch } : i)));
  }

  function chooseMethod(next: SplitMethod) {
    if (next === method) return;
    setInputs((prev) => {
      const chosen = prev.filter((i) => i.included);
      let texts = new Map<string, string>();
      if (next === 'exact' && totalCents) {
        for (const s of equalSplit(totalCents, chosen.map((c) => c.userId))) texts.set(s.userId, centsToInput(s.owedCents));
      } else if (next === 'percent') {
        const t = defaultThousandths(chosen.length);
        chosen.forEach((c, i) => texts.set(c.userId, thousandthsToInput(t[i])));
      }
      return prev.map((i) => ({ ...i, text: texts.get(i.userId) ?? '' }));
    });
    setMethod(next);
  }

  async function handleSave() {
    if (!check.ok || totalCents === null) return;
    setSaving(true);
    try {
      await saveExpense({
        id: expenseId,
        groupId,
        description: description.trim(),
        amountCents: totalCents,
        paidBy,
        expenseDate: date,
        method,
        splits: check.splits,
      });
      router.back();
    } catch (err) {
      Alert.alert('Could not save expense', messageOf(err));
      setSaving(false);
    }
  }

  const shareFor = (userId: string) => (check.ok ? check.splits.find((s) => s.userId === userId) : undefined);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.navAction}>Cancel</Text>
        </Pressable>
        <Text style={styles.navTitle}>{editing ? 'Edit expense' : 'Add expense'}</Text>
        <Pressable accessibilityRole="button" onPress={handleSave} disabled={!canSave} hitSlop={8}>
          {saving ? (
            <ActivityIndicator />
          ) : (
            <Text style={[styles.navAction, styles.navPrimary, !canSave && { opacity: 0.4 }]}>Save</Text>
          )}
        </Pressable>
      </View>

      {loadError ? (
        <View style={styles.center}>
          <EmptyState icon="alert-circle-outline" title="Can't open this expense" message={loadError}>
            <LinkButton title="Go back" onPress={() => router.back()} />
          </EmptyState>
        </View>
      ) : !group ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 48 }}>
            <View style={styles.amountRow}>
              <Text style={styles.currency}>$</Text>
              <TextInput
                autoFocus={!editing}
                value={amountText}
                onChangeText={setAmountText}
                placeholder="0.00"
                placeholderTextColor={colors.border}
                keyboardType="decimal-pad"
                maxLength={13}
                style={[styles.amount, { width: Math.max(150, (amountText.length || 4) * 33 + 16) }]}
                accessibilityLabel="Amount"
              />
            </View>

            <View style={styles.rows}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Description</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Groceries"
                  placeholderTextColor={colors.muted}
                  maxLength={200}
                  style={styles.rowInput}
                />
              </View>
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
                  maximumDate={new Date(Date.now() + 366 * 86400000)}
                  onChange={(_, d) => d && setDate(d)}
                />
              )}
              <Pressable style={styles.row} onPress={() => setShowPayer((v) => !v)} accessibilityRole="button">
                <Text style={styles.rowLabel}>Paid by</Text>
                <Text style={styles.rowValue}>{nameOf(paidBy)}</Text>
                <Ionicons name={showPayer ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.muted} />
              </Pressable>
              {showPayer &&
                group.members.map((m) => (
                  <Pressable
                    key={m.userId}
                    style={styles.payerRow}
                    onPress={() => {
                      setPaidBy(m.userId);
                      setShowPayer(false);
                    }}
                  >
                    <Avatar name={m.displayName} size={28} />
                    <Text style={styles.payerName}>
                      {m.displayName}
                      {m.userId === me ? ' (you)' : ''}
                      {m.email ? `  ${m.email}` : ''}
                    </Text>
                    {paidBy === m.userId && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  </Pressable>
                ))}
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Group</Text>
                <Text style={styles.rowValue}>{group.name}</Text>
              </View>
            </View>

            <View style={{ paddingHorizontal: spacing.lg }}>
              <SectionLabel>Split</SectionLabel>
              <View style={styles.segment}>
                {METHODS.map((m) => (
                  <Pressable
                    key={m.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: method === m.key }}
                    onPress={() => chooseMethod(m.key)}
                    style={[styles.segmentItem, method === m.key && styles.segmentActive]}
                  >
                    <Text style={[styles.segmentText, method === m.key && styles.segmentTextActive]}>{m.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.hint}>{HINTS[method]}</Text>
            </View>

            <View style={{ marginTop: spacing.sm }}>
              {inputs.map((input) => {
                const share = shareFor(input.userId);
                return (
                  <View key={input.userId} style={[styles.splitRow, !input.included && { opacity: 0.45 }]}>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: input.included }}
                      onPress={() => updateInput(input.userId, { included: !input.included })}
                      style={styles.splitMain}
                    >
                      <View style={[styles.check, input.included && styles.checkOn]}>
                        {input.included && <Ionicons name="checkmark" size={14} color={colors.onPrimary} />}
                      </View>
                      <Avatar name={nameOf(input.userId)} size={34} />
                      <Text style={styles.splitName} numberOfLines={1}>
                        {nameOf(input.userId)}
                      </Text>
                    </Pressable>
                    {method === 'equal' ? (
                      <Text style={styles.splitAmount}>{share ? formatCents(share.owedCents) : '—'}</Text>
                    ) : (
                      <View style={styles.splitField}>
                        {method === 'exact' && <Text style={styles.fieldAffix}>$</Text>}
                        <TextInput
                          value={input.text}
                          editable={input.included}
                          onChangeText={(text) => updateInput(input.userId, { text })}
                          keyboardType="decimal-pad"
                          placeholder={method === 'exact' ? '0.00' : '0'}
                          placeholderTextColor={colors.muted}
                          textAlign="right"
                          style={styles.fieldInput}
                          accessibilityLabel={`${nameOf(input.userId)} ${method === 'exact' ? 'amount' : 'percent'}`}
                        />
                        {method === 'percent' && <Text style={styles.fieldAffix}>%</Text>}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>{check.summary}</Text>
              {!check.ok && totalCents !== null && <Text style={styles.footerError}>{check.error}</Text>}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  navTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  navAction: { fontSize: 17, color: colors.muted, minWidth: 50 },
  navPrimary: { color: colors.primary, fontWeight: '700', textAlign: 'right' },
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
  rowInput: { flex: 1, fontSize: 16, color: colors.text, padding: 0 },
  payerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  payerName: { flex: 1, fontSize: 15, color: colors.text },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 10, padding: 3 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  segmentActive: { backgroundColor: colors.bg, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  segmentText: { fontSize: 15, color: colors.muted },
  segmentTextActive: { color: colors.primary, fontWeight: '700' },
  hint: { fontSize: 13, color: colors.muted, marginTop: spacing.sm },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    minHeight: 54,
  },
  splitMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  splitName: { flex: 1, fontSize: 16, color: colors.text },
  splitAmount: { fontSize: 16, fontWeight: '600', color: colors.text },
  splitField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    width: 120,
    height: 38,
  },
  fieldAffix: { color: colors.muted, fontSize: 15 },
  fieldInput: { flex: 1, fontSize: 16, color: colors.text, paddingHorizontal: 4 },
  footer: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    gap: 2,
  },
  footerText: { fontSize: 14, fontWeight: '600', color: colors.text },
  footerError: { fontSize: 13, color: colors.negative },
});

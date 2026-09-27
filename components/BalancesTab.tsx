import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Avatar, EmptyState, LinkButton } from '@/components/ui';
import type { GroupBalances } from '@/lib/balances';
import type { Member } from '@/lib/groups';
import { formatCents } from '@/lib/money';
import { colors, spacing } from '@/lib/theme';

type View_ = 'raw' | 'simplified';

type Line = {
  key: string;
  /** Person shown in the avatar */
  avatarName: string;
  title: string;
  subtitle: string;
  cents: number;
  tone: 'positive' | 'negative' | 'neutral';
  from: string;
  to: string;
};

export function BalancesTab({
  groupId,
  me,
  members,
  balances,
}: {
  groupId: string;
  me: string;
  members: Member[];
  balances: GroupBalances;
}) {
  const [mode, setMode] = useState<View_>('raw');
  const name = (id: string) => (id === me ? 'You' : (members.find((m) => m.userId === id)?.displayName ?? 'Former member'));
  const tone = (from: string, to: string): Line['tone'] => (to === me ? 'positive' : from === me ? 'negative' : 'neutral');

  const lines: Line[] =
    mode === 'raw'
      ? balances.raw.map((d) => ({
          key: `${d.debtorId}>${d.creditorId}`,
          avatarName: name(d.debtorId === me ? d.creditorId : d.debtorId),
          title:
            d.creditorId === me
              ? `${name(d.debtorId)} owes you`
              : d.debtorId === me
                ? `You owe ${name(d.creditorId)}`
                : `${name(d.debtorId)} owes ${name(d.creditorId)}`,
          subtitle: d.expenseCount > 0 ? `from ${d.expenseCount} expense${d.expenseCount === 1 ? '' : 's'}` : 'net of payments',
          cents: d.cents,
          tone: tone(d.debtorId, d.creditorId),
          from: d.debtorId,
          to: d.creditorId,
        }))
      : balances.simplified.map((p) => ({
          key: `${p.from}>${p.to}`,
          avatarName: name(p.from === me ? p.to : p.from),
          title: p.from === me ? `You pay ${name(p.to)}` : `${name(p.from)} pays ${name(p.to)}`,
          subtitle: 'one payment',
          cents: p.cents,
          tone: tone(p.from, p.to),
          from: p.from,
          to: p.to,
        }));

  const rawCount = balances.raw.length;
  const simpleCount = balances.simplified.length;
  const caption =
    mode === 'raw'
      ? 'Exactly who owes whom, expense by expense.'
      : rawCount === simpleCount
        ? 'Already the fewest payments that clear everyone.'
        : `Fewest payments that clear everyone — ${rawCount} payment${rawCount === 1 ? '' : 's'} become ${simpleCount}.`;

  function settle(l: Line) {
    router.push({
      pathname: '/settlement/new',
      params: { groupId, from: l.from, to: l.to, cents: String(l.cents) },
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.segment}>
        {(['raw', 'simplified'] as const).map((m) => (
          <Pressable
            key={m}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === m }}
            onPress={() => setMode(m)}
            style={[styles.segmentItem, mode === m && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
              {m === 'raw' ? 'Raw balances' : 'Simplified'}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.caption}>{caption}</Text>

      {lines.length === 0 ? (
        <View style={{ paddingVertical: 48 }}>
          <EmptyState icon="checkmark-circle-outline" title="All settled up" message="Nobody owes anybody in this group." />
        </View>
      ) : (
        lines.map((l) => (
          <View key={l.key} style={styles.row}>
            <Avatar name={l.avatarName} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{l.title}</Text>
              <Text style={styles.sub}>{l.subtitle}</Text>
            </View>
            <Text
              style={[
                styles.amount,
                l.tone === 'positive' && { color: colors.positive },
                l.tone === 'negative' && { color: colors.negative },
              ]}
            >
              {formatCents(l.cents)}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Settle ${l.title}`} onPress={() => settle(l)} style={styles.settle}>
              <Text style={styles.settleText}>Settle</Text>
            </Pressable>
          </View>
        ))
      )}

      <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
        <LinkButton
          title="Settlement history"
          onPress={() => router.push({ pathname: '/settlement/history', params: { groupId } })}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: 24 },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 3,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  segmentActive: { backgroundColor: colors.bg, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  segmentText: { fontSize: 15, color: colors.muted },
  segmentTextActive: { color: colors.primary, fontWeight: '700' },
  caption: { fontSize: 13, color: colors.muted, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '700', color: colors.text },
  settle: { borderWidth: 1.5, borderColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  settleText: { fontSize: 14, fontWeight: '700', color: colors.primary },
});

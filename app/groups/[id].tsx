import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, EmptyState, LinkButton, PrimaryButton, SectionLabel } from '@/components/ui';
import { BalancesTab } from '@/components/BalancesTab';
import { fetchGroupBalances, type GroupBalances } from '@/lib/balances';
import {
  fetchGroupActivity,
  fetchGroupExpenseList,
  fromDateString,
  type ActivityItem,
  type ExpenseListItem,
  type GroupActivity,
} from '@/lib/expenses';
import { formatCents } from '@/lib/money';
import { formatWhen } from '@/lib/time';
import {
  fetchGroup,
  cancelPendingInvite,
  fetchPendingInvites,
  getOrCreateInviteCode,
  inviteLink,
  leaveGroup,
  removeMember,
  type GroupDetail,
  type PendingInvite,
  type TripIcon,
} from '@/lib/groups';
import { getTripCoverUrl } from '@/lib/tripCovers';
import { useSession } from '@/lib/session';
import { colors, spacing } from '@/lib/theme';

type Tab = 'activity' | 'expenses' | 'balances' | 'members';

function messageOf(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
}

function ActivityRow({ item, me }: { item: ActivityItem; me: string }) {
  const who = item.actorId === me ? 'You' : item.actorName;
  const isExpense = item.entityType === 'expense';
  const deleted = item.action === 'expense_deleted' || item.action === 'settlement_deleted';
  const verb =
    item.action === 'expense_added'
      ? 'added'
      : item.action === 'expense_edited'
        ? 'edited'
        : 'deleted';
  const name = (id: string, n: string) => (id === me ? 'You' : n);
  const st = item.settlement;
  const title = isExpense
    ? `${who} ${verb} ${item.summary ?? 'an expense'}`
    : st
      ? `${name(st.paidBy, st.payerName)} paid ${name(st.paidTo, st.payeeName)}`
      : `${who} recorded a payment`;
  // `mine` is null once the expense itself has been deleted, so old entries stop linking to it.
  const tappable = isExpense ? !deleted && item.mine !== null : !!st && !st.deleted && !deleted;
  const mine = item.mine && !deleted ? item.mine : null;
  const sub = isExpense ? formatWhen(item.createdAt) : `${formatWhen(item.createdAt)} · settlement${deleted ? ' removed' : ''}`;

  return (
    <Pressable
      accessibilityRole={tappable ? 'button' : undefined}
      disabled={!tappable}
      onPress={() =>
        isExpense
          ? router.push({ pathname: '/expense/[id]', params: { id: item.entityId } })
          : router.push({ pathname: '/settlement/[id]', params: { id: item.entityId } })
      }
      style={({ pressed }) => [styles.feedRow, pressed && { backgroundColor: colors.surface }]}
    >
      <Avatar name={isExpense ? item.actorName : (st?.payerName ?? item.actorName)} size={38} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.feedTitle, deleted && styles.struck]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.feedSub}>{sub}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {item.amountCents !== null && (
          <Text style={[styles.feedAmount, deleted && styles.struck]}>{formatCents(item.amountCents)}</Text>
        )}
        {mine && mine.kind === 'lent' && (
          <Text style={[styles.feedSub, { color: colors.positive }]}>you lent {formatCents(mine.cents)}</Text>
        )}
        {mine && mine.kind === 'owe' && (
          <Text style={[styles.feedSub, { color: colors.negative }]}>you owe {formatCents(mine.cents)}</Text>
        )}
      </View>
    </Pressable>
  );
}

function ExpenseRow({ item, me }: { item: ExpenseListItem; me: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/expense/[id]', params: { id: item.id } })}
      style={({ pressed }) => [styles.feedRow, pressed && { backgroundColor: colors.surface }]}
    >
      <Avatar name={item.payerName} size={38} />
      <View style={{ flex: 1 }}>
        <Text style={styles.feedTitle} numberOfLines={2}>
          {item.description}
        </Text>
        <Text style={styles.feedSub}>
          {item.paidBy === me ? 'You' : item.payerName} paid ·{' '}
          {fromDateString(item.expenseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {item.hasReceipt ? ' · receipt' : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.feedAmount}>{formatCents(item.amountCents)}</Text>
        {item.mine.kind === 'lent' && (
          <Text style={[styles.feedSub, { color: colors.positive }]}>you lent {formatCents(item.mine.cents)}</Text>
        )}
        {item.mine.kind === 'owe' && (
          <Text style={[styles.feedSub, { color: colors.negative }]}>you owe {formatCents(item.mine.cents)}</Text>
        )}
      </View>
    </Pressable>
  );
}

function AddBar({ groupId }: { groupId: string }) {
  return (
    <View style={styles.addBar}>
      <PrimaryButton
        title="Add expense"
        onPress={() => router.push({ pathname: '/expense/new', params: { groupId } })}
      />
    </View>
  );
}

export default function GroupScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { session } = useSession();
  const me = session!.user.id;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [activity, setActivity] = useState<GroupActivity | null>(null);
  const [expenseList, setExpenseList] = useState<ExpenseListItem[] | null>(null);
  const [balances, setBalances] = useState<GroupBalances | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab === 'members' ? 'members' : 'expenses');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);

  useEffect(() => {
    if (group?.coverImagePath) getTripCoverUrl(group.coverImagePath).then(setCoverUrl).catch(() => {});
    else setCoverUrl(null);
  }, [group?.coverImagePath]);

  const load = useCallback(async () => {
    try {
      const [g, c, a, e, b, p] = await Promise.all([
        fetchGroup(id),
        getOrCreateInviteCode(id),
        fetchGroupActivity(id, me),
        fetchGroupExpenseList(id, me),
        fetchGroupBalances(id),
        fetchPendingInvites(id),
      ]);
      setGroup(g);
      setCode(c);
      setActivity(a);
      setExpenseList(e);
      setBalances(b);
      setPendingInvites(p);
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    }
  }, [id, me]);

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

  function confirmCancelInvite(email: string) {
    Alert.alert(`Remove invite for ${email}?`, "They won't be added to this group if they sign in later.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelPendingInvite(id, email);
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
        <View style={[styles.back, { justifyContent: 'flex-end' }]}>
          {group?.kind === 'trip' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Trip info"
              hitSlop={8}
              onPress={() => router.push({ pathname: '/groups/trip', params: { groupId: id } })}
            >
              <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
            </Pressable>
          )}
        </View>
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
            {group.kind === 'trip' && (
              <View style={styles.tripHeader}>
                <View style={styles.tripThumb}>
                  {coverUrl ? (
                    <Image source={{ uri: coverUrl }} style={styles.tripThumbImage} />
                  ) : (
                    <Ionicons name={(group.icon as TripIcon) ?? 'airplane-outline'} size={22} color={colors.primary} />
                  )}
                </View>
                {group.startDate && group.endDate && (
                  <Text style={styles.tripDates}>
                    {fromDateString(group.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
                    {fromDateString(group.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                )}
              </View>
            )}
            <Text style={styles.summarySub}>
              {group.members.length} member{group.members.length === 1 ? '' : 's'} ·{' '}
              {activity?.expenseCount
                ? `${activity.expenseCount} expense${activity.expenseCount === 1 ? '' : 's'}`
                : 'no expenses yet'}
            </Text>
            {(() => {
              const net = activity?.myNetCents ?? 0;
              if (net === 0) return <Text style={styles.summaryTitle}>Settled up</Text>;
              return (
                <Text style={[styles.summaryTitle, { color: net > 0 ? colors.positive : colors.negative }]}>
                  {net > 0 ? "You're owed " : 'You owe '}
                  {formatCents(net)}
                </Text>
              );
            })()}
          </View>

          <View style={styles.tabs}>
            {(['expenses', 'activity', 'balances', 'members'] as const).map((t) => (
              <Pressable key={t} accessibilityRole="tab" onPress={() => setTab(t)} style={styles.tab}>
                <Text style={[styles.tabText, tab === t && styles.tabActive]}>
                  {t === 'activity' ? 'Activity' : t === 'expenses' ? 'Expenses' : t === 'balances' ? 'Balances' : 'Members'}
                </Text>
                {tab === t && <View style={styles.tabUnderline} />}
              </Pressable>
            ))}
          </View>

          {tab === 'expenses' ? (
            <View style={{ flex: 1 }}>
              {expenseList && expenseList.length === 0 ? (
                <View style={styles.center}>
                  <EmptyState
                    icon="receipt-outline"
                    title="No expenses yet"
                    message="Add the first one and it'll show up here."
                  />
                </View>
              ) : (
                <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                  {expenseList?.map((item) => (
                    <ExpenseRow key={item.id} item={item} me={me} />
                  ))}
                </ScrollView>
              )}
              <AddBar groupId={id} />
            </View>
          ) : tab === 'activity' ? (
            <View style={{ flex: 1 }}>
              {activity && activity.items.length === 0 ? (
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
                <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                  {activity?.items.map((item) => (
                    <ActivityRow key={item.id} item={item} me={me} />
                  ))}
                </ScrollView>
              )}
              <AddBar groupId={id} />
            </View>
          ) : tab === 'balances' ? (
            <View style={{ flex: 1 }}>
              {balances && <BalancesTab groupId={id} me={me} members={group.members} balances={balances} />}
              <AddBar groupId={id} />
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
                <View style={styles.divider} />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/groups/invite-contacts', params: { groupId: id } })}
                  style={styles.cardRow}
                >
                  <Ionicons name="person-add-outline" size={20} color={colors.primary} />
                  <Text style={styles.shareText}>Invite from contacts</Text>
                </Pressable>
              </View>
              <Text style={styles.hint}>Codes expire after 7 days. Anyone with the code can join this group.</Text>

              {pendingInvites.length > 0 && (
                <>
                  <SectionLabel>Pending invites</SectionLabel>
                  <View style={styles.card}>
                    {pendingInvites.map((p, i) => (
                      <View key={p.email}>
                        {i > 0 && <View style={styles.divider} />}
                        <View style={styles.cardRow}>
                          <Ionicons name="mail-outline" size={20} color={colors.muted} />
                          <Text style={[styles.memberName, { flex: 1 }]} numberOfLines={1}>
                            {p.email}
                          </Text>
                          <LinkButton title="Remove" danger onPress={() => confirmCancelInvite(p.email)} />
                        </View>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.hint}>They'll join automatically the first time they sign in with this email.</Text>
                </>
              )}

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
                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        {(() => {
                          const net = balances?.net.get(m.userId) ?? 0;
                          if (net === 0) return null;
                          return (
                            <Text style={[styles.memberNet, { color: net > 0 ? colors.positive : colors.negative }]}>
                              {net > 0 ? 'owed ' : 'owes '}
                              {formatCents(net)}
                            </Text>
                          );
                        })()}
                        {m.role === 'owner' ? (
                          <Text style={styles.memberSub}>Owner</Text>
                        ) : m.userId !== me ? (
                          <LinkButton title="Remove" danger onPress={() => confirmRemove(m.userId, m.displayName, m.email)} />
                        ) : null}
                      </View>
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
  addBar: { padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  feedTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  feedSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  feedAmount: { fontSize: 16, fontWeight: '700', color: colors.text },
  struck: { textDecorationLine: 'line-through', color: colors.muted },
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
  tripHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  tripThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tripThumbImage: { width: '100%', height: '100%' },
  tripDates: { fontSize: 14, fontWeight: '600', color: colors.text },
  summarySub: { fontSize: 13, color: colors.muted },
  summaryTitle: { fontSize: 28, fontWeight: '800', color: colors.text, marginTop: 2 },
  tabs: {
    flexDirection: 'row',
    gap: spacing.lg,
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
  memberNet: { fontSize: 14, fontWeight: '700' },
});

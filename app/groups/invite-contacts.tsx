import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, EmptyState, LinkButton } from '@/components/ui';
import { inviteByEmail } from '@/lib/groups';
import { colors, spacing } from '@/lib/theme';

type ContactRow = { id: string; name: string; email: string | null };
type Status = 'loading' | 'denied' | 'ready' | 'error';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function messageOf(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
}

export default function InviteFromContacts() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const [status, setStatus] = useState<Status>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Only for contacts with no email on file -- required before they can be invited.
  const [manualEmails, setManualEmails] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const perm = await Contacts.requestPermissionsAsync();
        if (!perm.granted) {
          setStatus('denied');
          return;
        }
        const rows = await Contacts.Contact.getAllDetails(
          [Contacts.ContactField.FULL_NAME, Contacts.ContactField.EMAILS],
          { sortOrder: Contacts.ContactsSortOrder.GivenName }
        );
        setContacts(
          rows
            .filter((c) => c.fullName?.trim())
            .map((c) => ({ id: c.id, name: c.fullName!.trim(), email: c.emails?.[0]?.address?.trim() || null }))
        );
        setStatus('ready');
      } catch (err) {
        setLoadError(messageOf(err));
        setStatus('error');
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? contacts.filter((c) => c.name.toLowerCase().includes(q)) : contacts;
  }, [contacts, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedRows = contacts.filter((c) => selected.has(c.id));
  const emailFor = (c: ContactRow) => c.email ?? (manualEmails[c.id] ?? '').trim();
  const invalidCount = selectedRows.filter((c) => !EMAIL_RE.test(emailFor(c))).length;
  const canSend = !sending && selectedRows.length > 0 && invalidCount === 0;

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    try {
      for (const c of selectedRows) {
        await inviteByEmail(groupId, emailFor(c));
      }
      router.back();
    } catch (err) {
      Alert.alert('Could not send invites', messageOf(err));
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.navAction}>Cancel</Text>
        </Pressable>
        <Text style={styles.navTitle}>Invite from contacts</Text>
        <Pressable accessibilityRole="button" onPress={handleSend} disabled={!canSend} hitSlop={8}>
          {sending ? (
            <ActivityIndicator />
          ) : (
            <Text style={[styles.navAction, styles.navPrimary, !canSend && { opacity: 0.4 }]}>
              {selectedRows.length > 0 ? `Invite (${selectedRows.length})` : 'Invite'}
            </Text>
          )}
        </Pressable>
      </View>
      {selectedRows.length > 0 && invalidCount > 0 && (
        <Text style={styles.missingBanner}>
          Enter an email for {invalidCount === 1 ? 'the contact' : `all ${invalidCount} contacts`} below marked in red.
        </Text>
      )}

      {status === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : status === 'denied' ? (
        <View style={styles.center}>
          <EmptyState
            icon="people-outline"
            title="Contacts access is off"
            message="Enable it in Settings to invite people from your contacts, or share an invite code instead."
          >
            <LinkButton title="Go back" onPress={() => router.back()} />
          </EmptyState>
        </View>
      ) : status === 'error' ? (
        <View style={styles.center}>
          <EmptyState icon="alert-circle-outline" title="Couldn't load contacts" message={loadError ?? ''}>
            <LinkButton title="Go back" onPress={() => router.back()} />
          </EmptyState>
        </View>
      ) : contacts.length === 0 ? (
        <View style={styles.center}>
          <EmptyState icon="people-outline" title="No contacts found" message="Nothing to show here." />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search contacts"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(c) => c.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = selected.has(item.id);
              const needsEmail = isSelected && !item.email;
              const value = needsEmail ? (manualEmails[item.id] ?? '') : '';
              const invalid = isSelected && !EMAIL_RE.test(emailFor(item));
              return (
                <View style={styles.row}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    onPress={() => toggle(item.id)}
                    style={styles.rowMain}
                  >
                    <View style={[styles.check, isSelected && styles.checkOn]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color={colors.onPrimary} />}
                    </View>
                    <Avatar name={item.name} size={36} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.email && (
                        <Text style={styles.email} numberOfLines={1}>
                          {item.email}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                  {needsEmail && (
                    <TextInput
                      value={value}
                      onChangeText={(text) => setManualEmails((prev) => ({ ...prev, [item.id]: text }))}
                      placeholder="Enter their email"
                      placeholderTextColor={colors.muted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={[styles.manualInput, invalid && value.length > 0 && styles.manualInputInvalid]}
                    />
                  )}
                </View>
              );
            }}
          />
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
  missingBanner: { textAlign: 'center', fontSize: 13, color: colors.negative, backgroundColor: colors.surface, paddingVertical: 8 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, padding: 0 },
  row: { paddingHorizontal: spacing.lg, paddingVertical: 8 },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
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
  name: { fontSize: 16, color: colors.text },
  email: { fontSize: 13, color: colors.muted, marginTop: 1 },
  manualInput: {
    marginLeft: 34 + 36 + 12 + 12, // align under the name, past checkbox + avatar + gaps
    marginTop: 6,
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
  },
  manualInputInvalid: { borderColor: colors.negative },
});

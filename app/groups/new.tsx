import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SectionLabel } from '@/components/ui';
import { createGroup } from '@/lib/groups';
import { colors, spacing } from '@/lib/theme';

export default function NewGroup() {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const canCreate = name.trim().length > 0 && !busy;

  async function handleCreate() {
    setBusy(true);
    try {
      const id = await createGroup(name);
      router.replace({ pathname: '/groups/[id]', params: { id, tab: 'members' } });
    } catch (err) {
      Alert.alert('Could not create group', err instanceof Error ? err.message : 'Please try again.');
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.nav}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.navAction}>Cancel</Text>
          </Pressable>
          <Text style={styles.navTitle}>New group</Text>
          <Pressable accessibilityRole="button" onPress={handleCreate} disabled={!canCreate} hitSlop={8}>
            <Text style={[styles.navAction, styles.navPrimary, !canCreate && { opacity: 0.4 }]}>Create</Text>
          </Pressable>
        </View>
        <View style={styles.body}>
          <SectionLabel>Group name</SectionLabel>
          <TextInput
            autoFocus
            value={name}
            onChangeText={setName}
            placeholder="Apt 4B"
            placeholderTextColor={colors.muted}
            maxLength={100}
            returnKeyType="done"
            onSubmitEditing={() => canCreate && handleCreate()}
            style={styles.input}
          />
          <Text style={styles.hint}>
            After you create it, you'll get an invite link and code to share with the people in your group.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
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
  navAction: { fontSize: 17, color: colors.muted },
  navPrimary: { color: colors.primary, fontWeight: '700' },
  body: { paddingHorizontal: spacing.lg },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 17,
    color: colors.text,
  },
  hint: { marginTop: spacing.md, fontSize: 14, color: colors.muted, lineHeight: 20 },
});

import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton, SectionLabel } from '@/components/ui';
import { joinGroupWithCode } from '@/lib/groups';
import { colors, spacing } from '@/lib/theme';

export default function JoinWithCode() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleJoin() {
    setBusy(true);
    try {
      const id = await joinGroupWithCode(code);
      router.replace({ pathname: '/groups/[id]', params: { id } });
    } catch (err) {
      Alert.alert('Could not join', err instanceof Error ? err.message : 'Please try again.');
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.nav}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>Join a group</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.body}>
          <SectionLabel>Invite code</SectionLabel>
          <TextInput
            autoFocus
            autoCapitalize="characters"
            autoCorrect={false}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\s/g, ''))}
            placeholder="K7QP2M9X41"
            placeholderTextColor={colors.muted}
            maxLength={16}
            style={styles.input}
          />
          <View style={{ marginTop: spacing.lg }}>
            <PrimaryButton title="Join group" onPress={handleJoin} disabled={code.length < 4} loading={busy} />
          </View>
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
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  cancel: { fontSize: 17, color: colors.muted },
  body: { paddingHorizontal: spacing.lg },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 20,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
});

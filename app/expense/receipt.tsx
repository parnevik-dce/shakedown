import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, LinkButton } from '@/components/ui';
import { getReceiptUrl } from '@/lib/receipts';
import { colors, spacing } from '@/lib/theme';

function messageOf(err: unknown) {
  return err instanceof Error ? err.message : 'Could not load the receipt.';
}

/** Full-screen receipt viewer. Pass either `uri` (a local/preview uri) or `path` (a storage path to sign). */
export default function ReceiptViewer() {
  const { uri, path } = useLocalSearchParams<{ uri?: string; path?: string }>();
  const [resolvedUri, setResolvedUri] = useState<string | null>(uri ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (uri || !path) return;
    getReceiptUrl(path).then(setResolvedUri, (err) => setError(messageOf(err)));
  }, [uri, path]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.done}>Done</Text>
        </Pressable>
        <Text style={styles.title}>Receipt</Text>
        <View style={{ width: 44 }} />
      </View>
      <View style={styles.body}>
        {error ? (
          <EmptyState icon="alert-circle-outline" title="Couldn't load receipt" message={error}>
            <LinkButton title="Back" onPress={() => router.back()} />
          </EmptyState>
        ) : !resolvedUri ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <Image source={{ uri: resolvedUri }} style={styles.image} resizeMode="contain" />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { fontSize: 15, fontWeight: '600', color: '#fff' },
  done: { fontSize: 17, color: '#fff', width: 60 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
});

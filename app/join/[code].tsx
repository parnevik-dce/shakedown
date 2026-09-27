import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { EmptyState, LinkButton } from '@/components/ui';
import { joinGroupWithCode } from '@/lib/groups';
import { colors } from '@/lib/theme';

/** Opened by an invite link (shakedown://join/CODE): joins the group, then shows it. */
export default function JoinFromLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !code) return;
    started.current = true;
    joinGroupWithCode(code)
      .then((id) => router.replace({ pathname: '/groups/[id]', params: { id } }))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not join this group.'));
  }, [code]);

  return (
    <View style={styles.screen}>
      {error ? (
        <EmptyState icon="alert-circle-outline" title="Couldn't join" message={error}>
          <LinkButton title="Back to groups" onPress={() => router.replace('/')} />
        </EmptyState>
      ) : (
        <ActivityIndicator />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});

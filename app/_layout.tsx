import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';

import { SessionProvider, useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

function RootNavigator() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="groups/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="groups/new-group" options={{ presentation: 'modal' }} />
        <Stack.Screen name="groups/trip" options={{ presentation: 'modal' }} />
        <Stack.Screen name="groups/[id]" />
        <Stack.Screen name="expense/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="expense/[id]" />
        {/* Default (card) presentation: a fullScreenModal pushed from a screen that is
            itself presented as 'modal' (expense/new) confuses iOS's modal transition and
            can leave the UI unresponsive on dismiss. */}
        <Stack.Screen name="expense/receipt" options={{ headerShown: false }} />
        <Stack.Screen name="settlement/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settlement/history" />
        <Stack.Screen name="settlement/[id]" />
        <Stack.Screen name="join/index" options={{ presentation: 'modal' }} />
        <Stack.Screen name="join/[code]" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </SessionProvider>
  );
}

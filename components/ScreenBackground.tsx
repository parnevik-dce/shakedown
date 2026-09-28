import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/lib/theme';

/**
 * Ambient red/gold glow behind screen content, like dim light on an old ledger --
 * cheap to render (plain Views, no image/blur library) but reads as a deliberate
 * "Shakedown" background rather than flat paper. Used on the screens people see most/first.
 */
export function ScreenBackground({ children }: { children: ReactNode }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.blobTop} pointerEvents="none" />
      <View style={styles.blobBottom} pointerEvents="none" />
      <View style={styles.wash} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  blobTop: {
    position: 'absolute',
    top: -140,
    right: -120,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: colors.blobB,
    opacity: 0.16,
  },
  blobBottom: {
    position: 'absolute',
    bottom: -160,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.blobA,
    opacity: 0.14,
  },
  wash: {
    position: 'absolute',
    top: '38%',
    left: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: colors.accent,
    opacity: 0.06,
  },
});

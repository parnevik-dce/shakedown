import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '@/lib/theme';

export function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.primary, (disabled || loading) && styles.disabled, pressed && styles.pressed]}
    >
      {loading ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryText}>{title}</Text>}
    </Pressable>
  );
}

export function LinkButton({ title, onPress, danger }: { title: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
      <Text style={[styles.link, danger && { color: colors.negative }]}>{title}</Text>
    </Pressable>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.muted} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      {children}
    </View>
  );
}

export function Avatar({ name, size = 40, style }: { name: string; size?: number; style?: ViewStyle }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2 }, styles.avatar, style]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials || '?'}</Text>
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

const styles = StyleSheet.create({
  primary: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  primaryText: { color: colors.onPrimary, fontSize: 17, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  link: { color: colors.primary, fontSize: 15, textDecorationLine: 'underline' },
  empty: { alignItems: 'center', paddingHorizontal: spacing.xl, gap: spacing.md },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  emptyMessage: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 21, marginBottom: spacing.sm },
  avatar: { backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontWeight: '700' },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.muted,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
});

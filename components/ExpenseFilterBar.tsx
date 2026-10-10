import { useState } from 'react';
import { ActionSheetIOS, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SORT_OPTIONS, type Person, type SortKey } from '@/lib/expenseFilters';
import { colors, radii, spacing } from '@/lib/theme';

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  personId: string | null;
  onPersonChange: (id: string | null) => void;
  people: Person[];
  me: string;
};

const DEFAULT_SORT: SortKey = 'date-desc';

function Chip({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={15} color={active ? colors.primary : colors.muted} />
      <Text style={[styles.chipText, active && { color: colors.primary }]} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="chevron-down" size={13} color={active ? colors.primary : colors.muted} />
    </Pressable>
  );
}

export function ExpenseFilterBar({
  query,
  onQueryChange,
  sort,
  onSortChange,
  personId,
  onPersonChange,
  people,
  me,
}: Props) {
  // Search starts hidden; it stays open if there's already a query (e.g. coming back to the tab).
  const [searchOpen, setSearchOpen] = useState(query !== '');
  const sortLabel = SORT_OPTIONS.find((o) => o.key === sort)?.short ?? '';
  const person = people.find((p) => p.userId === personId);
  const personLabel = person ? (person.userId === me ? 'You' : person.name) : 'Everyone';

  function pickSort() {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Sort expenses',
        options: [...SORT_OPTIONS.map((o) => o.label), 'Cancel'],
        cancelButtonIndex: SORT_OPTIONS.length,
      },
      (i) => {
        if (i < SORT_OPTIONS.length) onSortChange(SORT_OPTIONS[i].key);
      }
    );
  }

  function pickPerson() {
    const labels = ['Everyone', ...people.map((p) => (p.userId === me ? 'You' : p.name))];
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Split with', options: [...labels, 'Cancel'], cancelButtonIndex: labels.length },
      (i) => {
        if (i === 0) onPersonChange(null);
        else if (i < labels.length) onPersonChange(people[i - 1].userId);
      }
    );
  }

  function toggleSearch() {
    // Hiding the field also clears it, so results are never filtered by a search you can't see.
    if (searchOpen) onQueryChange('');
    setSearchOpen(!searchOpen);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        <Chip icon="swap-vertical" label={sortLabel} active={sort !== DEFAULT_SORT} onPress={pickSort} />
        <Chip icon="person-outline" label={personLabel} active={personId !== null} onPress={pickPerson} />
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={searchOpen ? 'Hide search' : 'Search expenses'}
          onPress={toggleSearch}
          hitSlop={6}
          style={({ pressed }) => [styles.searchToggle, searchOpen && styles.chipActive, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name={searchOpen ? 'close' : 'search'} size={18} color={searchOpen ? colors.primary : colors.muted} />
        </Pressable>
      </View>
      {searchOpen && (
        <View style={styles.search}>
          <Ionicons name="search" size={17} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search description or amount"
            placeholderTextColor={colors.muted}
            style={styles.input}
            returnKeyType="search"
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            accessibilityLabel="Search expenses"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 10 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchToggle: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.surface },
  chipText: { flexShrink: 1, fontSize: 13, fontWeight: '600', color: colors.muted },
});

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, EmptyState, LinkButton, SectionLabel } from '@/components/ui';
import { fromDateString } from '@/lib/expenses';
import { createTrip, fetchGroup, TRIP_ICONS, updateTrip, type TripIcon } from '@/lib/groups';
import type { PickedImage } from '@/lib/images';
import { chooseCoverPhoto, getTripCoverUrl, removeTripCover, takeCoverPhoto, uploadTripCover } from '@/lib/tripCovers';
import { useSession } from '@/lib/session';
import { colors, spacing } from '@/lib/theme';

function messageOf(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
}

export default function TripForm() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const { session } = useSession();
  const me = session!.user.id;
  const editing = !!groupId;

  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState('You');

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  const [icon, setIcon] = useState<TripIcon | null>(null);
  const [coverPath, setCoverPath] = useState<string | null>(null); // already-uploaded path
  const [coverPreview, setCoverPreview] = useState<string | null>(null); // local uri or signed url
  const [pickedImage, setPickedImage] = useState<PickedImage | null>(null); // not yet uploaded
  const [coverChanged, setCoverChanged] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    fetchGroup(groupId).then(
      (g) => {
        setName(g.name);
        if (g.startDate) setStartDate(fromDateString(g.startDate));
        if (g.endDate) setEndDate(fromDateString(g.endDate));
        setIcon((g.icon as TripIcon) ?? null);
        if (g.coverImagePath) {
          setCoverPath(g.coverImagePath);
          getTripCoverUrl(g.coverImagePath).then(setCoverPreview).catch(() => {});
        }
        const owner = g.members.find((m) => m.role === 'owner');
        if (owner) setOwnerName(owner.userId === me ? 'You' : owner.displayName);
        setLoading(false);
      },
      (err) => {
        setLoadError(messageOf(err));
        setLoading(false);
      }
    );
  }, [groupId, me]);

  const hasName = name.trim().length > 0;
  const datesValid = endDate.getTime() >= new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
  const canSave = !saving && hasName && datesValid;
  const missingText = !hasName ? 'Enter a trip title to save.' : !datesValid ? 'The end date must be on or after the start date.' : null;

  function pickCover() {
    Alert.alert('Trip cover', undefined, [
      { text: 'Take Photo', onPress: () => handlePickPhoto('camera') },
      { text: 'Choose from Library', onPress: () => handlePickPhoto('library') },
      { text: 'Choose an Icon', onPress: () => setShowIconPicker(true) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handlePickPhoto(source: 'camera' | 'library') {
    setCoverBusy(true);
    try {
      const picked = source === 'camera' ? await takeCoverPhoto() : await chooseCoverPhoto();
      if (!picked) return;
      setPickedImage(picked);
      setCoverPreview(picked.uri);
      setIcon(null);
      setShowIconPicker(false);
      setCoverChanged(true);
    } catch (err) {
      Alert.alert('Could not set cover', messageOf(err));
    } finally {
      setCoverBusy(false);
    }
  }

  function chooseIcon(next: TripIcon) {
    setIcon(next);
    setPickedImage(null);
    setCoverPreview(null);
    setShowIconPicker(false);
    setCoverChanged(true); // clears any saved cover photo too
  }

  function clearCover() {
    setPickedImage(null);
    setCoverPreview(null);
    setIcon(null);
    setCoverChanged(coverPath !== null);
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      if (editing) {
        let nextCoverPath = coverPath;
        if (coverChanged) {
          if (pickedImage) {
            nextCoverPath = await uploadTripCover(groupId, pickedImage);
            // A GIF and a JPEG live at different filenames, so the old one is orphaned otherwise.
            if (coverPath && coverPath !== nextCoverPath) await removeTripCover(coverPath).catch(() => {});
          } else {
            if (coverPath) await removeTripCover(coverPath).catch(() => {});
            nextCoverPath = null;
          }
        }
        await updateTrip(groupId, { name, startDate, endDate, coverImagePath: nextCoverPath, icon });
        router.back();
      } else {
        const id = await createTrip({ name, startDate, endDate, icon: icon ?? undefined });
        if (pickedImage) {
          const path = await uploadTripCover(id, pickedImage);
          await updateTrip(id, { name, startDate, endDate, coverImagePath: path });
        }
        router.replace({ pathname: '/groups/[id]', params: { id, tab: 'members' } });
      }
    } catch (err) {
      Alert.alert(editing ? 'Could not save trip' : 'Could not create trip', messageOf(err));
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.navAction}>Cancel</Text>
        </Pressable>
        <Text style={styles.navTitle}>{editing ? 'Edit trip' : 'New trip'}</Text>
        <Pressable accessibilityRole="button" onPress={handleSave} disabled={!canSave} hitSlop={8}>
          {saving ? <ActivityIndicator /> : <Text style={[styles.navAction, styles.navPrimary, !canSave && { opacity: 0.4 }]}>{editing ? 'Save' : 'Create'}</Text>}
        </Pressable>
      </View>
      {missingText && <Text style={styles.missingBanner}>{missingText}</Text>}

      {loadError ? (
        <View style={styles.center}>
          <EmptyState icon="alert-circle-outline" title="Can't open this trip" message={loadError}>
            <LinkButton title="Go back" onPress={() => router.back()} />
          </EmptyState>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 48 }}>
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
              <Pressable accessibilityRole="button" onPress={pickCover} disabled={coverBusy} style={styles.coverBox}>
                {coverBusy ? (
                  <ActivityIndicator />
                ) : coverPreview ? (
                  <Image source={{ uri: coverPreview }} style={styles.coverImage} />
                ) : icon ? (
                  <Ionicons name={icon} size={40} color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={26} color={colors.muted} />
                    <Text style={styles.coverEmptyText}>Choose photo or icon</Text>
                  </>
                )}
              </Pressable>
              {(coverPreview || icon) && (
                <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm }}>
                  <LinkButton title="Change" onPress={pickCover} />
                  <LinkButton title="Remove" danger onPress={clearCover} />
                </View>
              )}
              {showIconPicker && (
                <View style={styles.iconGrid}>
                  {TRIP_ICONS.map((key) => (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      onPress={() => chooseIcon(key)}
                      style={[styles.iconOption, icon === key && styles.iconOptionActive]}
                    >
                      <Ionicons name={key} size={22} color={icon === key ? colors.onPrimary : colors.primary} />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
              <SectionLabel>Trip title *</SectionLabel>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Tahoe, Labor Day"
                placeholderTextColor={colors.muted}
                maxLength={100}
                style={styles.input}
              />
            </View>

            <View style={[styles.rows, { marginTop: spacing.lg }]}>
              <Pressable style={styles.row} onPress={() => setShowStart((v) => !v)} accessibilityRole="button">
                <Text style={styles.rowLabel}>Starts</Text>
                <Text style={styles.rowValue}>
                  {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                <Ionicons name={showStart ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.muted} />
              </Pressable>
              {showStart && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display="inline"
                  onChange={(_, d) => d && setStartDate(d)}
                />
              )}
              <Pressable style={styles.row} onPress={() => setShowEnd((v) => !v)} accessibilityRole="button">
                <Text style={styles.rowLabel}>Ends</Text>
                <Text style={styles.rowValue}>
                  {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                <Ionicons name={showEnd ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.muted} />
              </Pressable>
              {showEnd && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display="inline"
                  minimumDate={startDate}
                  onChange={(_, d) => d && setEndDate(d)}
                />
              )}
            </View>

            <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
              <SectionLabel>Members</SectionLabel>
              <View style={styles.memberRow}>
                <Avatar name={ownerName} size={34} />
                <Text style={styles.memberName}>{ownerName}</Text>
                <Text style={styles.memberRole}>Owner</Text>
              </View>
              {!editing && (
                <Text style={styles.hint}>
                  After you create it, you'll get an invite link and code to share with the people on the trip.
                </Text>
              )}
            </View>
          </ScrollView>
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
  coverBox: {
    height: 140,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  coverImage: { width: '100%', height: '100%' },
  coverEmptyText: { fontSize: 14, color: colors.muted },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 17,
    color: colors.text,
  },
  rows: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { width: 96, fontSize: 15, color: colors.muted },
  rowValue: { flex: 1, fontSize: 16, color: colors.text },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  memberName: { flex: 1, fontSize: 16, color: colors.text },
  memberRole: { fontSize: 14, color: colors.muted },
  hint: { marginTop: spacing.sm, fontSize: 13, color: colors.muted, lineHeight: 18 },
});

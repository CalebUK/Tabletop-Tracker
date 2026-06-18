import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackProps } from '../navigation';
import { getGame, getAllTags, saveGame, deleteGame } from '../db/games';
import { deleteImage, pickFromLibrary, takePhoto } from '../lib/images';
import { bggSearch, bggDetails, BggSearchResult } from '../lib/bgg';
import { ocrImage } from '../lib/identify';
import { GameInput } from '../types';
import { colors, radius, spacing } from '../theme';
import StarRating from '../components/StarRating';

const EMPTY: GameInput = {
  name: '',
  imageUri: null,
  location: null,
  year: null,
  minPlayers: null,
  maxPlayers: null,
  playTimeMin: null,
  rating: null,
  notes: null,
  houseRules: null,
  isFavorite: false,
  bggId: null,
  bggRating: null,
  developer: null,
  tags: [],
};

function numOrNull(s: string): number | null {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

export default function EditGameScreen({ route, navigation }: RootStackProps<'EditGame'>) {
  const editingId = route.params?.gameId;
  const [form, setForm] = useState<GameInput>(EMPTY);
  const [tagText, setTagText] = useState('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [bggOpen, setBggOpen] = useState(false);
  const [bggLoading, setBggLoading] = useState(false);
  const [bggResults, setBggResults] = useState<BggSearchResult[]>([]);
  const [bggError, setBggError] = useState<string | null>(null);
  const [photoMenu, setPhotoMenu] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: editingId ? 'Edit Game' : 'Add Game' });
    getAllTags().then(setAllTags).catch(() => {});
    if (editingId) {
      getGame(editingId).then((g) => {
        if (!g) return;
        setForm({
          id: g.id,
          name: g.name,
          imageUri: g.imageUri,
          location: g.location,
          year: g.year,
          minPlayers: g.minPlayers,
          maxPlayers: g.maxPlayers,
          playTimeMin: g.playTimeMin,
          rating: g.rating,
          notes: g.notes,
          houseRules: g.houseRules,
          isFavorite: g.isFavorite,
          bggId: g.bggId,
          bggRating: g.bggRating,
          developer: g.developer,
          tags: g.tags,
        });
        setOriginalImage(g.imageUri);
      });
    }
  }, [editingId]);

  // When we come back from the barcode scanner with a chosen BGG id, pull its
  // details and pre-fill the form.
  const bggIdParam = route.params?.bggId;
  useEffect(() => {
    if (bggIdParam) applyBggId(bggIdParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bggIdParam]);

  function patch(p: Partial<GameInput>) {
    setForm((f) => ({ ...f, ...p }));
  }

  async function doTakePhoto() {
    setPhotoMenu(false);
    const uri = await takePhoto();
    if (uri) patch({ imageUri: uri });
  }

  async function doPickPhoto() {
    setPhotoMenu(false);
    const uri = await pickFromLibrary();
    if (uri) patch({ imageUri: uri });
  }

  function doRemovePhoto() {
    setPhotoMenu(false);
    patch({ imageUri: null });
  }

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag) return;
    if (!form.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      patch({ tags: [...form.tags, tag] });
    }
    setTagText('');
  }

  function removeTag(tag: string) {
    patch({ tags: form.tags.filter((t) => t !== tag) });
  }

  // Search BoardGameGeek for the name currently typed and open the picker.
  async function openBggSearch() {
    if (!form.name.trim()) {
      Alert.alert('Type a name first', 'Enter the game name, then look it up on BoardGameGeek.');
      return;
    }
    setBggOpen(true);
    setBggLoading(true);
    setBggError(null);
    setBggResults([]);
    try {
      const results = await bggSearch(form.name);
      setBggResults(results);
      if (results.length === 0) setBggError('No matches on BoardGameGeek.');
    } catch (e) {
      setBggError('Could not reach BoardGameGeek. Check your connection.');
    } finally {
      setBggLoading(false);
    }
  }

  // Pull full BGG details for an id and fill in fields the user hasn't set.
  async function applyBggId(id: number) {
    const d = await bggDetails(id);
    if (!d) return;
    setForm((f) => ({
      ...f,
      name: d.name || f.name,
      year: d.year ?? f.year,
      minPlayers: d.minPlayers ?? f.minPlayers,
      maxPlayers: d.maxPlayers ?? f.maxPlayers,
      playTimeMin: d.playTimeMin ?? f.playTimeMin,
      developer: d.developer ?? f.developer,
      bggId: d.id,
      bggRating: d.bggRating ?? f.bggRating,
      // Use the BGG cover only if the user hasn't added their own photo.
      imageUri: f.imageUri ?? d.imageUrl,
    }));
  }

  // Pull full details for a chosen BGG result and fill the empty fields.
  async function applyBggResult(r: BggSearchResult) {
    setBggLoading(true);
    try {
      await applyBggId(r.id);
      setBggOpen(false);
    } catch (e) {
      setBggError('Could not load that game from BoardGameGeek.');
    } finally {
      setBggLoading(false);
    }
  }

  // Choose/refresh the photo, then run OCR on it to guess the name and search BGG.
  async function scanNameFromPhoto() {
    setPhotoMenu(false);
    let uri = form.imageUri;
    if (!uri) {
      uri = await pickFromLibrary();
      if (!uri) return;
      patch({ imageUri: uri });
    }
    setOcrLoading(true);
    try {
      const guess = await ocrImage(uri);
      if (!guess) {
        Alert.alert('Nothing readable', "Couldn't read a name from that photo. Try a clearer shot of the title.");
        return;
      }
      patch({ name: guess });
      // Hand the guess straight to the BGG picker for confirmation.
      setBggOpen(true);
      setBggLoading(true);
      setBggError(null);
      setBggResults([]);
      try {
        const results = await bggSearch(guess);
        setBggResults(results);
        if (results.length === 0) setBggError(`No BGG match for "${guess}". Edit the name and try again.`);
      } catch {
        setBggError('Could not reach BoardGameGeek.');
      } finally {
        setBggLoading(false);
      }
    } catch (e: any) {
      Alert.alert('OCR failed', e?.message ?? 'Could not read this image.');
    } finally {
      setOcrLoading(false);
    }
  }

  async function onSave() {
    if (!form.name.trim()) {
      Alert.alert('Name required', 'Please enter a name for the game.');
      return;
    }
    // If the photo changed, clean up the old file so storage doesn't leak.
    if (originalImage && originalImage !== form.imageUri) {
      await deleteImage(originalImage);
    }
    await saveGame({ ...form, name: form.name.trim() });
    navigation.goBack();
  }

  function onDelete() {
    if (!editingId) return;
    Alert.alert('Delete game?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteImage(form.imageUri);
          await deleteGame(editingId);
          navigation.navigate('Tabs');
        },
      },
    ]);
  }

  // Previously-used tags not already on this game, narrowed by what's typed.
  const suggestions = allTags
    .filter((t) => !form.tags.some((x) => x.toLowerCase() === t.toLowerCase()))
    .filter((t) => !tagText.trim() || t.toLowerCase().includes(tagText.trim().toLowerCase()));

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.photo} onPress={() => setPhotoMenu(true)}>
            {form.imageUri ? (
              <Image source={{ uri: form.imageUri }} style={styles.photoImg} />
            ) : (
              <View style={styles.photoEmpty}>
                <Text style={styles.photoEmoji}>📷</Text>
                <Text style={styles.photoLabel}>Add photo</Text>
              </View>
            )}
          </Pressable>

          <Field label="Name *">
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(v) => patch({ name: v })}
              placeholder="e.g. Wingspan"
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.identifyRow}>
              <Pressable style={styles.identifyBtn} onPress={openBggSearch}>
                <Text style={styles.identifyText}>🔍 BGG</Text>
              </Pressable>
              <Pressable
                style={styles.identifyBtn}
                onPress={() => navigation.navigate('ScanBarcode', { gameId: editingId })}
              >
                <Text style={styles.identifyText}>📷 Barcode</Text>
              </Pressable>
              <Pressable style={styles.identifyBtn} onPress={scanNameFromPhoto}>
                <Text style={styles.identifyText}>🔤 Scan name</Text>
              </Pressable>
            </View>
            {form.bggRating != null && (
              <Text style={styles.bggLinked}>
                ✓ Linked to BGG · rating {form.bggRating.toFixed(1)}
              </Text>
            )}
          </Field>

          <Field label="Storage location">
            <TextInput
              style={styles.input}
              value={form.location ?? ''}
              onChangeText={(v) => patch({ location: v || null })}
              placeholder="e.g. Hall closet, top shelf"
              placeholderTextColor={colors.textMuted}
            />
          </Field>

          <View style={styles.row}>
            <Field label="Min players" style={styles.flex1}>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={form.minPlayers?.toString() ?? ''}
                onChangeText={(v) => patch({ minPlayers: numOrNull(v) })}
                placeholder="1"
                placeholderTextColor={colors.textMuted}
              />
            </Field>
            <Field label="Max players" style={styles.flex1}>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={form.maxPlayers?.toString() ?? ''}
                onChangeText={(v) => patch({ maxPlayers: numOrNull(v) })}
                placeholder="4"
                placeholderTextColor={colors.textMuted}
              />
            </Field>
          </View>

          <View style={styles.row}>
            <Field label="Play time (min)" style={styles.flex1}>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={form.playTimeMin?.toString() ?? ''}
                onChangeText={(v) => patch({ playTimeMin: numOrNull(v) })}
                placeholder="45"
                placeholderTextColor={colors.textMuted}
              />
            </Field>
            <Field label="Year" style={styles.flex1}>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={form.year?.toString() ?? ''}
                onChangeText={(v) => patch({ year: numOrNull(v) })}
                placeholder="2019"
                placeholderTextColor={colors.textMuted}
              />
            </Field>
          </View>

          <Field label="Developer">
            <TextInput
              style={styles.input}
              value={form.developer ?? ''}
              onChangeText={(v) => patch({ developer: v || null })}
              placeholder="e.g. Elizabeth Hargrave"
              placeholderTextColor={colors.textMuted}
            />
          </Field>

          <Field label={`My rating${form.rating ? ` · ${form.rating}/10` : ''}`}>
            <StarRating
              value={form.rating}
              max={10}
              size={26}
              editable
              onChange={(v) => patch({ rating: v })}
            />
          </Field>

          <View style={styles.switchRow}>
            <Text style={styles.label}>Favorite</Text>
            <Switch
              value={form.isFavorite}
              onValueChange={(v) => patch({ isFavorite: v })}
              trackColor={{ true: colors.favorite, false: colors.border }}
            />
          </View>

          <Field label="Tags">
            <View style={styles.chipWrap}>
              {form.tags.map((t) => (
                <Pressable key={t} style={styles.chipActive} onPress={() => removeTag(t)}>
                  <Text style={styles.chipActiveText}>{t} ✕</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={tagText}
              onChangeText={setTagText}
              onSubmitEditing={() => addTag(tagText)}
              placeholder="Type a tag and press return"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              returnKeyType="done"
            />
            {suggestions.length > 0 && (
              <View style={styles.chipWrap}>
                {suggestions.slice(0, 12).map((t) => (
                  <Pressable key={t} style={styles.chip} onPress={() => addTag(t)}>
                    <Text style={styles.chipText}>+ {t}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Field>

          <Field label="Notes">
            <TextInput
              style={[styles.input, styles.multiline]}
              value={form.notes ?? ''}
              onChangeText={(v) => patch({ notes: v || null })}
              placeholder="General notes about the game…"
              placeholderTextColor={colors.textMuted}
              multiline
            />
          </Field>

          <Field label="House rules">
            <TextInput
              style={[styles.input, styles.multiline]}
              value={form.houseRules ?? ''}
              onChangeText={(v) => patch({ houseRules: v || null })}
              placeholder="Any variants or house rules…"
              placeholderTextColor={colors.textMuted}
              multiline
            />
          </Field>

          <Pressable style={styles.saveBtn} onPress={onSave}>
            <Text style={styles.saveBtnText}>{editingId ? 'Save Changes' : 'Add Game'}</Text>
          </Pressable>

          {editingId && (
            <Pressable style={styles.deleteBtn} onPress={onDelete}>
              <Text style={styles.deleteBtnText}>Delete Game</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={bggOpen} animationType="slide" transparent onRequestClose={() => setBggOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>BoardGameGeek</Text>
              <Pressable onPress={() => setBggOpen(false)} hitSlop={10}>
                <Text style={styles.modalClose}>Close</Text>
              </Pressable>
            </View>

            {bggLoading && <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />}
            {bggError && !bggLoading ? <Text style={styles.modalError}>{bggError}</Text> : null}

            {!bggLoading && (
              <FlatList
                data={bggResults}
                keyExtractor={(r) => String(r.id)}
                renderItem={({ item }) => (
                  <Pressable style={styles.bggResult} onPress={() => applyBggResult(item)}>
                    <Text style={styles.bggResultName}>{item.name}</Text>
                    {item.year ? <Text style={styles.bggResultYear}>{item.year}</Text> : null}
                  </Pressable>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={photoMenu} animationType="slide" transparent onRequestClose={() => setPhotoMenu(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPhotoMenu(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Photo</Text>
            <Pressable style={styles.sheetItem} onPress={doTakePhoto}>
              <Text style={styles.sheetItemText}>📸  Take Photo</Text>
            </Pressable>
            <Pressable style={styles.sheetItem} onPress={doPickPhoto}>
              <Text style={styles.sheetItemText}>🖼  Choose from Library</Text>
            </Pressable>
            <Pressable style={styles.sheetItem} onPress={scanNameFromPhoto}>
              <Text style={styles.sheetItemText}>🔤  Scan name from photo</Text>
            </Pressable>
            {form.imageUri ? (
              <Pressable style={styles.sheetItem} onPress={doRemovePhoto}>
                <Text style={[styles.sheetItemText, { color: colors.danger }]}>🗑  Remove Photo</Text>
              </Pressable>
            ) : null}
            <Pressable style={[styles.sheetItem, styles.sheetCancel]} onPress={() => setPhotoMenu(false)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {ocrLoading && (
        <View style={styles.ocrOverlay}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.ocrText}>Reading the photo…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
  photo: { alignSelf: 'center', marginBottom: spacing.sm },
  photoImg: { width: 160, height: 160, borderRadius: radius.lg },
  photoEmpty: {
    width: 160,
    height: 160,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmoji: { fontSize: 36 },
  photoLabel: { color: colors.textMuted, marginTop: 6 },
  field: { gap: 6 },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: spacing.md },
  flex1: { flex: 1 },
  identifyRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 2 },
  identifyBtn: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  identifyText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  bggLinked: { color: colors.success, fontSize: 12, marginTop: 2 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sheetTitle: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginBottom: spacing.xs },
  sheetItem: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  sheetItemText: { color: colors.text, fontSize: 16 },
  sheetCancel: { backgroundColor: 'transparent', alignItems: 'center' },
  sheetCancelText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  ocrOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  ocrText: { color: colors.text, fontSize: 15 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  modalClose: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  modalError: { color: colors.textMuted, textAlign: 'center', marginVertical: spacing.xl },
  bggResult: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bggResultName: { color: colors.text, fontSize: 15, flex: 1, marginRight: spacing.sm },
  bggResultYear: { color: colors.textMuted, fontSize: 13 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: { color: colors.textMuted, fontSize: 13 },
  chipActive: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipActiveText: { color: colors.primaryText, fontSize: 13 },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveBtnText: { color: colors.primaryText, fontSize: 16, fontWeight: '700' },
  deleteBtn: { paddingVertical: 14, alignItems: 'center' },
  deleteBtnText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});

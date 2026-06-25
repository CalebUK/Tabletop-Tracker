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
import { useHeaderHeight } from '@react-navigation/elements';
import { RootStackProps } from '../navigation';
import {
  getGame,
  getAllGames,
  getAllTags,
  getAllCategories,
  getAllLocations,
  saveGame,
  deleteGame,
  getExpansions,
  countGamesByName,
} from '../db/games';
import { getMeta } from '../db/meta';
import { STANDALONE_EXPANSIONS_KEY } from './BackupScreen';
import { deleteImage, pickFromLibrary, takePhoto } from '../lib/images';
import { bggSearch, bggDetails, BggSearchResult } from '../lib/bgg';
import { round2num } from '../lib/format';
import { Game, GameInput } from '../types';
import { colors, radius, spacing } from '../theme';
import StarRating from '../components/StarRating';

const EMPTY: GameInput = {
  name: '',
  imageUri: null,
  description: null,
  location: null,
  year: null,
  minPlayers: null,
  maxPlayers: null,
  playTimeMin: null,
  rating: null,
  notes: null,
  houseRules: null,
  isFavorite: false,
  isWishlist: false,
  isDuel: false,
  isParty: false,
  isCoop: false,
  bggId: null,
  bggRating: null,
  bggWeight: null,
  developer: null,
  minAge: null,
  teachRating: null,
  edition: null,
  baseGameId: null,
  expansionBoost: null,
  tags: [],
  categories: [],
  expansions: [],
};

function numOrNull(s: string): number | null {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function ratingOrNull(s: string): number | null {
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(10, n)); // BGG ratings are 0–10
}

function weightOrNull(s: string): number | null {
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(5, n)); // BGG complexity (weight) is 0–5
}

export default function EditGameScreen({ route, navigation }: RootStackProps<'EditGame'>) {
  const editingId = route.params?.gameId;
  const headerHeight = useHeaderHeight();
  // New items inherit the list they were added from (collection vs wishlist).
  const [form, setForm] = useState<GameInput>({
    ...EMPTY,
    isWishlist: route.params?.wishlist ?? false,
  });
  const [tagText, setTagText] = useState('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [catText, setCatText] = useState('');
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [allLocations, setAllLocations] = useState<string[]>([]);
  const [locationFocused, setLocationFocused] = useState(false);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [bggOpen, setBggOpen] = useState(false);
  const [bggLoading, setBggLoading] = useState(false);
  const [bggResults, setBggResults] = useState<BggSearchResult[]>([]);
  const [bggError, setBggError] = useState<string | null>(null);
  const [photoMenu, setPhotoMenu] = useState(false);
  const [standaloneEnabled, setStandaloneEnabled] = useState(false);
  const [bases, setBases] = useState<Game[]>([]);
  const [baseMenu, setBaseMenu] = useState(false);

  useEffect(() => {
    getMeta(STANDALONE_EXPANSIONS_KEY).then((v) => setStandaloneEnabled(v === '1')).catch(() => {});
    // Potential base games: owned, top-level games (never the game being edited).
    getAllGames(false)
      .then((gs) => setBases(gs.filter((g) => g.id !== editingId)))
      .catch(() => {});
    getAllTags().then(setAllTags).catch(() => {});
    getAllCategories().then(setAllCategories).catch(() => {});
    getAllLocations().then(setAllLocations).catch(() => {});
    if (editingId) {
      Promise.all([getGame(editingId), getExpansions(editingId)]).then(([g, exps]) => {
        if (!g) return;
        setForm({
          id: g.id,
          name: g.name,
          imageUri: g.imageUri,
          description: g.description,
          location: g.location,
          year: g.year,
          minPlayers: g.minPlayers,
          maxPlayers: g.maxPlayers,
          playTimeMin: g.playTimeMin,
          rating: g.rating,
          notes: g.notes,
          houseRules: g.houseRules,
          isFavorite: g.isFavorite,
          isWishlist: g.isWishlist,
          isDuel: g.isDuel,
          isParty: g.isParty,
          isCoop: g.isCoop,
          bggId: g.bggId,
          bggRating: g.bggRating,
          bggWeight: g.bggWeight,
          developer: g.developer,
          minAge: g.minAge,
          teachRating: g.teachRating,
          edition: g.edition,
          baseGameId: g.baseGameId,
          expansionBoost: g.expansionBoost,
          tags: g.tags,
          categories: g.categories,
          expansions: exps.map((e) => ({
            name: e.name,
            additionalPlayers: e.additionalPlayers,
            location: e.location,
          })),
        });
        setOriginalImage(g.imageUri);
      });
    }
  }, [editingId]);

  // Title reflects which list this game belongs to.
  useEffect(() => {
    const noun = form.isWishlist ? 'Wishlist Item' : 'Game';
    navigation.setOptions({ title: editingId ? `Edit ${noun}` : `Add ${noun}` });
  }, [editingId, form.isWishlist]);

  // Save button in the header so you don't have to scroll to the bottom.
  // Re-set on every form change so the handler closes over the latest values.
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={onSave} hitSlop={10}>
          <Text style={styles.headerSave}>Save</Text>
        </Pressable>
      ),
    });
  });

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

  function addCategory(raw: string) {
    const cat = raw.trim();
    if (!cat) return;
    if (!form.categories.some((c) => c.toLowerCase() === cat.toLowerCase())) {
      patch({ categories: [...form.categories, cat] });
    }
    setCatText('');
  }

  function removeCategory(cat: string) {
    patch({ categories: form.categories.filter((c) => c !== cat) });
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
    } catch (e: any) {
      setBggError(e?.message ?? 'Could not reach BoardGameGeek.');
    } finally {
      setBggLoading(false);
    }
  }

  // Pull full BGG details for an id and fill in fields the user hasn't set.
  async function applyBggId(id: number) {
    const d = await bggDetails(id);
    if (!d) return;
    setForm((f) => {
      // Keep the user's own photo (a local file). Otherwise take the BGG cover —
      // including replacing a previous BGG cover when re-syncing to another game.
      const userPhoto = !!f.imageUri && f.imageUri.startsWith('file');
      return {
        ...f,
        name: d.name || f.name,
        description: d.description ?? f.description,
        year: d.year ?? f.year,
        minPlayers: d.minPlayers ?? f.minPlayers,
        maxPlayers: d.maxPlayers ?? f.maxPlayers,
        playTimeMin: d.playTimeMin ?? f.playTimeMin,
        minAge: d.minAge ?? f.minAge,
        developer: d.developer ?? f.developer,
        bggId: d.id,
        bggRating: d.bggRating != null ? round2num(d.bggRating) : f.bggRating,
        bggWeight: d.bggWeight != null ? round2num(d.bggWeight) : f.bggWeight,
        imageUri: userPhoto ? f.imageUri : d.imageUrl ?? null,
      };
    });
  }

  // Pull full details for a chosen BGG result and fill the empty fields.
  async function applyBggResult(r: BggSearchResult) {
    setBggLoading(true);
    try {
      await applyBggId(r.id);
      setBggOpen(false);
    } catch (e: any) {
      setBggError(e?.message ?? 'Could not load that game from BoardGameGeek.');
    } finally {
      setBggLoading(false);
    }
  }

  // Standalone-expansion linking. The boost auto-fills from the player-count
  // difference, but stays editable.
  const baseGame = bases.find((b) => b.id === form.baseGameId) ?? null;
  const suggestedBoost = baseGame
    ? Math.max(0, (form.maxPlayers ?? 0) - (baseGame.maxPlayers ?? 0))
    : 0;

  function pickBase(base: Game) {
    setBaseMenu(false);
    patch({
      baseGameId: base.id,
      expansionBoost: Math.max(0, (form.maxPlayers ?? 0) - (base.maxPlayers ?? 0)),
    });
  }

  function unlinkBase() {
    patch({ baseGameId: null, expansionBoost: null });
  }

  // Expansion editing helpers.
  function addExpansion() {
    patch({ expansions: [...form.expansions, { name: '', additionalPlayers: 0, location: null }] });
  }

  function updateExpansion(
    i: number,
    p: Partial<{ name: string; additionalPlayers: number; location: string | null }>
  ) {
    patch({
      expansions: form.expansions.map((e, idx) => (idx === i ? { ...e, ...p } : e)),
    });
  }

  function removeExpansion(i: number) {
    patch({ expansions: form.expansions.filter((_, idx) => idx !== i) });
  }

  async function doSave() {
    // If the photo changed, clean up the old file so storage doesn't leak.
    if (originalImage && originalImage !== form.imageUri) {
      await deleteImage(originalImage);
    }
    await saveGame({ ...form, name: form.name.trim() });
    navigation.goBack();
  }

  async function onSave() {
    const name = form.name.trim();
    if (!name) {
      Alert.alert('Name required', 'Please enter a name for the game.');
      return;
    }
    // Warn if another game in the same list already has this name (likely a dup).
    const dupes = await countGamesByName(name, editingId, form.isWishlist);
    if (dupes > 0) {
      Alert.alert(
        'Possible duplicate',
        `You already have "${name}" on your ${form.isWishlist ? 'wishlist' : 'collection'}. Add it anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add anyway', onPress: () => doSave() },
        ]
      );
      return;
    }
    await doSave();
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

  // Previously-used categories not already on this game, narrowed by typed text.
  const categorySuggestions = allCategories
    .filter((c) => !form.categories.some((x) => x.toLowerCase() === c.toLowerCase()))
    .filter((c) => !catText.trim() || c.toLowerCase().includes(catText.trim().toLowerCase()));

  // Previously-used locations, narrowed by what's typed (for consistent spelling).
  const locTyped = (form.location ?? '').trim().toLowerCase();
  const locationSuggestions = allLocations
    .filter((l) => l.toLowerCase() !== locTyped)
    .filter((l) => !locTyped || l.toLowerCase().includes(locTyped))
    .slice(0, 8);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={headerHeight}
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
              placeholderTextColor={colors.placeholder}
            />
            <Pressable style={styles.identifyBtn} onPress={openBggSearch}>
              <Text style={styles.identifyText}>Look up on BoardGameGeek</Text>
            </Pressable>
            {form.bggId != null && (
              <Text style={styles.bggLinked}>✓ Synced with BoardGameGeek</Text>
            )}
          </Field>

          <Field label="Storage location">
            <TextInput
              style={styles.input}
              value={form.location ?? ''}
              onChangeText={(v) => patch({ location: v || null })}
              onFocus={() => setLocationFocused(true)}
              // Delay so a tap on a suggestion chip registers before they hide.
              onBlur={() => setTimeout(() => setLocationFocused(false), 150)}
              placeholder="e.g. Hall closet, top shelf"
              placeholderTextColor={colors.placeholder}
            />
            {locationFocused && locationSuggestions.length > 0 && (
              <View style={styles.chipWrap}>
                {locationSuggestions.map((loc) => (
                  <Pressable key={loc} style={styles.chip} onPress={() => patch({ location: loc })}>
                    <Text style={styles.chipText}>📍 {loc}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Field>

          <View style={styles.ratingFavRow}>
            <View style={styles.flex1}>
              <Text style={styles.label}>My rating{form.rating ? ` · ${form.rating}/10` : ''}</Text>
              <View style={styles.ratingStars}>
                <StarRating
                  value={form.rating}
                  max={10}
                  size={20}
                  editable
                  onChange={(v) => patch({ rating: v })}
                />
              </View>
            </View>
            <View style={styles.favCol}>
              <Text style={styles.label}>Favorite</Text>
              <Switch
                style={styles.favSwitch}
                value={form.isFavorite}
                onValueChange={(v) => patch({ isFavorite: v })}
                trackColor={{ true: colors.favorite, false: colors.border }}
              />
            </View>
          </View>

          <View style={styles.row}>
            <Field label="Min players" style={styles.flex1}>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={form.minPlayers?.toString() ?? ''}
                onChangeText={(v) => patch({ minPlayers: numOrNull(v) })}
                placeholder="1"
                placeholderTextColor={colors.placeholder}
              />
            </Field>
            <Field label="Max players" style={styles.flex1}>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={form.maxPlayers?.toString() ?? ''}
                onChangeText={(v) => patch({ maxPlayers: numOrNull(v) })}
                placeholder="4"
                placeholderTextColor={colors.placeholder}
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
                placeholderTextColor={colors.placeholder}
              />
            </Field>
            <Field label="Minimum age" style={styles.flex1}>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={form.minAge?.toString() ?? ''}
                onChangeText={(v) => patch({ minAge: numOrNull(v) })}
                placeholder="8"
                placeholderTextColor={colors.placeholder}
              />
            </Field>
          </View>

          {(standaloneEnabled || form.baseGameId != null) && (
            <Field label="Standalone expansion">
              {form.baseGameId == null ? (
                <Pressable style={styles.basePick} onPress={() => setBaseMenu(true)}>
                  <Text style={styles.basePickText}>＋ Make this an expansion of a base game</Text>
                </Pressable>
              ) : (
                <View style={styles.baseLinked}>
                  <Pressable style={styles.basePick} onPress={() => setBaseMenu(true)}>
                    <Text style={styles.basePickText}>
                      Expansion of: {baseGame?.name ?? '(unknown game)'} ▸
                    </Text>
                  </Pressable>
                  <View style={styles.boostRow}>
                    <Text style={styles.boostLabel}>Adds players to the base</Text>
                    <TextInput
                      style={[styles.input, styles.boostInput]}
                      keyboardType="number-pad"
                      value={form.expansionBoost?.toString() ?? ''}
                      onChangeText={(v) => patch({ expansionBoost: numOrNull(v) })}
                      placeholder={String(suggestedBoost)}
                      placeholderTextColor={colors.placeholder}
                    />
                  </View>
                  <Pressable onPress={unlinkBase} hitSlop={8}>
                    <Text style={styles.unlinkText}>Unlink from base game</Text>
                  </Pressable>
                </View>
              )}
              <Text style={styles.fieldHint}>
                Links this game to one you own; its extra players are added to the base’s total.
              </Text>
            </Field>
          )}

          <Field label={`Teachability${form.teachRating ? ` · ${form.teachRating}/5` : ''}`}>
            <View style={styles.teachRow}>
              {[1, 2, 3, 4, 5].map((n) => {
                const on = (form.teachRating ?? 0) >= n;
                return (
                  <Pressable
                    key={n}
                    hitSlop={8}
                    onPress={() => patch({ teachRating: form.teachRating === n ? null : n })}
                  >
                    <Text style={[styles.teachBook, !on && styles.teachBookOff]}>📖</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.fieldHint}>How many times do you have to read the rule book?{'\n'}1 = Quick Read - 5 = How long you got?</Text>
          </Field>

          <Field label="Play style">
            <View style={styles.segment}>
              <Pressable
                style={[styles.segmentItem, form.isDuel && styles.segmentItemOn]}
                onPress={() => patch({ isDuel: !form.isDuel })}
              >
                <Text style={[styles.segmentText, form.isDuel && styles.segmentTextOn]}>Duel</Text>
              </Pressable>
              <Pressable
                style={[styles.segmentItem, form.isParty && styles.segmentItemOn]}
                onPress={() => patch({ isParty: !form.isParty })}
              >
                <Text style={[styles.segmentText, form.isParty && styles.segmentTextOn]}>Party</Text>
              </Pressable>
              <Pressable
                style={[styles.segmentItem, form.isCoop && styles.segmentItemOn]}
                onPress={() => patch({ isCoop: !form.isCoop })}
              >
                <Text style={[styles.segmentText, form.isCoop && styles.segmentTextOn]}>Co-Op</Text>
              </Pressable>
            </View>
            <Text style={styles.fieldHint}>Duel = strictly 2 players (not just supports 2).</Text>
          </Field>

          <View style={styles.row}>
            <Field label="BGG rating (0–10)" style={styles.flex1}>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={form.bggRating != null ? String(form.bggRating) : ''}
                onChangeText={(v) => patch({ bggRating: ratingOrNull(v) })}
                placeholder="—"
                placeholderTextColor={colors.placeholder}
              />
            </Field>
            <Field label="BGG complexity (0–5)" style={styles.flex1}>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={form.bggWeight != null ? String(form.bggWeight) : ''}
                onChangeText={(v) => patch({ bggWeight: weightOrNull(v) })}
                placeholder="—"
                placeholderTextColor={colors.placeholder}
              />
            </Field>
          </View>

          <View style={styles.row}>
            <Field label="Year" style={styles.flex1}>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={form.year?.toString() ?? ''}
                onChangeText={(v) => patch({ year: numOrNull(v) })}
                placeholder="2019"
                placeholderTextColor={colors.placeholder}
              />
            </Field>
            <Field label="Edition" style={styles.flex1}>
              <TextInput
                style={styles.input}
                value={form.edition ?? ''}
                onChangeText={(v) => patch({ edition: v || null })}
                placeholder="e.g. 2nd Edition"
                placeholderTextColor={colors.placeholder}
              />
            </Field>
          </View>

          <Field label="Publisher/Designer">
            <TextInput
              style={styles.input}
              value={form.developer ?? ''}
              onChangeText={(v) => patch({ developer: v || null })}
              placeholder="e.g. Hasbro Inc."
              placeholderTextColor={colors.placeholder}
            />
          </Field>

          <Field label="Expansions owned">
            {form.expansions.map((ex, i) => (
              <View key={i} style={styles.expansionItem}>
                <View style={styles.expansionRow}>
                  <TextInput
                    style={[styles.input, styles.flex1]}
                    value={ex.name}
                    onChangeText={(v) => updateExpansion(i, { name: v })}
                    placeholder="Expansion name"
                    placeholderTextColor={colors.placeholder}
                  />
                  <View style={styles.expansionPlayers}>
                    <Text style={styles.expansionPlayersLabel}>+players</Text>
                    <TextInput
                      style={[styles.input, styles.expansionPlayersInput]}
                      keyboardType="number-pad"
                      value={ex.additionalPlayers ? String(ex.additionalPlayers) : ''}
                      onChangeText={(v) => updateExpansion(i, { additionalPlayers: numOrNull(v) ?? 0 })}
                      placeholder="0"
                      placeholderTextColor={colors.placeholder}
                    />
                  </View>
                  <Pressable
                    onPress={() => removeExpansion(i)}
                    hitSlop={8}
                    style={styles.expansionRemoveBtn}
                  >
                    <Text style={styles.expansionRemove}>✕</Text>
                  </Pressable>
                </View>
                <TextInput
                  style={[styles.input, styles.expansionLocation]}
                  value={ex.location ?? ''}
                  onChangeText={(v) => updateExpansion(i, { location: v || null })}
                  placeholder="Location (optional, if stored separately)"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
            ))}
            <Pressable style={styles.addExpansion} onPress={addExpansion}>
              <Text style={styles.addExpansionText}>+ Add expansion</Text>
            </Pressable>
          </Field>

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
              placeholderTextColor={colors.placeholder}
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

          <Field label="Category">
            <Text style={styles.fieldHint}>e.g. Dice, Deck building, Eurogame</Text>
            <View style={styles.chipWrap}>
              {form.categories.map((c) => (
                <Pressable key={c} style={styles.chipActive} onPress={() => removeCategory(c)}>
                  <Text style={styles.chipActiveText}>{c} ✕</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={catText}
              onChangeText={setCatText}
              onSubmitEditing={() => addCategory(catText)}
              placeholder="Type a category and press return"
              placeholderTextColor={colors.placeholder}
              returnKeyType="done"
            />
            {categorySuggestions.length > 0 && (
              <View style={styles.chipWrap}>
                {categorySuggestions.slice(0, 12).map((c) => (
                  <Pressable key={c} style={styles.chip} onPress={() => addCategory(c)}>
                    <Text style={styles.chipText}>+ {c}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Field>

          <Field label="Description">
            <TextInput
              style={[styles.input, styles.multiline]}
              value={form.description ?? ''}
              onChangeText={(v) => patch({ description: v || null })}
              placeholder="A one-line blurb (auto-filled from BGG when you sync)…"
              placeholderTextColor={colors.placeholder}
              multiline
            />
          </Field>

          <Field label="Notes">
            <TextInput
              style={[styles.input, styles.multiline]}
              value={form.notes ?? ''}
              onChangeText={(v) => patch({ notes: v || null })}
              placeholder="General notes about the game…"
              placeholderTextColor={colors.placeholder}
              multiline
            />
          </Field>

          <Field label="House rules">
            <TextInput
              style={[styles.input, styles.multiline]}
              value={form.houseRules ?? ''}
              onChangeText={(v) => patch({ houseRules: v || null })}
              placeholder="Any variants or house rules…"
              placeholderTextColor={colors.placeholder}
              multiline
            />
          </Field>

          {editingId && (
            <Pressable style={styles.deleteBtn} onPress={onDelete}>
              <Text style={styles.deleteBtnText}>🗑  Delete Game</Text>
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

      <Modal visible={baseMenu} animationType="slide" transparent onRequestClose={() => setBaseMenu(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setBaseMenu(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Base game</Text>
            {bases.length === 0 ? (
              <Text style={styles.modalError}>
                You have no other games to use as a base yet. Add the base game first, then link this one.
              </Text>
            ) : (
              <FlatList
                data={bases}
                keyExtractor={(b) => String(b.id)}
                renderItem={({ item }) => (
                  <Pressable style={styles.bggResult} onPress={() => pickBase(item)}>
                    <Text style={styles.bggResultName}>{item.name}</Text>
                    {item.maxPlayers ? (
                      <Text style={styles.bggResultYear}>max {item.maxPlayers}</Text>
                    ) : null}
                  </Pressable>
                )}
              />
            )}
            <Pressable style={[styles.sheetItem, styles.sheetCancel]} onPress={() => setBaseMenu(false)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  fieldHint: { color: colors.placeholder, fontSize: 12, marginTop: -2 },
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
  identifyBtn: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 2,
  },
  identifyText: { color: colors.primary, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  ratingFavRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  ratingStars: { marginTop: 8 },
  favCol: { alignItems: 'center' },
  favSwitch: { marginTop: 6 },
  bggLinked: { color: colors.success, fontSize: 12, marginTop: 2 },
  expansionItem: { gap: spacing.sm, marginBottom: spacing.xl },
  expansionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  expansionLocation: { fontSize: 14 },
  expansionPlayers: { alignItems: 'center', gap: 4 },
  expansionPlayersInput: { width: 56, textAlign: 'center' },
  expansionPlayersLabel: { color: colors.textMuted, fontSize: 10 },
  expansionRemove: { color: colors.danger, fontSize: 18, paddingHorizontal: 4 },
  expansionRemoveBtn: { paddingBottom: 10 },
  addExpansion: { paddingVertical: spacing.sm },
  addExpansionText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  basePick: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  basePickText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  baseLinked: { gap: spacing.sm },
  boostRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  boostLabel: { color: colors.text, fontSize: 14, flex: 1 },
  boostInput: { width: 72, textAlign: 'center' },
  unlinkText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
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
  headerSave: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  teachRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  teachBook: { fontSize: 30 },
  teachBookOff: { opacity: 0.28 },
  segment: { flexDirection: 'row', gap: spacing.sm },
  segmentItem: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentItemOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  segmentTextOn: { color: colors.primaryText },
  deleteBtn: {
    marginTop: spacing.xl,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteBtnText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});

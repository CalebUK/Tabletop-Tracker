import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import { addPlay, getPlay, updatePlay, getAllPlayers, PlayInput } from '../db/plays';
import { getGame, getExpansions, getStandaloneExpansions, getAllGames } from '../db/games';
import { getGroups, getGroupRoster } from '../db/groups';
import { pickFromLibrary, takePhoto, deleteImage } from '../lib/images';
import { Expansion, Game, Group, PlayPlayer, PlayStatus } from '../types';
import { colors, radius, spacing } from '../theme';
import { isoToUk, todayIso, todayUk, ukToIso } from '../lib/dates';

const STATUSES: { key: PlayStatus; label: string }[] = [
  { key: 'completed', label: '✅ Played' },
  { key: 'dnf', label: '🏳️ DNF' },
  { key: 'saved', label: '⏸ Save for later' },
];

function scoreOrNull(s: string): number | null {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export default function LogPlayScreen({ route, navigation }: RootStackProps<'LogPlay'>) {
  const { gameId, groupId: groupParam, playId, players: initialPlayers } = route.params;
  const headerHeight = useHeaderHeight();
  const [gameName, setGameName] = useState('');
  const [gameFocused, setGameFocused] = useState(false);
  const [allGames, setAllGames] = useState<{ id: number; name: string; isWishlist: boolean }[]>([]);
  const [gameExpansions, setGameExpansions] = useState<Expansion[]>([]);
  const [selectedExpIds, setSelectedExpIds] = useState<number[]>([]);
  const [standaloneExps, setStandaloneExps] = useState<Game[]>([]);
  const [selectedStandaloneIds, setSelectedStandaloneIds] = useState<number[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<number | null>(groupParam ?? null);
  const [date, setDate] = useState(todayUk());
  const [notes, setNotes] = useState('');
  const [players, setPlayers] = useState<PlayPlayer[]>(
    initialPlayers && initialPlayers.length
      ? initialPlayers.map((p) => ({ name: p.name, isWinner: !!p.isWinner, score: p.score }))
      : [{ name: '', isWinner: false, score: null }]
  );
  const [allPlayers, setAllPlayers] = useState<string[]>([]);
  const [focused, setFocused] = useState<number | null>(null);
  const [status, setStatus] = useState<PlayStatus>('completed');
  const [photos, setPhotos] = useState<string[]>([]);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: playId ? 'Edit Play' : 'Log Play' });
    getAllPlayers().then(setAllPlayers).catch(() => {});
    Promise.all([getAllGames(false), getAllGames(true)])
      .then(([owned, wish]) =>
        setAllGames([...owned, ...wish].map((g) => ({ id: g.id, name: g.name, isWishlist: g.isWishlist })))
      )
      .catch(() => {});
    getGroups().then(setGroups).catch(() => {});
    if (playId) {
      getPlay(playId).then((p) => {
        if (!p) return;
        setGameName(p.gameName ?? '');
        setGroupId(p.groupId);
        setDate(isoToUk(p.playedAt));
        setNotes(p.notes ?? '');
        setPlayers(p.players.length ? p.players : [{ name: '', isWinner: false, score: null }]);
        setSelectedExpIds(p.expansionIds);
        setSelectedStandaloneIds(p.standaloneExpansionIds);
        setStatus(p.status);
        setPhotos(p.photos);
      });
    } else if (gameId) {
      getGame(gameId).then((g) => g && setGameName(g.name));
    }
  }, [playId, gameId]);

  // Resolve the typed name to a game in your collection OR wishlist (if it
  // matches one); otherwise the play is logged as a guest game.
  const resolved = allGames.find((g) => g.name.toLowerCase() === gameName.trim().toLowerCase());
  const resolvedGameId = resolved?.id ?? null;

  // Load that owned game's expansions whenever the resolved game changes.
  useEffect(() => {
    if (resolvedGameId) {
      getExpansions(resolvedGameId).then(setGameExpansions);
      // Owned standalone expansions of the base can be marked as used.
      getStandaloneExpansions(resolvedGameId)
        .then((gs) => setStandaloneExps(gs.filter((g) => !g.isWishlist)))
        .catch(() => setStandaloneExps([]));
    } else {
      setGameExpansions([]);
      setStandaloneExps([]);
    }
  }, [resolvedGameId]);

  // When a group with auto-fill is selected (for a new play), prefill its
  // members as players — but never clobber names the user already typed.
  useEffect(() => {
    if (playId || groupId == null) return;
    getGroupRoster(groupId)
      .then(({ autofill, members }) => {
        if (!autofill || members.length === 0) return;
        setPlayers((prev) =>
          prev.every((p) => !p.name.trim())
            ? members.map((name) => ({ name, isWinner: false, score: null }))
            : prev
        );
      })
      .catch(() => {});
  }, [groupId, playId]);

  const gameSuggestions = gameFocused
    ? allGames
        .filter((g) => {
          const t = gameName.trim().toLowerCase();
          return g.name.toLowerCase() !== t && (!t || g.name.toLowerCase().includes(t));
        })
        .slice(0, 6)
    : [];

  function toggleExpansion(id: number) {
    setSelectedExpIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function toggleStandalone(id: number) {
    setSelectedStandaloneIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function updatePlayer(i: number, p: Partial<PlayPlayer>) {
    setPlayers((list) => list.map((pl, idx) => (idx === i ? { ...pl, ...p } : pl)));
  }

  function addPlayerRow() {
    setPlayers((list) => [...list, { name: '', isWinner: false, score: null }]);
  }

  function removePlayerRow(i: number) {
    setPlayers((list) => list.filter((_, idx) => idx !== i));
  }

  // Suggestions for the row being edited: known names matching the typed text
  // and not already used elsewhere in this play.
  function suggestionsFor(i: number): string[] {
    const typed = players[i].name.trim().toLowerCase();
    const used = new Set(
      players.filter((_, idx) => idx !== i).map((p) => p.name.trim().toLowerCase())
    );
    return allPlayers
      .filter((n) => !used.has(n.toLowerCase()))
      .filter((n) => (typed ? n.toLowerCase().includes(typed) && n.toLowerCase() !== typed : true))
      .slice(0, 6);
  }

  function addBoardPhoto() {
    Alert.alert('Board photo', 'Add a photo of the board so you can re-set up later.', [
      {
        text: '📸 Take photo',
        onPress: async () => {
          const uri = await takePhoto();
          if (uri) setPhotos((ps) => [...ps, uri]);
        },
      },
      {
        text: '🖼 Choose from library',
        onPress: async () => {
          const uri = await pickFromLibrary();
          if (uri) setPhotos((ps) => [...ps, uri]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function removeBoardPhoto(uri: string) {
    deleteImage(uri).catch(() => {});
    setPhotos((ps) => ps.filter((u) => u !== uri));
  }

  async function doSave(finalStatus: PlayStatus, finalPhotos: string[]) {
    const cleaned = players.filter((p) => p.name.trim());
    const input: PlayInput = {
      gameId: resolvedGameId,
      gameName: gameName.trim(),
      groupId,
      playedAt: ukToIso(date) ?? todayIso(),
      notes: notes.trim() || null,
      status: finalStatus,
      players: cleaned,
      expansionIds: selectedExpIds,
      standaloneExpansionIds: selectedStandaloneIds,
      photos: finalPhotos,
    };
    if (playId) await updatePlay(playId, input);
    else await addPlay(input);
    navigation.goBack();
  }

  async function onSave() {
    if (!gameName.trim()) {
      Alert.alert('Which game?', 'Please enter the game that was played.');
      return;
    }
    // Finishing a game that still has board photos: confirm, then delete them.
    if (status !== 'saved' && photos.length > 0) {
      Alert.alert(
        'Mark as played?',
        `This game will be logged as ${status === 'dnf' ? 'DNF' : 'played'}, and its ${photos.length} board photo${photos.length === 1 ? '' : 's'} will be deleted.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Mark as played',
            onPress: async () => {
              await Promise.all(photos.map((u) => deleteImage(u).catch(() => {})));
              await doSave(status, []);
            },
          },
        ]
      );
      return;
    }
    await doSave(status, status === 'saved' ? photos : []);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={headerHeight}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Game</Text>
          <TextInput
            style={styles.input}
            value={gameName}
            onChangeText={setGameName}
            onFocus={() => setGameFocused(true)}
            onBlur={() => setTimeout(() => setGameFocused(false), 150)}
            placeholder="Game name (yours or one someone brought)"
            placeholderTextColor={colors.placeholder}
          />
          {gameSuggestions.length > 0 && (
            <View style={styles.suggestRow}>
              {gameSuggestions.map((g) => (
                <Pressable key={g.id} style={styles.suggestChip} onPress={() => setGameName(g.name)}>
                  <Text style={styles.suggestText}>{g.isWishlist ? '⭐' : '🎲'} {g.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {gameName.trim() && !resolved && (
            <Text style={styles.notOwned}>Not in your collection — logged as a guest game.</Text>
          )}
          {resolved?.isWishlist && (
            <Text style={styles.notOwned}>⭐ On your wishlist — this play is recorded against it.</Text>
          )}

          <Text style={[styles.label, { marginTop: spacing.lg }]}>Status</Text>
          <View style={styles.statusRow}>
            {STATUSES.map((s) => (
              <Pressable
                key={s.key}
                style={[styles.statusChip, status === s.key && styles.statusChipOn]}
                onPress={() => setStatus(s.key)}
              >
                <Text style={[styles.statusText, status === s.key && styles.statusTextOn]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>

          {groups.length > 0 && (
            <>
              <Text style={[styles.label, { marginTop: spacing.lg }]}>Group (optional)</Text>
              <View style={styles.suggestRow}>
                <Pressable
                  style={[styles.groupChip, groupId == null && styles.groupChipOn]}
                  onPress={() => setGroupId(null)}
                >
                  <Text style={[styles.groupChipText, groupId == null && styles.groupChipTextOn]}>No group</Text>
                </Pressable>
                {groups.map((g) => (
                  <Pressable
                    key={g.id}
                    style={[styles.groupChip, groupId === g.id && styles.groupChipOn]}
                    onPress={() => setGroupId(g.id)}
                  >
                    <Text style={[styles.groupChipText, groupId === g.id && styles.groupChipTextOn]}>{g.name}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <Text style={[styles.label, { marginTop: spacing.lg }]}>Date played</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="DD/MM/YYYY"
            placeholderTextColor={colors.placeholder}
          />

          <Text style={[styles.label, { marginTop: spacing.lg }]}>Players</Text>
          {players.map((p, i) => {
            const suggestions = focused === i ? suggestionsFor(i) : [];
            return (
              <View key={i}>
                <View style={styles.playerRow}>
                  <TextInput
                    style={[styles.input, styles.flex1]}
                    value={p.name}
                    onChangeText={(v) => updatePlayer(i, { name: v })}
                    onFocus={() => setFocused(i)}
                    placeholder={`Player ${i + 1}`}
                    placeholderTextColor={colors.placeholder}
                  />
                  <View style={styles.scoreCol}>
                    <Text style={styles.winnerLabel}>Score</Text>
                    <TextInput
                      style={[styles.input, styles.scoreInput]}
                      keyboardType="numeric"
                      value={p.score != null ? String(p.score) : ''}
                      onChangeText={(v) => updatePlayer(i, { score: scoreOrNull(v) })}
                      placeholder="—"
                      placeholderTextColor={colors.placeholder}
                    />
                  </View>
                  <View style={styles.winnerCol}>
                    <Text style={styles.winnerLabel}>Won</Text>
                    <Switch
                      value={p.isWinner}
                      onValueChange={(v) => updatePlayer(i, { isWinner: v })}
                      trackColor={{ true: colors.success, false: colors.border }}
                    />
                  </View>
                  {players.length > 1 && (
                    <Pressable onPress={() => removePlayerRow(i)} hitSlop={8} style={styles.removeBtn}>
                      <Text style={styles.remove}>✕</Text>
                    </Pressable>
                  )}
                </View>
                {suggestions.length > 0 && (
                  <View style={styles.suggestRow}>
                    {suggestions.map((name) => (
                      <Pressable
                        key={name}
                        style={styles.suggestChip}
                        onPress={() => updatePlayer(i, { name })}
                      >
                        <Text style={styles.suggestText}>{name}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          <Pressable style={styles.addPlayer} onPress={addPlayerRow}>
            <Text style={styles.addPlayerText}>+ Add player</Text>
          </Pressable>

          {(gameExpansions.length > 0 || standaloneExps.length > 0) && (
            <>
              <Text style={[styles.label, { marginTop: spacing.lg }]}>Expansions used</Text>
              {standaloneExps.map((ex) => {
                const on = selectedStandaloneIds.includes(ex.id);
                return (
                  <Pressable
                    key={`g${ex.id}`}
                    style={styles.expansionRow}
                    onPress={() => toggleStandalone(ex.id)}
                  >
                    <Text style={[styles.checkbox, on && styles.checkboxOn]}>
                      {on ? '☑' : '☐'}
                    </Text>
                    <Text style={styles.expansionName}>{ex.name}</Text>
                  </Pressable>
                );
              })}
              {gameExpansions.map((ex) => {
                const on = selectedExpIds.includes(ex.id);
                return (
                  <Pressable
                    key={ex.id}
                    style={styles.expansionRow}
                    onPress={() => toggleExpansion(ex.id)}
                  >
                    <Text style={[styles.checkbox, on && styles.checkboxOn]}>
                      {on ? '☑' : '☐'}
                    </Text>
                    <Text style={styles.expansionName}>{ex.name}</Text>
                  </Pressable>
                );
              })}
            </>
          )}

          {status === 'saved' && (
            <>
              <Text style={[styles.label, { marginTop: spacing.lg }]}>Board photos</Text>
              <Text style={styles.notOwned}>
                Snap the table so you can re-set up later. Deleted when you mark the game played.
              </Text>
              <View style={styles.photoRow}>
                {photos.map((uri) => (
                  <View key={uri} style={styles.photoThumb}>
                    <Pressable onPress={() => setViewPhoto(uri)}>
                      <Image source={{ uri }} style={styles.photoImg} />
                    </Pressable>
                    <Pressable style={styles.photoRemove} onPress={() => removeBoardPhoto(uri)} hitSlop={6}>
                      <Text style={styles.photoRemoveText}>✕</Text>
                    </Pressable>
                  </View>
                ))}
                <Pressable style={styles.photoAdd} onPress={addBoardPhoto}>
                  <Text style={styles.photoAddText}>＋</Text>
                </Pressable>
              </View>
            </>
          )}

          <Text style={[styles.label, { marginTop: spacing.lg }]}>Notes</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Scores, memorable moments…"
            placeholderTextColor={colors.placeholder}
            multiline
          />

          <Pressable style={styles.saveBtn} onPress={onSave}>
            <Text style={styles.saveBtnText}>
              {status === 'saved'
                ? 'Save for later'
                : status === 'dnf'
                ? playId ? 'Update (DNF)' : 'Log DNF'
                : playId ? 'Update Play' : 'Save Play'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={!!viewPhoto} transparent animationType="fade" onRequestClose={() => setViewPhoto(null)}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewPhoto(null)}>
          {viewPhoto && <Image source={{ uri: viewPhoto }} style={styles.viewerImg} resizeMode="contain" />}
          <Text style={styles.viewerHint}>Tap to close</Text>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  notOwned: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  groupChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  groupChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  groupChipText: { color: colors.textMuted, fontSize: 13 },
  groupChipTextOn: { color: colors.primaryText, fontWeight: '600' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statusChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  statusTextOn: { color: colors.primaryText },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  photoThumb: { width: 80, height: 80 },
  photoImg: { width: 80, height: 80, borderRadius: radius.md },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  viewerImg: { width: '100%', height: '85%' },
  viewerHint: { color: colors.textMuted, fontSize: 13, marginTop: spacing.md },
  photoAdd: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddText: { color: colors.primary, fontSize: 30, lineHeight: 34 },
  checkbox: { color: colors.textMuted, fontSize: 22, marginRight: spacing.sm },
  checkboxOn: { color: colors.success },
  expansionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  expansionName: { color: colors.text, fontSize: 15, flex: 1 },
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
  flex1: { flex: 1 },
  playerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginBottom: spacing.sm },
  winnerCol: { alignItems: 'center', gap: 4 },
  scoreCol: { alignItems: 'center', gap: 4 },
  scoreInput: { width: 56, textAlign: 'center' },
  winnerLabel: { color: colors.textMuted, fontSize: 11 },
  remove: { color: colors.danger, fontSize: 18, paddingHorizontal: 4 },
  removeBtn: { paddingBottom: 10 },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  suggestChip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  suggestText: { color: colors.text, fontSize: 13 },
  addPlayer: { paddingVertical: spacing.sm },
  addPlayerText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  saveBtnText: { color: colors.primaryText, fontSize: 16, fontWeight: '700' },
});

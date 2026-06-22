import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
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
import { Alert } from 'react-native';
import { RootStackProps } from '../navigation';
import { addPlay, getPlay, updatePlay, getAllPlayers, PlayInput } from '../db/plays';
import { getGame, getExpansions, getAllGames } from '../db/games';
import { getGroups } from '../db/groups';
import { Expansion, Group, PlayPlayer } from '../types';
import { colors, radius, spacing } from '../theme';
import { isoToUk, todayIso, todayUk, ukToIso } from '../lib/dates';

function scoreOrNull(s: string): number | null {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export default function LogPlayScreen({ route, navigation }: RootStackProps<'LogPlay'>) {
  const { gameId, groupId: groupParam, playId } = route.params;
  const headerHeight = useHeaderHeight();
  const [gameName, setGameName] = useState('');
  const [gameFocused, setGameFocused] = useState(false);
  const [ownedGames, setOwnedGames] = useState<{ id: number; name: string }[]>([]);
  const [gameExpansions, setGameExpansions] = useState<Expansion[]>([]);
  const [selectedExpIds, setSelectedExpIds] = useState<number[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<number | null>(groupParam ?? null);
  const [date, setDate] = useState(todayUk());
  const [notes, setNotes] = useState('');
  const [players, setPlayers] = useState<PlayPlayer[]>([{ name: '', isWinner: false, score: null }]);
  const [allPlayers, setAllPlayers] = useState<string[]>([]);
  const [focused, setFocused] = useState<number | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: playId ? 'Edit Play' : 'Log Play' });
    getAllPlayers().then(setAllPlayers).catch(() => {});
    getAllGames().then((gs) => setOwnedGames(gs.map((g) => ({ id: g.id, name: g.name })))).catch(() => {});
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
      });
    } else if (gameId) {
      getGame(gameId).then((g) => g && setGameName(g.name));
    }
  }, [playId, gameId]);

  // Resolve the typed game name to an owned game id (if it matches one).
  const resolvedGameId =
    ownedGames.find((g) => g.name.toLowerCase() === gameName.trim().toLowerCase())?.id ?? null;

  // Load that owned game's expansions whenever the resolved game changes.
  useEffect(() => {
    if (resolvedGameId) getExpansions(resolvedGameId).then(setGameExpansions);
    else setGameExpansions([]);
  }, [resolvedGameId]);

  const gameSuggestions = gameFocused
    ? ownedGames
        .map((g) => g.name)
        .filter((n) => {
          const t = gameName.trim().toLowerCase();
          return n.toLowerCase() !== t && (!t || n.toLowerCase().includes(t));
        })
        .slice(0, 6)
    : [];

  function toggleExpansion(id: number) {
    setSelectedExpIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
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

  async function onSave() {
    if (!gameName.trim()) {
      Alert.alert('Which game?', 'Please enter the game that was played.');
      return;
    }
    const cleaned = players.filter((p) => p.name.trim());
    const input: PlayInput = {
      gameId: resolvedGameId,
      gameName: gameName.trim(),
      groupId,
      playedAt: ukToIso(date) ?? todayIso(),
      notes: notes.trim() || null,
      players: cleaned,
      expansionIds: selectedExpIds,
    };
    if (playId) await updatePlay(playId, input);
    else await addPlay(input);
    navigation.goBack();
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
              {gameSuggestions.map((name) => (
                <Pressable key={name} style={styles.suggestChip} onPress={() => setGameName(name)}>
                  <Text style={styles.suggestText}>🎲 {name}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {gameName.trim() && !resolvedGameId && (
            <Text style={styles.notOwned}>Not in your collection — logged as a guest game.</Text>
          )}

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

          {gameExpansions.length > 0 && (
            <>
              <Text style={[styles.label, { marginTop: spacing.lg }]}>Expansions used</Text>
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
            <Text style={styles.saveBtnText}>{playId ? 'Update Play' : 'Save Play'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
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

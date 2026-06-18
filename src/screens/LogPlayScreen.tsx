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
import { RootStackProps } from '../navigation';
import { addPlay, getPlay, updatePlay, getAllPlayers } from '../db/plays';
import { PlayPlayer } from '../types';
import { colors, radius, spacing } from '../theme';
import { isoToUk, todayIso, todayUk, ukToIso } from '../lib/dates';

export default function LogPlayScreen({ route, navigation }: RootStackProps<'LogPlay'>) {
  const { gameId, playId } = route.params;
  const headerHeight = useHeaderHeight();
  const [date, setDate] = useState(todayUk());
  const [notes, setNotes] = useState('');
  const [players, setPlayers] = useState<PlayPlayer[]>([{ name: '', isWinner: false }]);
  const [allPlayers, setAllPlayers] = useState<string[]>([]);
  const [focused, setFocused] = useState<number | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: playId ? 'Edit Play' : 'Log Play' });
    getAllPlayers().then(setAllPlayers).catch(() => {});
    if (playId) {
      getPlay(playId).then((p) => {
        if (!p) return;
        setDate(isoToUk(p.playedAt));
        setNotes(p.notes ?? '');
        setPlayers(p.players.length ? p.players : [{ name: '', isWinner: false }]);
      });
    }
  }, [playId]);

  function updatePlayer(i: number, p: Partial<PlayPlayer>) {
    setPlayers((list) => list.map((pl, idx) => (idx === i ? { ...pl, ...p } : pl)));
  }

  function addPlayerRow() {
    setPlayers((list) => [...list, { name: '', isWinner: false }]);
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
    const cleaned = players.filter((p) => p.name.trim());
    const iso = ukToIso(date) ?? todayIso();
    if (playId) {
      await updatePlay(playId, iso, notes.trim() || null, cleaned);
    } else {
      await addPlay(gameId, iso, notes.trim() || null, cleaned);
    }
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
          <Text style={styles.label}>Date played</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="DD/MM/YYYY"
            placeholderTextColor={colors.textMuted}
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
                    placeholderTextColor={colors.textMuted}
                  />
                  <View style={styles.winnerCol}>
                    <Text style={styles.winnerLabel}>Won</Text>
                    <Switch
                      value={p.isWinner}
                      onValueChange={(v) => updatePlayer(i, { isWinner: v })}
                      trackColor={{ true: colors.success, false: colors.border }}
                    />
                  </View>
                  {players.length > 1 && (
                    <Pressable onPress={() => removePlayerRow(i)} hitSlop={8}>
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

          <Text style={[styles.label, { marginTop: spacing.lg }]}>Notes</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Scores, memorable moments…"
            placeholderTextColor={colors.textMuted}
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
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  winnerCol: { alignItems: 'center' },
  winnerLabel: { color: colors.textMuted, fontSize: 11 },
  remove: { color: colors.danger, fontSize: 18, paddingHorizontal: 4 },
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

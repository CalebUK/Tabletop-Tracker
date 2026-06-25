import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { getMeta, setMeta } from '../db/meta';
import { colors, radius, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const KEY = 'scorepad_v1';

interface Player {
  id: number;
  name: string;
  score: number;
}

export default function ScorepadScreen() {
  const nav = useNavigation<Nav>();
  const [players, setPlayers] = useState<Player[]>([]);
  const [deltas, setDeltas] = useState<Record<number, string>>({});
  const nextId = useRef(1);
  const loaded = useRef(false);

  // Load any saved scorepad once.
  useEffect(() => {
    getMeta(KEY)
      .then((raw) => {
        if (raw) {
          const saved: Player[] = JSON.parse(raw);
          setPlayers(saved);
          nextId.current = saved.reduce((m, p) => Math.max(m, p.id), 0) + 1;
        }
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
      });
  }, []);

  // Persist whenever players change (after the initial load).
  useEffect(() => {
    if (loaded.current) setMeta(KEY, JSON.stringify(players)).catch(() => {});
  }, [players]);

  function addPlayer() {
    setPlayers((list) => [...list, { id: nextId.current++, name: '', score: 0 }]);
  }
  function rename(id: number, name: string) {
    setPlayers((list) => list.map((p) => (p.id === id ? { ...p, name } : p)));
  }
  function bump(id: number, by: number) {
    setPlayers((list) => list.map((p) => (p.id === id ? { ...p, score: p.score + by } : p)));
  }
  function applyDelta(id: number) {
    const n = parseInt(deltas[id] ?? '', 10);
    if (Number.isFinite(n)) bump(id, n);
    setDeltas((d) => ({ ...d, [id]: '' }));
  }
  function removePlayer(id: number) {
    setPlayers((list) => list.filter((p) => p.id !== id));
  }
  function resetScores() {
    Alert.alert('Reset all scores?', 'Players stay, scores go back to 0.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => setPlayers((list) => list.map((p) => ({ ...p, score: 0 }))) },
    ]);
  }
  function clearAll() {
    Alert.alert('Clear the scorepad?', 'Removes all players.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => setPlayers([]) },
    ]);
  }

  // Hand the current scores off to Log Play — names + scores pre-filled, top
  // scorer pre-marked as winner. The user just picks the game and saves.
  function logAsPlay() {
    const named = players.filter((p) => p.name.trim());
    if (named.length === 0) return;
    const max = Math.max(...named.map((p) => p.score));
    const allEqual = named.every((p) => p.score === named[0].score);
    nav.navigate('LogPlay', {
      players: named.map((p) => ({
        name: p.name.trim(),
        score: p.score,
        isWinner: !allEqual && p.score === max,
      })),
    });
  }

  // Crown the (single) current leader, once anyone is ahead of 0.
  const top = players.reduce((m, p) => Math.max(m, p.score), -Infinity);
  const leaders = players.filter((p) => p.score === top);
  const showCrown = players.length > 1 && top > 0 && leaders.length === 1;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {players.length === 0 && (
          <Text style={styles.empty}>Add players to start keeping score.</Text>
        )}

        {players.map((p) => (
          <View key={p.id} style={styles.card}>
            <View style={styles.topRow}>
              <TextInput
                style={styles.nameInput}
                value={p.name}
                onChangeText={(v) => rename(p.id, v)}
                placeholder="Player name"
                placeholderTextColor={colors.placeholder}
              />
              <Text style={styles.score}>
                {showCrown && p.score === top ? '👑 ' : ''}{p.score}
              </Text>
              <Pressable onPress={() => removePlayer(p.id)} hitSlop={8} style={styles.removeBtn}>
                <Text style={styles.remove}>✕</Text>
              </Pressable>
            </View>
            <View style={styles.controls}>
              <Pressable style={styles.quick} onPress={() => bump(p.id, -1)}><Text style={styles.quickText}>−1</Text></Pressable>
              <Pressable style={styles.quick} onPress={() => bump(p.id, 1)}><Text style={styles.quickText}>+1</Text></Pressable>
              <Pressable style={styles.quick} onPress={() => bump(p.id, 5)}><Text style={styles.quickText}>+5</Text></Pressable>
              <TextInput
                style={styles.deltaInput}
                value={deltas[p.id] ?? ''}
                onChangeText={(v) => setDeltas((d) => ({ ...d, [p.id]: v }))}
                placeholder="±"
                placeholderTextColor={colors.placeholder}
                keyboardType="numbers-and-punctuation"
                onSubmitEditing={() => applyDelta(p.id)}
                returnKeyType="done"
              />
              <Pressable style={styles.addPts} onPress={() => applyDelta(p.id)}>
                <Text style={styles.addPtsText}>Add</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <Pressable style={styles.addPlayer} onPress={addPlayer}>
          <Text style={styles.addPlayerText}>+ Add player</Text>
        </Pressable>

        {players.some((p) => p.name.trim()) && (
          <Pressable style={styles.logBtn} onPress={logAsPlay}>
            <Text style={styles.logBtnText}>🎲  Log as a play</Text>
          </Pressable>
        )}

        {players.length > 0 && (
          <View style={styles.footer}>
            <Pressable onPress={resetScores}><Text style={styles.footerLink}>Reset scores</Text></Pressable>
            <Pressable onPress={clearAll}><Text style={[styles.footerLink, styles.danger]}>Clear all</Text></Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl, fontSize: 15 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nameInput: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '600', paddingVertical: 4 },
  score: { color: colors.text, fontSize: 28, fontWeight: '800', minWidth: 56, textAlign: 'right' },
  removeBtn: { paddingHorizontal: 4 },
  remove: { color: colors.danger, fontSize: 16 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  quick: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  deltaInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    fontSize: 15,
    textAlign: 'center',
  },
  addPts: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 9 },
  addPtsText: { color: colors.primaryText, fontSize: 15, fontWeight: '700' },
  addPlayer: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  addPlayerText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  logBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  logBtnText: { color: colors.primaryText, fontSize: 17, fontWeight: '800' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xl },
  footerLink: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  danger: { color: colors.danger },
});

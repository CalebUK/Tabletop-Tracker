import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackProps } from '../navigation';
import { fetchAllGames } from '../lib/onlineLibrary';
import { AggregatedGame } from '../types';
import { colors, radius, spacing } from '../theme';

const SPINE_W = 38;
const SPINE_GAP = 6;
const SPINE_COLORS = ['#7d5ba6', '#3a7d44', '#b0543b', '#345995', '#9c4f96', '#c9a227', '#4e8098', '#a8412e'];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export default function BrowseAllScreen({ navigation }: RootStackProps<'BrowseAll'>) {
  const [games, setGames] = useState<AggregatedGame[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'rating'>('name');
  const [selected, setSelected] = useState<AggregatedGame | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: 'All games' });
    fetchAllGames(true)
      .then(setGames)
      .catch((e: any) => setError(e?.message ?? 'Could not load libraries.'));
  }, []);

  const shelves = useMemo(() => {
    if (!games) return [];
    const q = query.trim().toLowerCase();
    const filtered = q ? games.filter((g) => g.name.toLowerCase().includes(q)) : games.slice();
    filtered.sort((a, b) =>
      sortBy === 'rating'
        ? (b.bestRating ?? -1) - (a.bestRating ?? -1) || a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name)
    );
    const perShelf = Math.max(1, Math.floor((Dimensions.get('window').width - spacing.lg * 2) / (SPINE_W + SPINE_GAP)));
    const rows: AggregatedGame[][] = [];
    for (let i = 0; i < filtered.length; i += perShelf) rows.push(filtered.slice(i, i + perShelf));
    return rows;
  }, [games, query, sortBy]);

  if (error) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={['bottom']}>
        <Text style={styles.muted}>{error}</Text>
      </SafeAreaView>
    );
  }
  if (!games) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={['bottom']}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.muted}>Gathering everyone's games…</Text>
      </SafeAreaView>
    );
  }

  const total = games.length;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.toolbar}>
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${total} games…`}
          placeholderTextColor={colors.placeholder}
        />
        <View style={styles.sortRow}>
          <Pressable style={[styles.sortChip, sortBy === 'name' && styles.sortChipOn]} onPress={() => setSortBy('name')}>
            <Text style={[styles.sortText, sortBy === 'name' && styles.sortTextOn]}>A–Z</Text>
          </Pressable>
          <Pressable style={[styles.sortChip, sortBy === 'rating' && styles.sortChipOn]} onPress={() => setSortBy('rating')}>
            <Text style={[styles.sortText, sortBy === 'rating' && styles.sortTextOn]}>Rating</Text>
          </Pressable>
        </View>
      </View>

      {total === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>No games yet — add a friend's library code on the Library tab.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.shelfScroll}>
          {shelves.map((shelf, si) => (
            <View key={si} style={styles.shelf}>
              <View style={styles.shelfSpines}>
                {shelf.map((g) => {
                  const h = 120 + (hash(g.name) % 56);
                  const color = SPINE_COLORS[hash(g.name) % SPINE_COLORS.length];
                  return (
                    <Pressable
                      key={g.name}
                      style={[styles.spine, { height: h, backgroundColor: color }]}
                      onPress={() => setSelected(g)}
                    >
                      <Text style={[styles.spineText, { width: h - 18 }]} numberOfLines={1}>
                        {g.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.shelfBoard} />
            </View>
          ))}
          {query.trim() !== '' && shelves.length === 0 && (
            <Text style={styles.muted}>No games match “{query}”.</Text>
          )}
        </ScrollView>
      )}

      <Modal visible={!!selected} animationType="fade" transparent onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {selected && (
              <>
                <Text style={styles.sheetTitle}>{selected.name}</Text>
                <Text style={styles.sheetMeta}>
                  {[
                    selected.minPlayers && selected.maxPlayers
                      ? selected.minPlayers === selected.maxPlayers
                        ? `${selected.minPlayers} players`
                        : `${selected.minPlayers}–${selected.maxPlayers} players`
                      : null,
                    selected.playTimeMin ? `${selected.playTimeMin} min` : null,
                  ]
                    .filter(Boolean)
                    .join('  ·  ')}
                </Text>
                <Text style={styles.ownersLabel}>Owned by</Text>
                {selected.owners.map((o, i) => (
                  <View key={i} style={styles.ownerRow}>
                    <Text style={styles.ownerName}>{o.owner}</Text>
                    <Text style={styles.ownerRating}>
                      {o.rating != null && o.rating > 0 ? `★ ${fmt(o.rating)}/10` : '—'}
                    </Text>
                  </View>
                ))}
                <Pressable style={styles.closeBtn} onPress={() => setSelected(null)}>
                  <Text style={styles.closeText}>Close</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  muted: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  toolbar: { padding: spacing.lg, gap: spacing.sm },
  search: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  sortRow: { flexDirection: 'row', gap: spacing.sm },
  sortChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  sortChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  sortText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  sortTextOn: { color: colors.primaryText },
  shelfScroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2 },
  shelf: { marginBottom: spacing.lg },
  shelfSpines: { flexDirection: 'row', alignItems: 'flex-end', gap: SPINE_GAP, minHeight: 120 },
  shelfBoard: {
    height: 10,
    backgroundColor: '#5b4636',
    borderRadius: 3,
    marginTop: 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  spine: {
    width: SPINE_W,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.25)',
  },
  spineText: { transform: [{ rotate: '-90deg' }], color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  sheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  sheetMeta: { color: colors.textMuted, fontSize: 14, marginTop: 2, marginBottom: spacing.md },
  ownersLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: spacing.xs },
  ownerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ownerName: { color: colors.text, fontSize: 15 },
  ownerRating: { color: colors.star, fontSize: 14, fontWeight: '600' },
  closeBtn: { marginTop: spacing.lg, alignItems: 'center', paddingVertical: spacing.sm },
  closeText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
});

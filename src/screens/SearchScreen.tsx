import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { searchGames, getAllTags } from '../db/games';
import { Game, SearchFilters } from '../types';
import { colors, radius, spacing } from '../theme';
import GameCard from '../components/GameCard';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Each time preset sets a max and/or min on play_time_min.
const TIME_PRESETS: { label: string; max: number | null; min: number | null }[] = [
  { label: 'Any', max: null, min: null },
  { label: '15 min', max: 15, min: null },
  { label: '30 min', max: 30, min: null },
  { label: '60 min', max: 60, min: null },
  { label: '60+ min', max: null, min: 60 },
];

// 7 is the "7+" bucket (handled as "supports 7 or more" in the query).
const PLAYER_PRESETS = [null, 1, 2, 3, 4, 5, 6, 7];

const EMPTY_FILTERS: SearchFilters = {
  text: '',
  tags: [],
  favoritesOnly: false,
  unplayedOnly: false,
  maxPlayTime: null,
  minPlayTime: null,
  playerCount: null,
  minRating: null,
  minBggRating: null,
  ageBands: [],
  complexity: null,
};

const AGE_BANDS: { label: string; band: { lo: number; hi: number | null } }[] = [
  { label: '2–5', band: { lo: 2, hi: 5 } },
  { label: '6–8', band: { lo: 6, hi: 8 } },
  { label: '9–11', band: { lo: 9, hi: 11 } },
  { label: '12+', band: { lo: 12, hi: null } },
];

export default function SearchScreen() {
  const navigation = useNavigation<Nav>();
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [results, setResults] = useState<Game[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      getAllTags().then(setAllTags);
    }, [])
  );

  // Re-run the query whenever any filter changes.
  useEffect(() => {
    searchGames(filters).then(setResults).catch((e) => console.warn('search', e));
  }, [filters]);

  function patch(p: Partial<SearchFilters>) {
    setFilters((f) => ({ ...f, ...p }));
  }

  function toggleTag(tag: string) {
    setFilters((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }));
  }

  // Jump to a random game among the current results.
  function feelingLucky() {
    if (results.length === 0) return;
    const pick = results[Math.floor(Math.random() * results.length)];
    navigation.navigate('GameDetail', { gameId: pick.id });
  }

  const active =
    filters.text || filters.tags.length || filters.favoritesOnly ||
    filters.unplayedOnly || filters.maxPlayTime != null || filters.minPlayTime != null ||
    filters.playerCount != null || filters.minRating != null || filters.minBggRating != null ||
    filters.ageBands.length > 0 || filters.complexity != null;

  const header = (
    <View style={styles.filters}>
      <Text style={styles.heading}>Find a Game</Text>

      <TextInput
        style={styles.search}
        placeholder="Search name, notes, designer…"
        placeholderTextColor={colors.placeholder}
        value={filters.text}
        onChangeText={(v) => patch({ text: v })}
      />

      <View style={styles.toggleRow}>
        <Toggle label="⭐ Favorites" on={filters.favoritesOnly} onPress={() => patch({ favoritesOnly: !filters.favoritesOnly })} />
        <Toggle label="🆕 Unplayed" on={filters.unplayedOnly} onPress={() => patch({ unplayedOnly: !filters.unplayedOnly })} />
      </View>

      <Text style={styles.groupLabel}>Play time</Text>
      <View style={styles.chipWrap}>
        {TIME_PRESETS.map((p) => (
          <Toggle
            key={p.label}
            label={p.label}
            on={filters.maxPlayTime === p.max && filters.minPlayTime === p.min}
            onPress={() => patch({ maxPlayTime: p.max, minPlayTime: p.min })}
          />
        ))}
      </View>

      <Text style={styles.groupLabel}>Plays with</Text>
      <View style={styles.chipWrap}>
        {PLAYER_PRESETS.map((n) => (
          <Toggle
            key={String(n)}
            label={n == null ? 'Any' : n >= 7 ? `${n}+` : `${n}p`}
            on={filters.playerCount === n}
            onPress={() => patch({ playerCount: n })}
          />
        ))}
      </View>

      <Text style={styles.groupLabel}>Ratings</Text>
      <View style={styles.chipWrap}>
        <Toggle label="5+" on={filters.minRating === 5} onPress={() => patch({ minRating: filters.minRating === 5 ? null : 5 })} />
        <Toggle label="8+" on={filters.minRating === 8} onPress={() => patch({ minRating: filters.minRating === 8 ? null : 8 })} />
        <Toggle label="BGG 5+" on={filters.minBggRating === 5} onPress={() => patch({ minBggRating: filters.minBggRating === 5 ? null : 5 })} />
        <Toggle label="BGG 8+" on={filters.minBggRating === 8} onPress={() => patch({ minBggRating: filters.minBggRating === 8 ? null : 8 })} />
      </View>

      <Text style={styles.groupLabel}>Age</Text>
      <View style={styles.chipWrap}>
        {AGE_BANDS.map((a) => {
          const on = filters.ageBands.some((b) => b.lo === a.band.lo && b.hi === a.band.hi);
          return (
            <Toggle
              key={a.label}
              label={a.label}
              on={on}
              onPress={() =>
                patch({
                  ageBands: on
                    ? filters.ageBands.filter((b) => !(b.lo === a.band.lo && b.hi === a.band.hi))
                    : [...filters.ageBands, a.band],
                })
              }
            />
          );
        })}
      </View>

      <Text style={styles.groupLabel}>Complexity</Text>
      <View style={styles.chipWrap}>
        {(['easy', 'medium', 'high'] as const).map((c) => (
          <Toggle
            key={c}
            label={c[0].toUpperCase() + c.slice(1)}
            on={filters.complexity === c}
            onPress={() => patch({ complexity: filters.complexity === c ? null : c })}
          />
        ))}
      </View>

      {allTags.length > 0 && (
        <>
          <Text style={styles.groupLabel}>Tags</Text>
          <View style={styles.chipWrap}>
            {allTags.map((t) => (
              <Toggle key={t} label={t} on={filters.tags.includes(t)} onPress={() => toggleTag(t)} />
            ))}
          </View>
        </>
      )}

      <View style={styles.resultHeader}>
        <Text style={styles.resultCount}>{results.length} result{results.length === 1 ? '' : 's'}</Text>
        {active ? (
          <Pressable onPress={() => setFilters(EMPTY_FILTERS)}>
            <Text style={styles.clear}>Clear all</Text>
          </Pressable>
        ) : null}
      </View>

      {results.length > 0 && (
        <Pressable style={styles.luckyBtn} onPress={feelingLucky}>
          <Text style={styles.luckyText}>🎲 Feeling lucky</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={results}
        keyExtractor={(g) => String(g.id)}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <GameCard game={item} onPress={() => navigation.navigate('GameDetail', { gameId: item.id })} />
          </View>
        )}
        ListEmptyComponent={<Text style={styles.noResults}>No games match these filters.</Text>}
      />
    </SafeAreaView>
  );
}

function Toggle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.toggle, on && styles.toggleOn]} onPress={onPress}>
      <Text style={[styles.toggleText, on && styles.toggleTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, paddingBottom: 60 },
  cardWrap: { marginBottom: spacing.md },
  filters: { gap: spacing.sm, marginBottom: spacing.md },
  heading: { color: colors.text, fontSize: 26, fontWeight: '700', marginBottom: spacing.xs },
  search: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  toggleRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  groupLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginTop: spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  toggle: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  toggleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleText: { color: colors.textMuted, fontSize: 13 },
  toggleTextOn: { color: colors.primaryText, fontWeight: '600' },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  resultCount: { color: colors.text, fontSize: 15, fontWeight: '600' },
  clear: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  luckyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  luckyText: { color: colors.primaryText, fontSize: 15, fontWeight: '700' },
  noResults: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});

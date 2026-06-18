import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { getAllGames, toggleFavorite } from '../db/games';
import { Game } from '../types';
import { colors, radius, spacing } from '../theme';
import GameCard from '../components/GameCard';
import SwipeableRow from '../components/SwipeableRow';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CollectionScreen() {
  const navigation = useNavigation<Nav>();
  const [games, setGames] = useState<Game[]>([]);
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const load = useCallback(() => {
    getAllGames().then(setGames).catch((e) => console.warn('load games', e));
  }, []);

  // Reload whenever the tab regains focus (e.g. after add/edit/delete).
  useFocusEffect(load);

  function onToggleFavorite(g: Game) {
    const next = !g.isFavorite;
    // Optimistic update so the heart responds instantly.
    setGames((list) => list.map((x) => (x.id === g.id ? { ...x, isFavorite: next } : x)));
    toggleFavorite(g.id, next).catch((e) => console.warn('toggle favorite', e));
  }

  const q = query.trim().toLowerCase();
  const filtered = games
    .filter((g) => (favoritesOnly ? g.isFavorite : true))
    .filter((g) => (q ? g.name.toLowerCase().includes(q) : true));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>My Collection</Text>
        <Text style={styles.count}>{games.length} games</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={[styles.search, styles.flex1]}
          placeholder="Quick search by name…"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          clearButtonMode="while-editing"
        />
        <Pressable
          style={[styles.favFilter, favoritesOnly && styles.favFilterOn]}
          onPress={() => setFavoritesOnly((v) => !v)}
        >
          <Text style={[styles.favFilterText, favoritesOnly && styles.favFilterTextOn]}>
            {favoritesOnly ? '♥' : '♡'}
          </Text>
        </Pressable>
      </View>

      {games.length > 0 && (
        <Text style={styles.hint}>Swipe → to edit | ← to loan | hold to log play</Text>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(g) => String(g.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <SwipeableRow
            rightSwipe={{
              icon: '✏️',
              label: 'Edit',
              color: colors.primary,
              onTrigger: () => navigation.navigate('EditGame', { gameId: item.id }),
            }}
            leftSwipe={{
              icon: '🤝',
              label: item.loanedTo ? 'Manage' : 'Loan',
              color: colors.favorite,
              onTrigger: () => navigation.navigate('Loan', { gameId: item.id }),
            }}
          >
            <GameCard
              game={item}
              onPress={() => navigation.navigate('GameDetail', { gameId: item.id })}
              onLongPress={() => navigation.navigate('LogPlay', { gameId: item.id })}
              onToggleFavorite={() => onToggleFavorite(item)}
            />
          </SwipeableRow>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎲</Text>
            <Text style={styles.emptyTitle}>
              {games.length === 0 ? 'No games yet' : 'No matches'}
            </Text>
            <Text style={styles.emptyText}>
              {games.length === 0
                ? 'Tap + to add your first board game.'
                : 'Try a different search.'}
            </Text>
          </View>
        }
      />

      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('EditGame', {})}
      >
        <Text style={styles.fabText}>＋</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  heading: { color: colors.text, fontSize: 26, fontWeight: '700' },
  count: { color: colors.textMuted, fontSize: 14 },
  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  flex1: { flex: 1 },
  search: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  favFilter: {
    width: 44,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favFilterOn: { backgroundColor: colors.favorite, borderColor: colors.favorite },
  favFilterText: { color: colors.textMuted, fontSize: 20 },
  favFilterTextOn: { color: '#fff' },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  list: { padding: spacing.lg, paddingTop: spacing.md, paddingBottom: 120 },
  empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: spacing.xl },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 4 },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabText: { color: colors.primaryText, fontSize: 32, lineHeight: 36, marginTop: -2 },
});

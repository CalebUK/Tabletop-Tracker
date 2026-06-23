import React, { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackProps } from '../navigation';
import { fetchLibrary } from '../lib/onlineLibrary';
import { saveFriendLibrary, removeFriendLibrary } from '../db/library';
import { getGamesForLibrary } from '../db/games';
import { LibraryGame, SharedLibrary } from '../types';
import { colors, radius, spacing } from '../theme';

function players(g: LibraryGame): string | null {
  if (g.minPlayers && g.maxPlayers) {
    return g.minPlayers === g.maxPlayers ? `${g.minPlayers}p` : `${g.minPlayers}–${g.maxPlayers}p`;
  }
  if (g.maxPlayers) return `${g.maxPlayers}p`;
  return null;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export default function FriendLibraryScreen({ route, navigation }: RootStackProps<'FriendLibrary'>) {
  const { code, name } = route.params;
  const [lib, setLib] = useState<SharedLibrary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [hideOwned, setHideOwned] = useState(false);
  const [ownedNames, setOwnedNames] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchLibrary(code)
      .then((l) => {
        if (!l) {
          setError('This library no longer exists — your friend may have deleted it.');
        } else {
          setLib(l);
          saveFriendLibrary(l.code, l.name); // keep the saved name fresh
        }
      })
      .catch((e: any) => setError(e?.message ?? 'Could not load this library.'))
      .finally(() => setLoading(false));
  }, [code]);

  useEffect(() => {
    navigation.setOptions({ title: name ?? 'Library' });
    load();
    // Names of games I own, to optionally hide them from a friend's list.
    getGamesForLibrary()
      .then((mine) => setOwnedNames(new Set(mine.map((g) => g.name.trim().toLowerCase()))))
      .catch(() => {});
  }, [code]);

  function onRemove() {
    Alert.alert(
      'Remove this library?',
      `${name ?? lib?.name ?? 'This library'} will be removed from your saved libraries.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFriendLibrary(code).then(() => navigation.goBack()),
        },
      ]
    );
  }

  const games = lib?.games ?? [];
  const ownedCount = games.filter((g) => ownedNames.has(g.name.trim().toLowerCase())).length;
  const q = query.trim().toLowerCase();
  const filtered = games
    .filter((g) => (hideOwned ? !ownedNames.has(g.name.trim().toLowerCase()) : true))
    .filter((g) => (q ? g.name.toLowerCase().includes(q) : true));

  // Only show the full-screen spinner on the first load. Once we have the
  // library, a refresh (↺ or re-entering) updates it quietly in place.
  if (loading && !lib) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={['bottom']}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (error && !lib) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={['bottom']}>
        <Text style={styles.error}>{error}</Text>
        <Pressable style={styles.retry} onPress={load}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={filtered}
        keyExtractor={(g, i) => `${g.name}-${i}`}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>{lib?.name}</Text>
            <Text style={styles.sub}>
              {games.length} game{games.length === 1 ? '' : 's'} · code {lib?.code}
            </Text>
            <View style={styles.toolRow}>
              <TextInput
                style={[styles.search, styles.flex1]}
                value={query}
                onChangeText={setQuery}
                placeholder="Search their games…"
                placeholderTextColor={colors.placeholder}
              />
              <Pressable style={styles.refresh} onPress={load}>
                <Text style={styles.refreshText}>↺</Text>
              </Pressable>
            </View>
            {ownedCount > 0 && (
              <Pressable
                style={[styles.ownedToggle, hideOwned && styles.ownedToggleOn]}
                onPress={() => setHideOwned((v) => !v)}
              >
                <Text style={[styles.ownedToggleText, hideOwned && styles.ownedToggleTextOn]}>
                  {hideOwned ? `👀 Show all (${ownedCount} I own)` : `🙈 Hide ${ownedCount} I already own`}
                </Text>
              </Pressable>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const meta = [players(item), item.playTimeMin ? `${item.playTimeMin} min` : null].filter(Boolean);
          return (
            <View style={styles.gameRow}>
              <Text style={styles.gameName} numberOfLines={1}>{item.name}</Text>
              <View style={styles.gameMeta}>
                {item.rating != null && item.rating > 0 && (
                  <Text style={styles.rating}>★ {fmt(item.rating)}/10</Text>
                )}
                {meta.length > 0 && <Text style={styles.metaText}>{meta.join(' · ')}</Text>}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No games to show.</Text>}
        ListFooterComponent={
          <Pressable style={styles.removeBtn} onPress={onRemove}>
            <Text style={styles.removeBtnText}>🗑  Remove this library</Text>
          </Pressable>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  list: { padding: spacing.lg, paddingBottom: 60 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: 13, marginTop: 2, marginBottom: spacing.md },
  toolRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
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
  refresh: {
    width: 44,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshText: { color: colors.primary, fontSize: 20 },
  ownedToggle: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: spacing.md,
  },
  ownedToggleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  ownedToggleText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  ownedToggleTextOn: { color: colors.primaryText },
  gameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  gameName: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  gameMeta: { alignItems: 'flex-end' },
  rating: { color: colors.star, fontSize: 13, fontWeight: '700' },
  metaText: { color: colors.textMuted, fontSize: 12 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  removeBtn: {
    marginTop: spacing.xl,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  removeBtnText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
  error: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 21 },
  retry: { paddingVertical: 12, paddingHorizontal: spacing.xl, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary },
  retryText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});

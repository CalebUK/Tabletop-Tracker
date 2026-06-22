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

const SPINE_GAP = 5;
const SPINE_MIN_W = 28;
const SPINE_MAX_W = 48;
const SPINE_COLORS = ['#7d5ba6', '#3a7d44', '#b0543b', '#345995', '#9c4f96', '#c9a227', '#4e8098', '#a8412e', '#2f6d5b', '#86432f'];

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
    // Conservative count (assume the widest spines) so a shelf never overflows;
    // narrower books just leave a little realistic gap at the end.
    const perShelf = Math.max(
      1,
      Math.floor((Dimensions.get('window').width - spacing.lg * 2 - 28) / (SPINE_MAX_W + SPINE_GAP))
    );
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

  // One book spine: shaded to look rounded, with a cream page-block on top and
  // one of a few cover treatments (plain bands / a parchment label / cloth
  // accents) so a shelf looks like a real mix of books. `lean` tilts a book.
  function renderSpine(g: AggregatedGame, lean: number) {
    const seed = hash(g.name);
    const h = 116 + (seed % 60);
    const w = SPINE_MIN_W + (Math.floor(seed / 7) % (SPINE_MAX_W - SPINE_MIN_W));
    const color = SPINE_COLORS[seed % SPINE_COLORS.length];
    const style = seed % 3; // 0 = bands, 1 = parchment label, 2 = cloth accents
    const onLabel = style === 1;
    return (
      <Pressable
        key={g.name}
        style={[
          styles.spine,
          { height: h, width: w, backgroundColor: color },
          lean ? { transform: [{ rotate: `${lean}deg` }], transformOrigin: 'right bottom' } : null,
        ]}
        onPress={() => setSelected(g)}
      >
        <View style={styles.spineHighlight} />
        <View style={styles.spineShadow} />
        {style === 2 && <View style={[styles.coverAccent, styles.coverAccentTop]} />}
        {style === 2 && <View style={[styles.coverAccent, styles.coverAccentBottom]} />}
        {style === 0 && <View style={[styles.spineBand, styles.spineBandTop]} />}
        {style === 0 && <View style={[styles.spineBand, styles.spineBandBottom]} />}
        {onLabel && <View style={styles.label} />}
        <View style={styles.pageTop} />
        <View style={styles.pageTopLine} />
        <View style={styles.spineFoot} />
        <Text
          style={[styles.spineText, onLabel && styles.spineTextDark, { width: h - (onLabel ? 52 : 42) }]}
          numberOfLines={1}
        >
          {g.name}
        </Text>
      </Pressable>
    );
  }

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
          <View style={styles.cabinet}>
            <View style={styles.cabinetTop} />
            {shelves.map((shelf, si) => (
              <View key={si} style={styles.shelf}>
                <View style={styles.shelfInner}>
                  <View style={styles.shelfBack} />
                  <View style={styles.shelfBackShade} />
                  <View style={styles.shelfSpines}>
                    {shelf.map((g, idx, arr) =>
                      // The last book on a not-quite-full shelf leans into the gap.
                      renderSpine(g, idx === arr.length - 1 && arr.length > 2 ? 4 + (hash(g.name) % 5) : 0)
                    )}
                  </View>
                </View>
                <View style={styles.plankTop} />
                <View style={styles.plankFront} />
              </View>
            ))}
          </View>
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

  // The wooden cabinet that frames all the shelves.
  cabinet: {
    backgroundColor: '#5b4636',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingBottom: 6,
    borderWidth: 1,
    borderColor: '#3f2f22',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  cabinetTop: {
    height: 10,
    backgroundColor: '#6b513d',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    marginHorizontal: -10,
    marginBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#3f2f22',
  },
  shelf: { marginBottom: 2 },
  shelfInner: { position: 'relative', paddingHorizontal: 4, paddingTop: 12 },
  // Recessed dark interior so you "see into" the bookcase behind the books.
  shelfBack: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#2b211a' },
  // Soft shadow along the top inner edge of each cubby for depth.
  shelfBackShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  shelfSpines: { flexDirection: 'row', alignItems: 'flex-end', gap: SPINE_GAP, minHeight: 116 },
  // The shelf board: a lit top surface over a darker front edge (3D plank).
  plankTop: { height: 7, backgroundColor: '#7a5c44' },
  plankFront: {
    height: 6,
    backgroundColor: '#3f2f22',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
  },

  // A single book spine, shaded to look rounded.
  spine: {
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderBottomLeftRadius: 1,
    borderBottomRightRadius: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.4)',
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 1, height: 2 },
  },
  spineHighlight: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: 'rgba(255,255,255,0.22)' },
  spineShadow: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, backgroundColor: 'rgba(0,0,0,0.32)' },
  // Cream page block on the top edge of the book.
  pageTop: { position: 'absolute', top: 0, left: 2, right: 2, height: 4, backgroundColor: '#e8dcc0' },
  pageTopLine: { position: 'absolute', top: 4, left: 2, right: 2, height: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  // Contact shadow where the book meets the shelf.
  spineFoot: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(0,0,0,0.3)' },
  spineBand: { position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: 'rgba(0,0,0,0.22)' },
  spineBandTop: { top: 15 },
  spineBandBottom: { bottom: 15 },
  // Cloth-cover accents (style 2).
  coverAccent: { position: 'absolute', left: 0, right: 0, height: 9, backgroundColor: 'rgba(0,0,0,0.26)' },
  coverAccentTop: { top: 7 },
  coverAccentBottom: { bottom: 0 },
  // Parchment title label (style 1).
  label: {
    position: 'absolute',
    top: 22,
    bottom: 22,
    left: 3,
    right: 5,
    backgroundColor: '#efe4cb',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.25)',
  },
  spineText: {
    transform: [{ rotate: '-90deg' }],
    color: '#f4ead8',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 2,
  },
  spineTextDark: { color: '#3a2c1a', textShadowColor: 'transparent' },
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

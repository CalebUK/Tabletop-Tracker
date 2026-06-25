import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { addWishlistGame, getAllGames, getAllLocations, setWishlist, toggleFavorite } from '../db/games';
import { getWishlistInsights } from '../lib/onlineLibrary';
import { getMeta, setMeta } from '../db/meta';
import { STANDALONE_EXPANSIONS_KEY } from './BackupScreen';
import { Game, TasteSuggestion } from '../types';
import { colors, radius, spacing } from '../theme';
import GameCard from '../components/GameCard';
import SwipeableRow from '../components/SwipeableRow';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const NUDGE_KEY = 'backup_nudge_dismissed';
const HIDE_SWIPE_TIPS_KEY = 'hide_swipe_tips';

// Columns in the photo grid view.
const GRID_COLS = 3;

// Pad the list so the last grid row is full (keeps tile widths even). Blanks use
// negative ids and render as empty spacers.
function padForGrid(list: Game[]): Game[] {
  const rem = list.length % GRID_COLS;
  if (rem === 0) return list;
  const blanks = Array.from(
    { length: GRID_COLS - rem },
    (_, i) => ({ id: -1 - i } as unknown as Game)
  );
  return [...list, ...blanks];
}

type SortKey = 'name' | 'rating' | 'played' | 'lastPlayed' | 'recent';
type Dir = 'asc' | 'desc';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'rating', label: 'My rating' },
  { key: 'played', label: 'Times played' },
  { key: 'lastPlayed', label: 'Last played' },
  { key: 'recent', label: 'Date added' },
];

// The direction the first tap on each sort uses (a second tap flips it).
const DEFAULT_DIR: Record<SortKey, Dir> = {
  name: 'asc',
  rating: 'desc',
  played: 'desc',
  lastPlayed: 'desc',
  recent: 'desc',
};

// Plain-English meaning of the current direction, shown on the active sort.
function dirLabel(key: SortKey, dir: Dir): string {
  switch (key) {
    case 'name':
      return dir === 'asc' ? 'A → Z' : 'Z → A';
    case 'rating':
      return dir === 'desc' ? 'Highest first' : 'Lowest first';
    case 'played':
      return dir === 'desc' ? 'Most played' : 'Least played';
    case 'lastPlayed':
      return dir === 'desc' ? 'Most recent first' : 'Unplayed first, then oldest';
    case 'recent':
      return dir === 'desc' ? 'Newest first' : 'Oldest first';
  }
}

// Last-played sort: descending = recent first then unplayed last; ascending =
// unplayed first, then the game played longest ago.
function cmpLastPlayed(a: Game, b: Game, dir: Dir): number {
  const da = a.lastPlayedAt;
  const db = b.lastPlayedAt;
  if (da == null && db == null) return 0;
  if (dir === 'desc') {
    if (da == null) return 1;
    if (db == null) return -1;
    return da < db ? 1 : da > db ? -1 : 0;
  }
  if (da == null) return -1;
  if (db == null) return 1;
  return da < db ? -1 : da > db ? 1 : 0;
}

function sortGames(list: Game[], key: SortKey, dir: Dir): Game[] {
  const arr = [...list];
  const sign = dir === 'desc' ? 1 : -1; // base comparators are written "descending"
  switch (key) {
    case 'name':
      arr.sort((a, b) => a.name.localeCompare(b.name) * (dir === 'asc' ? 1 : -1));
      break;
    case 'rating':
      arr.sort((a, b) => ((b.rating ?? -1) - (a.rating ?? -1)) * sign);
      break;
    case 'played':
      arr.sort((a, b) => (b.playCount - a.playCount) * sign);
      break;
    case 'lastPlayed':
      arr.sort((a, b) => cmpLastPlayed(a, b, dir));
      break;
    case 'recent':
      arr.sort(
        (a, b) =>
          (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.id - a.id) * sign
      );
      break;
  }
  return arr;
}

// Sentinel location filter value for "show everything loaned out".
const LOANED = '__loaned__';

type Mode = 'collection' | 'wishlist';

// Trim a trailing ".0" so 9.0 shows as "9" but 8.5 stays "8.5".
function fmtRating(n: number | null): string {
  if (n == null) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// Compact player count for a grid tile (max includes owned expansions).
function tilePlayers(g: Game): string | null {
  const max = g.maxPlayers != null ? g.maxPlayers + g.expansionPlayers : null;
  if (g.minPlayers && max) return g.minPlayers === max ? `${g.minPlayers}` : `${g.minPlayers}–${max}`;
  if (max) return `${max}`;
  if (g.minPlayers) return `${g.minPlayers}+`;
  return null;
}

export default function CollectionScreen() {
  const navigation = useNavigation<Nav>();
  const [mode, setMode] = useState<Mode>('collection');
  const [games, setGames] = useState<Game[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [locationMenu, setLocationMenu] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<Dir>('asc');
  const [sortMenu, setSortMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [nudgeDismissed, setNudgeDismissed] = useState(true);
  const [hideTips, setHideTips] = useState(false);
  const [showExpansions, setShowExpansions] = useState(false);
  // Wishlist only: game name (lowercased) -> friends (linked libraries) who own it.
  const [friendOwners, setFriendOwners] = useState<Map<string, string[]>>(new Map());
  const [suggestions, setSuggestions] = useState<TasteSuggestion[]>([]);

  const wishlist = mode === 'wishlist';

  const load = useCallback(() => {
    // Read the standalone-expansions toggle first so we know whether to surface
    // linked expansions as their own cards.
    getMeta(STANDALONE_EXPANSIONS_KEY)
      .then((v) => {
        const inc = v === '1';
        setShowExpansions(inc);
        return getAllGames(wishlist, inc);
      })
      .then(setGames)
      .catch((e) => console.warn('load games', e));
    getAllLocations().then(setLocations).catch(() => {});
    getMeta(NUDGE_KEY).then((v) => setNudgeDismissed(v === '1')).catch(() => {});
    getMeta(HIDE_SWIPE_TIPS_KEY).then((v) => setHideTips(v === '1')).catch(() => {});
    // Wishlist extras: owner flags + taste suggestions, in one fetch of the
    // linked friend libraries (best-effort; empty on any failure).
    if (wishlist) {
      getWishlistInsights()
        .then(({ owners, suggestions: sugg }) => {
          setFriendOwners(owners);
          setSuggestions(sugg);
        })
        .catch(() => {
          setFriendOwners(new Map());
          setSuggestions([]);
        });
    } else {
      setFriendOwners(new Map());
      setSuggestions([]);
    }
  }, [wishlist]);

  function onAddSuggestion(s: TasteSuggestion) {
    // Optimistic: drop it from the suggestions strip right away.
    setSuggestions((list) => list.filter((x) => x.game.name !== s.game.name));
    addWishlistGame(s.game)
      .then(load)
      .catch((e) => console.warn('add suggestion', e));
  }

  function dismissNudge() {
    setNudgeDismissed(true);
    setMeta(NUDGE_KEY, '1').catch(() => {});
  }

  // Reload whenever the tab regains focus (e.g. after add/edit/delete) or the
  // collection/wishlist toggle changes.
  useFocusEffect(load);
  useEffect(() => { load(); }, [load]);

  // Switching lists: clear filters that only apply to the collection.
  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setLocationFilter(null);
    setFavoritesOnly(false);
  }

  function moveToCollection(g: Game) {
    Alert.alert(
      'Move to collection?',
      `Add "${g.name}" to your collection? It'll come off your wishlist.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move',
          onPress: () => {
            // Optimistic: drop it from the wishlist list immediately.
            setGames((list) => list.filter((x) => x.id !== g.id));
            setWishlist(g.id, false).catch((e) => console.warn('move to collection', e));
          },
        },
      ]
    );
  }

  // Grid view: the photo (or a named placeholder) with a players/time bar.
  function renderGridItem(item: Game) {
    if (item.id < 0) return <View style={styles.tileBlank} />;
    const players = tilePlayers(item);
    const meta = [players ? `👥 ${players}` : null, item.playTimeMin ? `⏱ ${item.playTimeMin}m` : null]
      .filter(Boolean)
      .join('  ·  ');
    return (
      <Pressable
        style={styles.tile}
        onPress={() => navigation.navigate('GameDetail', { gameId: item.id })}
        onLongPress={
          wishlist || item.baseGameId != null
            ? undefined
            : () => navigation.navigate('LogPlay', { gameId: item.id })
        }
        delayLongPress={300}
      >
        {item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={styles.tileImg} />
        ) : (
          <View style={[styles.tileImg, styles.tilePlaceholder]}>
            <Text style={styles.tileEmoji}>🎲</Text>
            <Text style={styles.tileName} numberOfLines={2}>
              {item.name}
            </Text>
          </View>
        )}
        {item.baseGameId != null && <Text style={styles.tileExp}>🧩</Text>}
        {item.isFavorite && <Text style={styles.tileFav}>♥</Text>}
        {meta ? (
          <View style={styles.tileBar}>
            <Text style={styles.tileBarText} numberOfLines={1}>{meta}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  }

  function onToggleFavorite(g: Game) {
    const next = !g.isFavorite;
    // Optimistic update so the heart responds instantly.
    setGames((list) => list.map((x) => (x.id === g.id ? { ...x, isFavorite: next } : x)));
    toggleFavorite(g.id, next).catch((e) => console.warn('toggle favorite', e));
  }

  function pickLocation(value: string | null) {
    setLocationFilter(value);
    setLocationMenu(false);
  }

  // Tapping a sort selects it (with its default direction); tapping the active
  // sort again reverses it. The menu stays open so the flip is visible.
  function pickSort(key: SortKey) {
    if (key === sortBy) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  }

  const q = query.trim().toLowerCase();
  const filtered = games
    .filter((g) => (favoritesOnly ? g.isFavorite : true))
    .filter((g) => {
      if (locationFilter == null) return true;
      if (locationFilter === LOANED) return !!g.loanedTo;
      return g.location === locationFilter && !g.loanedTo;
    })
    .filter((g) => (q ? g.name.toLowerCase().includes(q) : true));
  const visible = sortGames(filtered, sortBy, sortDir);

  const locationLabel = locationFilter === LOANED ? 'Loaned out' : locationFilter;
  const sortLabel = `${SORTS.find((s) => s.key === sortBy)!.label} · ${dirLabel(sortBy, sortDir)}`;
  const showNudge = !nudgeDismissed && games.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image source={require('../../assets/adaptive-icon.png')} style={styles.logo} />
          <Text style={styles.heading}>{wishlist ? 'My Wishlist' : 'My Collection'}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.count}>
            {games.length} {wishlist ? (games.length === 1 ? 'game' : 'games') : 'games'}
          </Text>
          <Pressable onPress={() => navigation.navigate('Backup')} hitSlop={10}>
            <Text style={styles.gear}>⚙️</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.toggle}>
        <Pressable
          style={[styles.toggleItem, !wishlist && styles.toggleItemOn]}
          onPress={() => switchMode('collection')}
        >
          <Text style={[styles.toggleText, !wishlist && styles.toggleTextOn]}>🎲 Collection</Text>
        </Pressable>
        <Pressable
          style={[styles.toggleItem, wishlist && styles.toggleItemOn]}
          onPress={() => switchMode('wishlist')}
        >
          <Text style={[styles.toggleText, wishlist && styles.toggleTextOn]}>⭐ Wishlist</Text>
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={[styles.search, styles.flex1]}
          placeholder="Quick search by name…"
          placeholderTextColor={colors.placeholder}
          value={query}
          onChangeText={setQuery}
          clearButtonMode="while-editing"
        />
        {!wishlist && (
          <Pressable
            style={[styles.iconBtn, locationFilter != null && styles.iconBtnOn]}
            onPress={() => setLocationMenu(true)}
          >
            <Text style={styles.iconBtnText}>📍</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.iconBtn, favoritesOnly && styles.favOn]}
          onPress={() => setFavoritesOnly((v) => !v)}
        >
          <Text style={[styles.iconBtnText, favoritesOnly && styles.favOnText]}>
            {favoritesOnly ? '♥' : '♡'}
          </Text>
        </Pressable>
      </View>

      {locationFilter != null && (
        <Pressable style={styles.activeChip} onPress={() => setLocationFilter(null)}>
          <Text style={styles.activeChipText}>📍 {locationLabel}  ✕</Text>
        </Pressable>
      )}

      {games.length > 0 && !hideTips && (
        <Text style={styles.hint}>
          {viewMode === 'grid'
            ? wishlist
              ? 'Tap a game to view it'
              : 'Hold to log play'
            : wishlist
            ? 'Swipe → to edit | ← to move into your collection'
            : 'Swipe → to edit | ← to loan | hold to log play'}
        </Text>
      )}

      {showNudge && !wishlist && (
        <View style={styles.nudge}>
          <Text style={styles.nudgeText}>
            💾 Your collection is saved only on this phone. Export a backup to keep it safe.
          </Text>
          <View style={styles.nudgeActions}>
            <Pressable onPress={() => navigation.navigate('Backup')}>
              <Text style={styles.nudgeAction}>Back up</Text>
            </Pressable>
            <Pressable onPress={dismissNudge}>
              <Text style={styles.nudgeDismiss}>Dismiss</Text>
            </Pressable>
          </View>
        </View>
      )}

      {games.length > 0 && (
        <View style={styles.controlsRow}>
          <Pressable style={styles.sortBtn} onPress={() => setSortMenu(true)}>
            <Text style={styles.sortText} numberOfLines={1}>↕  Sort: {sortLabel}</Text>
          </Pressable>
          <View style={styles.viewToggle}>
            <Pressable
              style={[styles.viewBtn, viewMode === 'list' && styles.viewBtnOn]}
              onPress={() => setViewMode('list')}
            >
              <Text style={[styles.viewBtnText, viewMode === 'list' && styles.viewBtnTextOn]}>List</Text>
            </Pressable>
            <Pressable
              style={[styles.viewBtn, viewMode === 'grid' && styles.viewBtnOn]}
              onPress={() => setViewMode('grid')}
            >
              <Text style={[styles.viewBtnText, viewMode === 'grid' && styles.viewBtnTextOn]}>Grid</Text>
            </Pressable>
          </View>
        </View>
      )}

      <FlatList
        key={viewMode}
        data={viewMode === 'grid' ? padForGrid(visible) : visible}
        keyExtractor={(g) => String(g.id)}
        numColumns={viewMode === 'grid' ? GRID_COLS : 1}
        columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
        contentContainerStyle={styles.list}
        renderItem={({ item }) =>
          viewMode === 'grid' ? (
            renderGridItem(item)
          ) : (
            <SwipeableRow
              rightSwipe={{
                icon: '✏️',
                label: 'Edit',
                color: colors.primary,
                onTrigger: () => navigation.navigate('EditGame', { gameId: item.id }),
              }}
              leftSwipe={
                wishlist
                  ? {
                      icon: '✅',
                      label: 'Got it',
                      color: colors.success,
                      onTrigger: () => moveToCollection(item),
                    }
                  : {
                      icon: '🤝',
                      label: item.loanedTo ? 'Manage' : 'Loan',
                      color: colors.favorite,
                      onTrigger: () => navigation.navigate('Loan', { gameId: item.id }),
                    }
              }
            >
              <GameCard
                game={item}
                onPress={() => navigation.navigate('GameDetail', { gameId: item.id })}
                onLongPress={
                  wishlist || item.baseGameId != null
                    ? undefined
                    : () => navigation.navigate('LogPlay', { gameId: item.id })
                }
                onToggleFavorite={() => onToggleFavorite(item)}
                friendsWithGame={wishlist ? friendOwners.get(item.name.trim().toLowerCase()) : undefined}
              />
            </SwipeableRow>
          )
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>{wishlist ? '⭐' : '🎲'}</Text>
            <Text style={styles.emptyTitle}>
              {games.length === 0
                ? wishlist
                  ? 'Nothing on your wishlist yet'
                  : 'No games yet'
                : 'No matches'}
            </Text>
            <Text style={styles.emptyText}>
              {games.length === 0
                ? wishlist
                  ? 'Tap + to add a game you’d love to own.'
                  : 'Tap + to add your first board game.'
                : 'Try a different search or filter.'}
            </Text>
          </View>
        }
        ListFooterComponent={
          wishlist && suggestions.length > 0 ? (
            <View style={styles.suggSection}>
              <Text style={styles.suggHeading}>✨ Suggested for you</Text>
              <Text style={styles.suggIntro}>
                From friends whose ratings line up with yours.
              </Text>
              {suggestions.map((s) => (
                <View key={s.game.name} style={styles.suggCard}>
                  <Text style={styles.suggWho}>
                    You &amp; {s.friend} have similar tastes
                  </Text>
                  <Text style={styles.suggGame} numberOfLines={1}>
                    {s.game.name}
                  </Text>
                  <Text style={styles.suggMeta}>
                    {s.friend} rated it {fmtRating(s.game.rating)}/10 · you agreed on{' '}
                    {s.closeCount}/{s.sharedCount} shared games
                  </Text>
                  <Pressable style={styles.suggAdd} onPress={() => onAddSuggestion(s)}>
                    <Text style={styles.suggAddText}>＋ Add to wishlist</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null
        }
      />

      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('EditGame', wishlist ? { wishlist: true } : {})}
      >
        <Text style={styles.fabText}>＋</Text>
      </Pressable>

      <Modal visible={locationMenu} animationType="fade" transparent onRequestClose={() => setLocationMenu(false)}>
        <Pressable style={styles.backdrop} onPress={() => setLocationMenu(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Filter by location</Text>
            <ScrollView contentContainerStyle={{ gap: spacing.sm }}>
              <SheetItem label="All locations" active={locationFilter == null} onPress={() => pickLocation(null)} />
              <SheetItem label="🤝 Loaned out" active={locationFilter === LOANED} onPress={() => pickLocation(LOANED)} />
              {locations.map((loc) => (
                <SheetItem
                  key={loc}
                  label={`📍 ${loc}`}
                  active={locationFilter === loc}
                  onPress={() => pickLocation(loc)}
                />
              ))}
              {locations.length === 0 && (
                <Text style={styles.sheetEmpty}>
                  Add storage locations to your games to filter by them here.
                </Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={sortMenu} animationType="fade" transparent onRequestClose={() => setSortMenu(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSortMenu(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Sort by</Text>
            {SORTS.map((s) => {
              const isActive = sortBy === s.key;
              return (
                <Pressable
                  key={s.key}
                  style={[styles.sheetItem, isActive && styles.sheetItemOn]}
                  onPress={() => pickSort(s.key)}
                >
                  <View style={styles.sortItemRow}>
                    <Text style={[styles.sheetItemText, isActive && styles.sheetItemTextOn]}>
                      {s.label}
                    </Text>
                    {isActive && (
                      <Text style={styles.sortItemDir}>
                        {sortDir === 'asc' ? '↑' : '↓'} {dirLabel(s.key, sortDir)}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
            <Text style={styles.sortHint}>Tap the selected sort again to reverse it.</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function SheetItem({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.sheetItem, active && styles.sheetItemOn]} onPress={onPress}>
      <Text style={[styles.sheetItemText, active && styles.sheetItemTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { width: 40, height: 40 },
  gear: { fontSize: 20 },
  heading: { color: colors.text, fontSize: 26, fontWeight: '700' },
  count: { color: colors.textMuted, fontSize: 14 },
  toggle: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  toggleItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  toggleItemOn: { backgroundColor: colors.primary },
  toggleText: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  toggleTextOn: { color: colors.primaryText },
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
  iconBtn: {
    width: 44,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  iconBtnText: { color: colors.text, fontSize: 18 },
  favOn: { backgroundColor: colors.favorite, borderColor: colors.favorite },
  favOnText: { color: '#fff' },
  activeChip: {
    alignSelf: 'flex-start',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  activeChipText: { color: colors.text, fontSize: 13 },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  nudge: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  nudgeText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  nudgeActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xl },
  nudgeAction: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  nudgeDismiss: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  suggSection: { marginTop: spacing.xl, gap: spacing.sm },
  suggHeading: { color: colors.text, fontSize: 18, fontWeight: '700' },
  suggIntro: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.xs },
  suggCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  suggWho: { color: colors.success, fontSize: 12, fontWeight: '700' },
  suggGame: { color: colors.text, fontSize: 17, fontWeight: '700' },
  suggMeta: { color: colors.textMuted, fontSize: 13 },
  suggAdd: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  suggAddText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sortBtn: { flex: 1 },
  sortText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  viewBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  viewBtnOn: { backgroundColor: colors.primary },
  viewBtnText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  viewBtnTextOn: { color: colors.primaryText },
  list: { padding: spacing.lg, paddingTop: spacing.md, paddingBottom: 120 },
  gridRow: { gap: spacing.sm, marginBottom: spacing.sm },
  tile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileBlank: { flex: 1, aspectRatio: 1 },
  tileImg: { width: '100%', height: '100%' },
  tilePlaceholder: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    gap: 4,
  },
  tileEmoji: { fontSize: 28 },
  tileName: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },
  tileFav: {
    position: 'absolute',
    top: 4,
    right: 6,
    color: colors.favorite,
    fontSize: 16,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  tileExp: {
    position: 'absolute',
    top: 4,
    left: 6,
    fontSize: 15,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  tileBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 3,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  tileBarText: { color: '#fff', fontSize: 11, fontWeight: '600' },
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '70%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  sheetTitle: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginBottom: spacing.xs },
  sheetItem: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  sheetItemOn: { backgroundColor: colors.primary },
  sheetItemText: { color: colors.text, fontSize: 16 },
  sheetItemTextOn: { color: colors.primaryText, fontWeight: '700' },
  sortItemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sortItemDir: { color: colors.primaryText, fontSize: 12, fontWeight: '600', marginLeft: spacing.sm },
  sortHint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xs },
  sheetEmpty: { color: colors.textMuted, fontSize: 13, paddingVertical: spacing.sm },
});

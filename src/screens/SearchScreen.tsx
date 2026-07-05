import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { searchGames, getAllTags, getAllCategories } from '../db/games';
import { fetchAllGames } from '../lib/onlineLibrary';
import { getFriendLibraries, libraryLabel, FriendLibrary } from '../db/library';
import { AggregatedGame, Game, SearchFilters } from '../types';
import { colors, radius, spacing } from '../theme';
import GameCard from '../components/GameCard';

// A friend-library game as shown in results, with who owns it.
interface LibResult {
  name: string;
  minPlayers: number | null;
  maxPlayers: number | null;
  playTimeMin: number | null;
  image: string | null;
  rating: number | null;
  owners: string[];
}

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
  atHomeOnly: false,
  maxPlayTime: null,
  minPlayTime: null,
  playerCount: null,
  minRating: null,
  minBggRating: null,
  ageBands: [],
  teachRatings: [],
  category: null,
  types: [],
};

const GAME_TYPES: { key: 'duel' | 'party' | 'coop'; label: string }[] = [
  { key: 'duel', label: 'Duel' },
  { key: 'party', label: 'Party' },
  { key: 'coop', label: 'Co-Op' },
];

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
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [categoryMenu, setCategoryMenu] = useState(false);
  const [labelMenu, setLabelMenu] = useState(false);
  // Whether the detailed criteria are expanded (collapse for a cleaner results view).
  const [criteriaOpen, setCriteriaOpen] = useState(true);
  // Search scope: 'collection' (yours), 'friends' (all friends' games), or a
  // friend library's share code.
  const [scope, setScope] = useState<string>('collection');
  const [scopeMenu, setScopeMenu] = useState(false);
  const [friendLibs, setFriendLibs] = useState<FriendLibrary[]>([]);
  const [libGames, setLibGames] = useState<AggregatedGame[] | null>(null);
  const [libLoading, setLibLoading] = useState(false);

  const isLibrary = scope !== 'collection';

  // "Feeling lucky" dice-roll animation state.
  const [rolling, setRolling] = useState(false);
  const [rollName, setRollName] = useState('');
  const lastPickId = useRef<number | null>(null);
  const spin = useRef(new Animated.Value(0)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Clear any pending roll timers if we leave the screen mid-roll.
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Run on focus (so edits/additions show up when you return to the tab) and
  // whenever the filters change.
  useFocusEffect(
    useCallback(() => {
      getAllTags().then(setAllTags);
      getAllCategories().then(setAllCategories);
      getFriendLibraries().then(setFriendLibs).catch(() => {});
      searchGames(filters).then(setResults).catch((e) => console.warn('search', e));
    }, [filters])
  );

  // Fetch friends' games once, the first time a library scope is used.
  useEffect(() => {
    if (isLibrary && libGames === null && !libLoading) {
      setLibLoading(true);
      fetchAllGames(false)
        .then(setLibGames)
        .catch(() => setLibGames([]))
        .finally(() => setLibLoading(false));
    }
  }, [isLibrary, libGames, libLoading]);

  function patch(p: Partial<SearchFilters>) {
    setFilters((f) => ({ ...f, ...p }));
  }

  // Label for the current scope (for the dropdown button + result header).
  function scopeLabel(s: string): string {
    if (s === 'collection') return 'My collection';
    if (s === 'friends') return "All friends' games";
    const f = friendLibs.find((l) => l.code === s);
    return f ? libraryLabel(f) : 'Library';
  }

  // Turn the fetched friends' games into result rows for the current scope,
  // then apply the filters that library data can support.
  function libraryResults(): LibResult[] {
    if (!libGames) return [];
    const wantOwner = scope === 'friends' ? null : scopeLabel(scope);
    const rows: LibResult[] = [];
    for (const g of libGames) {
      const owners = wantOwner ? g.owners.filter((o) => o.owner === wantOwner) : g.owners;
      if (owners.length === 0) continue; // not in this specific library
      const rating = wantOwner
        ? owners[0].rating
        : g.owners.reduce<number | null>((m, o) => (o.rating != null && (m == null || o.rating > m) ? o.rating : m), null);
      rows.push({
        name: g.name,
        minPlayers: g.minPlayers,
        maxPlayers: g.maxPlayers,
        playTimeMin: g.playTimeMin,
        image: g.image,
        rating,
        owners: owners.map((o) => o.owner),
      });
    }

    const q = filters.text.trim().toLowerCase();
    return rows
      .filter((g) => {
        if (q && !g.name.toLowerCase().includes(q)) return false;
        if (filters.playerCount != null) {
          const pc = filters.playerCount;
          if (pc >= 7) {
            if (!(g.maxPlayers != null && g.maxPlayers >= pc)) return false;
          } else if (!(g.minPlayers != null && g.maxPlayers != null && g.minPlayers <= pc && g.maxPlayers >= pc)) {
            return false;
          }
        }
        if (filters.maxPlayTime != null && !(g.playTimeMin != null && g.playTimeMin <= filters.maxPlayTime)) return false;
        if (filters.minPlayTime != null && !(g.playTimeMin != null && g.playTimeMin >= filters.minPlayTime)) return false;
        if (filters.minRating != null && !(g.rating != null && g.rating >= filters.minRating)) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // Pick a random matching game — avoiding the previous pick — then play a
  // short dice-roll animation before opening it.
  function feelingLucky() {
    if (rolling || results.length === 0) return;

    // Don't immediately repeat the last pick (unless it's the only match).
    const pool =
      results.length > 1 && lastPickId.current != null
        ? results.filter((g) => g.id !== lastPickId.current)
        : results;
    const finalPick = pool[Math.floor(Math.random() * pool.length)];
    lastPickId.current = finalPick.id;

    setRolling(true);
    setRollName(results[Math.floor(Math.random() * results.length)].name);

    // Spin the dice while it "rolls".
    spin.setValue(0);
    const spinLoop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 450, easing: Easing.linear, useNativeDriver: true })
    );
    spinLoop.start();

    // Flick through random names to look like it's shuffling.
    const flick = setInterval(() => {
      setRollName(results[Math.floor(Math.random() * results.length)].name);
    }, 90);

    // Settle on the chosen game, then open it.
    timers.current.push(
      setTimeout(() => {
        clearInterval(flick);
        spinLoop.stop();
        setRollName(finalPick.name);
        timers.current.push(
          setTimeout(() => {
            setRolling(false);
            navigation.navigate('GameDetail', { gameId: finalPick.id });
          }, 650)
        );
      }, 1100)
    );
  }

  const active =
    filters.text || filters.tags.length || filters.favoritesOnly ||
    filters.unplayedOnly || filters.atHomeOnly || filters.maxPlayTime != null || filters.minPlayTime != null ||
    filters.playerCount != null || filters.minRating != null || filters.minBggRating != null ||
    filters.ageBands.length > 0 || filters.teachRatings.length > 0 || filters.category != null ||
    filters.types.length > 0;

  // How many of the collapsible criteria are set (shown on the header when
  // collapsed). Library scopes only count the filters that apply to them.
  const criteriaCount = isLibrary
    ? (filters.playerCount != null ? 1 : 0) +
      (filters.maxPlayTime != null || filters.minPlayTime != null ? 1 : 0) +
      (filters.minRating != null ? 1 : 0)
    : (filters.playerCount != null ? 1 : 0) +
      (filters.maxPlayTime != null || filters.minPlayTime != null ? 1 : 0) +
      (filters.teachRatings.length ? 1 : 0) +
      (filters.types.length ? 1 : 0) +
      (filters.ageBands.length ? 1 : 0) +
      (filters.minRating != null ? 1 : 0) +
      (filters.category != null ? 1 : 0) +
      (filters.tags.length ? 1 : 0);

  const libFiltered = isLibrary ? libraryResults() : [];
  const resultCount = isLibrary ? libFiltered.length : results.length;

  function renderLibRow(g: LibResult) {
    const meta = [
      g.minPlayers && g.maxPlayers
        ? g.minPlayers === g.maxPlayers
          ? `${g.minPlayers}p`
          : `${g.minPlayers}–${g.maxPlayers}p`
        : null,
      g.playTimeMin ? `${g.playTimeMin} min` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      <View style={styles.libRow}>
        {g.image ? (
          <Image source={{ uri: g.image }} style={styles.libThumb} />
        ) : (
          <View style={[styles.libThumb, styles.libPlaceholder]}>
            <Text style={styles.libEmoji}>🎲</Text>
          </View>
        )}
        <View style={styles.flex1}>
          <Text style={styles.libName} numberOfLines={1}>{g.name}</Text>
          {scope === 'friends' && g.owners.length > 0 && (
            <Text style={styles.libOwners} numberOfLines={1}>👥 {g.owners.join(', ')}</Text>
          )}
          {meta ? <Text style={styles.libMeta}>{meta}</Text> : null}
        </View>
        {g.rating != null && g.rating > 0 ? (
          <Text style={styles.libRating}>★ {Number.isInteger(g.rating) ? g.rating : g.rating.toFixed(1)}</Text>
        ) : null}
      </View>
    );
  }

  const header = (
    <View style={styles.filters}>
      <Text style={styles.heading}>Find a Game</Text>

      <Pressable style={styles.scopeBtn} onPress={() => setScopeMenu(true)}>
        <Text style={styles.scopeLabel} numberOfLines={1}>🔎  {scopeLabel(scope)}</Text>
        <Text style={styles.scopeCaret}>▾</Text>
      </Pressable>
      {isLibrary && (
        <Text style={styles.scopeNote}>
          Searching friends' shared games — not your own collection.
          {scope === 'friends' ? ' Each result shows who owns it.' : ''}
        </Text>
      )}

      <TextInput
        style={styles.search}
        placeholder={isLibrary ? 'Search their games…' : 'Search name, notes, designer…'}
        placeholderTextColor={colors.placeholder}
        value={filters.text}
        onChangeText={(v) => patch({ text: v })}
      />

      {!isLibrary && (
        <View style={styles.toggleRow}>
          <Toggle label="⭐ Favorites" on={filters.favoritesOnly} onPress={() => patch({ favoritesOnly: !filters.favoritesOnly })} />
          <Toggle label="🆕 Unplayed" on={filters.unplayedOnly} onPress={() => patch({ unplayedOnly: !filters.unplayedOnly })} />
          <Toggle label="🏠 At home" on={filters.atHomeOnly} onPress={() => patch({ atHomeOnly: !filters.atHomeOnly })} />
        </View>
      )}

      <Pressable style={styles.criteriaHeader} onPress={() => setCriteriaOpen((o) => !o)}>
        <Text style={styles.criteriaTitle}>Search criteria</Text>
        {criteriaCount > 0 && (
          <View style={styles.criteriaBadge}>
            <Text style={styles.criteriaBadgeText}>{criteriaCount}</Text>
          </View>
        )}
        <View style={styles.flex1} />
        <Text style={styles.criteriaToggle}>{criteriaOpen ? 'Hide ▾' : 'Show ▸'}</Text>
      </Pressable>

      {criteriaOpen && (
        <>
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

      {!isLibrary && (
        <>
      <Text style={styles.groupLabel}>Teachability</Text>
      <View style={styles.chipWrap}>
        <Toggle label="Any" on={filters.teachRatings.length === 0} onPress={() => patch({ teachRatings: [] })} />
        {[1, 2, 3, 4, 5].map((n) => {
          const on = filters.teachRatings.includes(n);
          return (
            <Toggle
              key={n}
              label={`📖 ${n}`}
              on={on}
              onPress={() =>
                patch({
                  teachRatings: on
                    ? filters.teachRatings.filter((x) => x !== n)
                    : [...filters.teachRatings, n],
                })
              }
            />
          );
        })}
      </View>

      <Text style={styles.groupLabel}>Play style</Text>
      <View style={styles.chipWrap}>
        <Toggle label="Any" on={filters.types.length === 0} onPress={() => patch({ types: [] })} />
        {GAME_TYPES.map((t) => {
          const on = filters.types.includes(t.key);
          return (
            <Toggle
              key={t.key}
              label={t.label}
              on={on}
              onPress={() =>
                patch({
                  types: on
                    ? filters.types.filter((x) => x !== t.key)
                    : [...filters.types, t.key],
                })
              }
            />
          );
        })}
      </View>

      <Text style={styles.groupLabel}>Player age</Text>
      <View style={styles.chipWrap}>
        <Toggle label="Any" on={filters.ageBands.length === 0} onPress={() => patch({ ageBands: [] })} />
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
        </>
      )}

      <Text style={styles.groupLabel}>{isLibrary ? 'Rating' : 'My rating'}</Text>
      <View style={styles.chipWrap}>
        <Toggle label="Any" on={filters.minRating == null} onPress={() => patch({ minRating: null })} />
        <Toggle label="3+" on={filters.minRating === 3} onPress={() => patch({ minRating: 3 })} />
        <Toggle label="6+" on={filters.minRating === 6} onPress={() => patch({ minRating: 6 })} />
        <Toggle label="9+" on={filters.minRating === 9} onPress={() => patch({ minRating: 9 })} />
      </View>

      {!isLibrary && (
        <View style={styles.dropRow}>
          <View style={styles.flex1}>
            <Text style={styles.groupLabel}>Category</Text>
            <Pressable style={styles.dropdown} onPress={() => setCategoryMenu(true)}>
              <Text style={styles.dropdownText} numberOfLines={1}>{filters.category ?? 'Any'}</Text>
              <Text style={styles.dropdownCaret}>▾</Text>
            </Pressable>
          </View>
          <View style={styles.flex1}>
            <Text style={styles.groupLabel}>Tags</Text>
            <Pressable style={styles.dropdown} onPress={() => setLabelMenu(true)}>
              <Text style={styles.dropdownText} numberOfLines={1}>{filters.tags[0] ?? 'Any'}</Text>
              <Text style={styles.dropdownCaret}>▾</Text>
            </Pressable>
          </View>
        </View>
      )}
        </>
      )}

      <View style={styles.resultHeader}>
        <Text style={styles.resultCount}>
          {libLoading && isLibrary ? 'Loading…' : `${resultCount} result${resultCount === 1 ? '' : 's'}`}
        </Text>
        {active ? (
          <Pressable onPress={() => setFilters(EMPTY_FILTERS)}>
            <Text style={styles.clear}>Clear all</Text>
          </Pressable>
        ) : null}
      </View>

      {!isLibrary && results.length > 0 && (
        <Pressable style={styles.luckyBtn} onPress={feelingLucky}>
          <Text style={styles.luckyText}>🎲 Feeling lucky</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {isLibrary ? (
        <FlatList
          data={libFiltered}
          keyExtractor={(g, i) => `${g.name}-${i}`}
          ListHeaderComponent={header}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => renderLibRow(item)}
          ListEmptyComponent={
            libLoading ? null : <Text style={styles.noResults}>No games match — or no friends' libraries added yet.</Text>
          }
        />
      ) : (
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
      )}

      <Modal visible={rolling} transparent animationType="fade">
        <View style={styles.rollOverlay}>
          <Animated.Text
            style={[
              styles.rollDice,
              { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] },
            ]}
          >
            🎲
          </Animated.Text>
          <Text style={styles.rollName} numberOfLines={2}>
            {rollName}
          </Text>
        </View>
      </Modal>

      <Modal visible={scopeMenu} animationType="fade" transparent onRequestClose={() => setScopeMenu(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setScopeMenu(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Search in</Text>
            <ScrollView contentContainerStyle={{ gap: spacing.sm }}>
              <CatItem
                label="🎲 My collection"
                active={scope === 'collection'}
                onPress={() => { setScope('collection'); setScopeMenu(false); }}
              />
              <CatItem
                label="🤝 All friends' games"
                active={scope === 'friends'}
                onPress={() => { setScope('friends'); setScopeMenu(false); }}
              />
              {friendLibs.map((f) => (
                <CatItem
                  key={f.code}
                  label={libraryLabel(f)}
                  active={scope === f.code}
                  onPress={() => { setScope(f.code); setScopeMenu(false); }}
                />
              ))}
              {friendLibs.length === 0 && (
                <Text style={styles.sheetNote}>
                  Add a friend's library code on the Library tab to search it here.
                </Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={categoryMenu} animationType="fade" transparent onRequestClose={() => setCategoryMenu(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setCategoryMenu(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Category</Text>
            <ScrollView contentContainerStyle={{ gap: spacing.sm }}>
              <CatItem
                label="Any category"
                active={filters.category == null}
                onPress={() => { patch({ category: null }); setCategoryMenu(false); }}
              />
              {allCategories.map((c) => (
                <CatItem
                  key={c}
                  label={c}
                  active={filters.category === c}
                  onPress={() => { patch({ category: c }); setCategoryMenu(false); }}
                />
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={labelMenu} animationType="fade" transparent onRequestClose={() => setLabelMenu(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setLabelMenu(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Tags</Text>
            <ScrollView contentContainerStyle={{ gap: spacing.sm }}>
              <CatItem
                label="Any tag"
                active={filters.tags.length === 0}
                onPress={() => { patch({ tags: [] }); setLabelMenu(false); }}
              />
              {allTags.map((t) => (
                <CatItem
                  key={t}
                  label={t}
                  active={filters.tags[0] === t}
                  onPress={() => { patch({ tags: [t] }); setLabelMenu(false); }}
                />
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function CatItem({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.catItem, active && styles.catItemOn]} onPress={onPress}>
      <Text style={[styles.catItemText, active && styles.catItemTextOn]}>{label}</Text>
    </Pressable>
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
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  scopeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  scopeLabel: { color: colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  scopeCaret: { color: colors.textMuted, fontSize: 14 },
  scopeNote: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  sheetNote: { color: colors.textMuted, fontSize: 13, lineHeight: 19, paddingVertical: spacing.sm },
  libRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  libThumb: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  libPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  libEmoji: { fontSize: 22 },
  libName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  libOwners: { color: colors.success, fontSize: 12, fontWeight: '600', marginTop: 2 },
  libMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  libRating: { color: colors.star, fontSize: 14, fontWeight: '700' },
  criteriaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginTop: spacing.sm,
  },
  criteriaTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  criteriaBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignItems: 'center',
  },
  criteriaBadgeText: { color: colors.primaryText, fontSize: 12, fontWeight: '700' },
  criteriaToggle: { color: colors.primary, fontSize: 13, fontWeight: '600' },
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
  dropRow: { flexDirection: 'row', gap: spacing.sm },
  flex1: { flex: 1 },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    marginTop: 6,
  },
  dropdownText: { color: colors.text, fontSize: 14, flexShrink: 1, marginRight: 4 },
  dropdownCaret: { color: colors.textMuted, fontSize: 14 },
  sheetBackdrop: {
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
  catItem: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  catItemOn: { backgroundColor: colors.primary },
  catItemText: { color: colors.text, fontSize: 16 },
  catItemTextOn: { color: colors.primaryText, fontWeight: '700' },
  rollOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  rollDice: { fontSize: 88 },
  rollName: { color: colors.text, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  noResults: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});

import React, { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackProps } from '../navigation';
import { getGame, toggleFavorite, getLoanHistory } from '../db/games';
import { getPlaysForGame, deletePlay } from '../db/plays';
import { Game, LoanRecord, Play } from '../types';
import { colors, radius, spacing } from '../theme';
import { isoToUk } from '../lib/dates';
import StarRating from '../components/StarRating';

function playersText(g: Game): string | null {
  if (g.minPlayers && g.maxPlayers) {
    return g.minPlayers === g.maxPlayers
      ? `${g.minPlayers} players`
      : `${g.minPlayers}–${g.maxPlayers} players`;
  }
  if (g.maxPlayers) return `up to ${g.maxPlayers} players`;
  return null;
}

export default function GameDetailScreen({ route, navigation }: RootStackProps<'GameDetail'>) {
  const { gameId } = route.params;
  const [game, setGame] = useState<Game | null>(null);
  const [plays, setPlays] = useState<Play[]>([]);
  const [loans, setLoans] = useState<LoanRecord[]>([]);

  const load = useCallback(() => {
    getGame(gameId).then((g) => {
      setGame(g);
      if (g) navigation.setOptions({ title: g.name });
    });
    getPlaysForGame(gameId).then(setPlays);
    getLoanHistory(gameId).then(setLoans);
  }, [gameId]);

  useFocusEffect(load);

  React.useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('EditGame', { gameId })}>
          <Text style={styles.editLink}>Edit</Text>
        </Pressable>
      ),
    });
  }, [gameId]);

  if (!game) {
    return <View style={styles.safe} />;
  }

  const meta = [playersText(game), game.playTimeMin ? `${game.playTimeMin} min` : null, game.year ? `${game.year}` : null]
    .filter(Boolean)
    .join('  ·  ');

  async function onToggleFav() {
    if (!game) return;
    await toggleFavorite(game.id, !game.isFavorite);
    load();
  }

  function onDeletePlay(playId: number) {
    Alert.alert('Delete this play?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePlay(playId).then(load) },
    ]);
  }

  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.content}>
      {game.imageUri ? (
        <Image source={{ uri: game.imageUri }} style={styles.hero} />
      ) : (
        <View style={[styles.hero, styles.heroEmpty]}>
          <Text style={{ fontSize: 64 }}>🎲</Text>
        </View>
      )}

      <View style={styles.titleRow}>
        <Text style={styles.title}>{game.name}</Text>
        <Pressable onPress={onToggleFav} hitSlop={10}>
          <Text style={[styles.heart, game.isFavorite && styles.heartOn]}>
            {game.isFavorite ? '♥' : '♡'}
          </Text>
        </Pressable>
      </View>

      {meta ? <Text style={styles.meta}>{meta}</Text> : null}

      <View style={styles.ratingsRow}>
        {game.rating != null && game.rating > 0 && (
          <View style={styles.ratingBlock}>
            <Text style={styles.ratingLabel}>My rating · {game.rating}/10</Text>
            <StarRating value={game.rating} max={10} size={15} />
          </View>
        )}
        {game.bggRating != null && (
          <View style={styles.ratingBlock}>
            <Text style={styles.ratingLabel}>BGG rating</Text>
            <Text style={styles.bgg}>{game.bggRating.toFixed(1)}</Text>
          </View>
        )}
      </View>

      {game.loanedTo ? (
        <Pressable style={styles.loanBanner} onPress={() => navigation.navigate('Loan', { gameId })}>
          <Text style={styles.loanText}>
            🤝 Loaned to <Text style={styles.loanBold}>{game.loanedTo}</Text>
            {game.loanedAt ? ` since ${isoToUk(game.loanedAt)}` : ''}
          </Text>
          <Text style={styles.editLink}>Manage</Text>
        </Pressable>
      ) : game.location ? (
        <Row label="📍 Location" value={game.location} />
      ) : null}
      {game.developer ? <Row label="✍️ Developer" value={game.developer} /> : null}

      {/* House rules shown prominently, below the picture and above play history. */}
      {game.houseRules ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>House Rules</Text>
          <Text style={styles.body}>{game.houseRules}</Text>
        </View>
      ) : null}

      {game.tags.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tags</Text>
          <View style={styles.chipWrap}>
            {game.tags.map((t) => (
              <View key={t} style={styles.chip}>
                <Text style={styles.chipText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {game.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.body}>{game.notes}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.playsHeader}>
          <Text style={styles.sectionTitle}>Plays ({plays.length})</Text>
          <Pressable onPress={() => navigation.navigate('LogPlay', { gameId })}>
            <Text style={styles.editLink}>+ Log play</Text>
          </Pressable>
        </View>

        {plays.length === 0 ? (
          <Text style={styles.bodyMuted}>No plays logged yet.</Text>
        ) : (
          plays.map((p) => (
            <Pressable
              key={p.id}
              style={styles.playCard}
              onPress={() => navigation.navigate('LogPlay', { gameId, playId: p.id })}
              onLongPress={() => onDeletePlay(p.id)}
            >
              <Text style={styles.playDate}>{isoToUk(p.playedAt)}</Text>
              {p.players.length > 0 && (
                <Text style={styles.playPlayers}>
                  {p.players
                    .map((pl) => (pl.isWinner ? `🏆 ${pl.name}` : pl.name))
                    .join(', ')}
                </Text>
              )}
              {p.notes ? <Text style={styles.bodyMuted}>{p.notes}</Text> : null}
            </Pressable>
          ))
        )}
        {plays.length > 0 && (
          <Text style={styles.hint}>Tap a play to edit · long-press to delete.</Text>
        )}
      </View>

      {loans.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Loan history</Text>
          {loans.map((l) => (
            <View key={l.id} style={styles.loanRow}>
              <Text style={styles.loanWho}>{l.loanedTo}</Text>
              <Text style={styles.loanDates}>
                {isoToUk(l.loanedAt)}
                {l.returnedAt ? ` → ${isoToUk(l.returnedAt)}` : ' → out now'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  hero: { width: '100%', height: 240, borderRadius: radius.lg },
  heroEmpty: { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  title: { flex: 1, color: colors.text, fontSize: 24, fontWeight: '700' },
  heart: { fontSize: 28, color: colors.textMuted },
  heartOn: { color: colors.favorite },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
  ratingsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl, marginTop: spacing.md },
  ratingBlock: { gap: 4 },
  ratingLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  bgg: { color: colors.success, fontSize: 20, fontWeight: '700' },
  loanBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  loanText: { color: colors.text, fontSize: 14, flex: 1 },
  loanBold: { fontWeight: '700', color: colors.favorite },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  infoLabel: { color: colors.textMuted, fontSize: 14 },
  infoValue: { color: colors.text, fontSize: 14, flexShrink: 1, textAlign: 'right', marginLeft: spacing.md },
  section: { marginTop: spacing.xl },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.sm },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  bodyMuted: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { color: colors.text, fontSize: 13 },
  playsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  playCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 3,
  },
  playDate: { color: colors.text, fontSize: 14, fontWeight: '600' },
  playPlayers: { color: colors.text, fontSize: 14 },
  loanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  loanWho: { color: colors.text, fontSize: 14, fontWeight: '600' },
  loanDates: { color: colors.textMuted, fontSize: 13 },
  editLink: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
});

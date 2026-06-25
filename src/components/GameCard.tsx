import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Game } from '../types';
import { colors, radius, spacing } from '../theme';

interface Props {
  game: Game;
  onPress: () => void;
  onLongPress?: () => void;
  onToggleFavorite?: () => void;
  // For wishlist cards: names of friends (linked libraries) who own this game.
  friendsWithGame?: string[];
}

// "Sarah has this" / "Sarah & Tom have this" / "Sarah, Tom +2 have this".
function friendsLine(names: string[]): string {
  if (names.length === 1) return `${names[0]} has this`;
  if (names.length === 2) return `${names[0]} & ${names[1]} have this`;
  return `${names[0]}, ${names[1]} +${names.length - 2} have this`;
}

// A loaned-out game shows "Loaned to X" in place of its shelf location.
export function locationLine(g: Game): { icon: string; text: string } | null {
  if (g.loanedTo) return { icon: '🤝', text: `Loaned to ${g.loanedTo}` };
  if (g.location) return { icon: '📍', text: g.location };
  return null;
}

// Trim a trailing ".0" so 7.0 shows as "7" but 7.5 stays "7.5".
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// "2–6" / "2" / "up to 6" / "2+" — the player count for the card, or null.
// Max includes extra players from owned expansions (e.g. base 2–4 + "+2" = 2–6).
function playersText(g: Game): string | null {
  const max = g.maxPlayers != null ? g.maxPlayers + g.expansionPlayers : null;
  if (g.minPlayers && max) {
    return g.minPlayers === max ? `${g.minPlayers}` : `${g.minPlayers}–${max}`;
  }
  if (max) return `up to ${max}`;
  if (g.minPlayers) return `${g.minPlayers}+`;
  return null;
}

export default function GameCard({
  game,
  onPress,
  onLongPress,
  onToggleFavorite,
  friendsWithGame,
}: Props) {
  const loc = locationLine(game);
  const hasRating = game.rating != null && game.rating > 0;
  const friends = friendsWithGame ?? [];
  const players = playersText(game);

  return (
    <Pressable style={styles.card} onPress={onPress} onLongPress={onLongPress} delayLongPress={300}>
      {game.imageUri ? (
        <Image source={{ uri: game.imageUri }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Text style={styles.thumbEmoji}>🎲</Text>
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {game.name}
          </Text>
          {game.baseGameId != null ? (
            <Text style={styles.expansions} numberOfLines={1}>{'  '}🧩 Expansion</Text>
          ) : game.expansionCount > 0 ? (
            <Text style={styles.expansions} numberOfLines={1}>
              {'  '}🧩 {game.expansionCount} expansion{game.expansionCount === 1 ? '' : 's'}
            </Text>
          ) : null}
          <View style={styles.spacer} />
          {onToggleFavorite ? (
            <Pressable onPress={onToggleFavorite} hitSlop={10}>
              <Text style={[styles.fav, game.isFavorite && styles.favOn]}>
                {game.isFavorite ? '♥' : '♡'}
              </Text>
            </Pressable>
          ) : (
            game.isFavorite && <Text style={styles.favOn}>♥</Text>
          )}
        </View>

        {game.isWishlist ? (
          friends.length > 0 ? (
            <Text style={styles.friends} numberOfLines={1}>
              👥 {friendsLine(friends)}
            </Text>
          ) : null
        ) : (
          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              {hasRating && <Text style={styles.myRating}>★ {fmt(game.rating as number)}/10</Text>}
              {loc ? (
                <Text style={[styles.location, game.loanedTo && styles.loaned]} numberOfLines={1}>
                  {loc.icon} {loc.text}
                </Text>
              ) : null}
            </View>
            <View style={styles.infoRight}>
              {players ? <Text style={styles.metaRight}>👥 {players}</Text> : null}
              {game.playTimeMin ? <Text style={styles.metaRight}>⏱ {game.playTimeMin} min</Text> : null}
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  thumb: { width: 92, height: 92 },
  thumbPlaceholder: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbEmoji: { fontSize: 32 },
  body: { flex: 1, padding: spacing.md, justifyContent: 'center', gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { flexShrink: 1, color: colors.text, fontSize: 16, fontWeight: '600' },
  spacer: { flex: 1 },
  fav: { color: colors.textMuted, fontSize: 20, marginLeft: spacing.sm },
  favOn: { color: colors.favorite, fontSize: 20, marginLeft: spacing.sm },
  myRating: { color: colors.star, fontSize: 13, fontWeight: '700' },
  location: { color: colors.textMuted, fontSize: 13 },
  loaned: { color: colors.favorite },
  friends: { color: colors.success, fontSize: 13, fontWeight: '600' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.sm },
  infoLeft: { flex: 1, gap: 4 },
  infoRight: { alignItems: 'flex-end', gap: 4 },
  metaRight: { color: colors.textMuted, fontSize: 12 },
  expansions: { color: colors.textMuted, fontSize: 12 },
});

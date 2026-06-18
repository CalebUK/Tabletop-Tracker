import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Game } from '../types';
import { colors, radius, spacing } from '../theme';

interface Props {
  game: Game;
  onPress: () => void;
  onToggleFavorite?: () => void;
}

function playerLabel(g: Game): string | null {
  if (g.minPlayers && g.maxPlayers) {
    return g.minPlayers === g.maxPlayers
      ? `${g.minPlayers}p`
      : `${g.minPlayers}–${g.maxPlayers}p`;
  }
  if (g.maxPlayers) return `${g.maxPlayers}p`;
  return null;
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

export default function GameCard({ game, onPress, onToggleFavorite }: Props) {
  const players = playerLabel(game);
  const meta = [players, game.playTimeMin ? `${game.playTimeMin} min` : null].filter(
    Boolean
  ) as string[];
  const loc = locationLine(game);
  const hasRating = game.rating != null && game.rating > 0;

  return (
    <Pressable style={styles.card} onPress={onPress}>
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

        {(hasRating || game.bggRating != null) && (
          <View style={styles.ratingRow}>
            {hasRating && <Text style={styles.myRating}>★ {fmt(game.rating as number)}/10</Text>}
            {game.bggRating != null && (
              <Text style={styles.bgg}>BGG {game.bggRating.toFixed(1)}</Text>
            )}
          </View>
        )}

        {meta.length > 0 && <Text style={styles.meta}>{meta.join('  ·  ')}</Text>}

        {loc ? (
          <Text style={[styles.location, game.loanedTo && styles.loaned]} numberOfLines={1}>
            {loc.icon} {loc.text}
          </Text>
        ) : null}

        {game.tags.length > 0 && (
          <View style={styles.tagRow}>
            {game.tags.slice(0, 3).map((t) => (
              <View key={t} style={styles.tag}>
                <Text style={styles.tagText}>{t}</Text>
              </View>
            ))}
            {game.tags.length > 3 && (
              <Text style={styles.moreTags}>+{game.tags.length - 3}</Text>
            )}
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
  body: { flex: 1, padding: spacing.md, justifyContent: 'center', gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '600' },
  fav: { color: colors.textMuted, fontSize: 20, marginLeft: spacing.sm },
  favOn: { color: colors.favorite, fontSize: 20, marginLeft: spacing.sm },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  myRating: { color: colors.star, fontSize: 13, fontWeight: '700' },
  bgg: { color: colors.success, fontSize: 13, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13 },
  location: { color: colors.textMuted, fontSize: 13 },
  loaned: { color: colors.favorite },
  tagRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  tag: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: { color: colors.textMuted, fontSize: 11 },
  moreTags: { color: colors.textMuted, fontSize: 11 },
});

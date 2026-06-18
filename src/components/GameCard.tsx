import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Game } from '../types';
import { colors, radius, spacing } from '../theme';

interface Props {
  game: Game;
  onPress: () => void;
  onLongPress?: () => void;
  onToggleFavorite?: () => void;
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

export default function GameCard({ game, onPress, onLongPress, onToggleFavorite }: Props) {
  const loc = locationLine(game);
  const hasRating = game.rating != null && game.rating > 0;

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
          {game.expansionCount > 0 && (
            <Text style={styles.expansions} numberOfLines={1}>
              {'  '}🧩 {game.expansionCount} expansion{game.expansionCount === 1 ? '' : 's'}
            </Text>
          )}
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

        {hasRating && <Text style={styles.myRating}>★ {fmt(game.rating as number)}/10</Text>}

        {loc ? (
          <Text style={[styles.location, game.loanedTo && styles.loaned]} numberOfLines={1}>
            {loc.icon} {loc.text}
          </Text>
        ) : null}
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
  expansions: { color: colors.textMuted, fontSize: 12 },
});

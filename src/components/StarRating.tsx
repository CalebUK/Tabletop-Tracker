import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors } from '../theme';

interface Props {
  value: number | null; // 0..max in 0.5 steps
  max?: number; // number of stars (default 10, matching BoardGameGeek)
  size?: number;
  editable?: boolean;
  onChange?: (value: number) => void;
}

// Star rating with half-star support.
// Tapping star N: first tap -> N.0, tap again -> N-0.5, third tap -> clear.
export default function StarRating({
  value,
  max = 10,
  size = 18,
  editable = false,
  onChange,
}: Props) {
  const rating = value ?? 0;
  const positions = Array.from({ length: max }, (_, i) => i + 1);

  function handlePress(n: number) {
    if (rating === n) onChange?.(n - 0.5);
    else if (rating === n - 0.5) onChange?.(0);
    else onChange?.(n);
  }

  return (
    <View style={styles.row}>
      {positions.map((n) => {
        const full = rating >= n;
        const half = !full && rating >= n - 0.5;
        const star = <Star full={full} half={half} size={size} />;
        if (!editable) {
          return (
            <View key={n} style={styles.star}>
              {star}
            </View>
          );
        }
        return (
          <Pressable key={n} hitSlop={4} style={styles.star} onPress={() => handlePress(n)}>
            {star}
          </Pressable>
        );
      })}
    </View>
  );
}

function Star({ full, half, size }: { full: boolean; half: boolean; size: number }) {
  const box = { width: size, height: size + 2 };
  const glyph = { fontSize: size, lineHeight: size + 2 };

  if (half) {
    return (
      <View style={box}>
        <Text style={[glyph, { color: colors.border }]}>★</Text>
        <View style={[styles.halfClip, { width: size / 2, height: size + 2 }]}>
          <Text style={[glyph, { color: colors.star }]}>★</Text>
        </View>
      </View>
    );
  }
  return (
    <Text style={[glyph, { color: full ? colors.star : colors.border }]}>
      {full ? '★' : '☆'}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  star: { paddingHorizontal: 1 },
  halfClip: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
});

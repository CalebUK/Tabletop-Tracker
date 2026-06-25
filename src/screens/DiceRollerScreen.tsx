import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';

const SIDES = [4, 6, 8, 10, 12, 20, 100];

export default function DiceRollerScreen() {
  const [sides, setSides] = useState(6);
  const [count, setCount] = useState(2);
  const [results, setResults] = useState<number[]>([]);

  function roll() {
    setResults(Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides)));
  }

  const total = results.reduce((a, b) => a + b, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Die type</Text>
        <View style={styles.chipRow}>
          {SIDES.map((s) => (
            <Pressable
              key={s}
              style={[styles.chip, sides === s && styles.chipOn]}
              onPress={() => setSides(s)}
            >
              <Text style={[styles.chipText, sides === s && styles.chipTextOn]}>d{s}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>How many?</Text>
        <View style={styles.stepRow}>
          <Pressable style={styles.stepBtn} onPress={() => setCount((c) => Math.max(1, c - 1))}>
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text style={styles.countText}>{count}</Text>
          <Pressable style={styles.stepBtn} onPress={() => setCount((c) => Math.min(20, c + 1))}>
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>

        <Pressable style={styles.rollBtn} onPress={roll}>
          <Text style={styles.rollText}>🎲  Roll {count}d{sides}</Text>
        </Pressable>

        {results.length > 0 && (
          <View style={styles.resultsWrap}>
            <View style={styles.diceWrap}>
              {results.map((r, i) => (
                <View key={i} style={styles.die}>
                  <Text style={styles.dieText}>{r}</Text>
                </View>
              ))}
            </View>
            {results.length > 1 && <Text style={styles.total}>Total: {total}</Text>}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '600', marginTop: spacing.lg, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  chipTextOn: { color: colors.primaryText },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  stepBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: colors.text, fontSize: 26, fontWeight: '700' },
  countText: { color: colors.text, fontSize: 28, fontWeight: '800', minWidth: 40, textAlign: 'center' },
  rollBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  rollText: { color: colors.primaryText, fontSize: 18, fontWeight: '800' },
  resultsWrap: { marginTop: spacing.xl, alignItems: 'center' },
  diceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  die: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dieText: { color: colors.text, fontSize: 24, fontWeight: '800' },
  total: { color: colors.primary, fontSize: 22, fontWeight: '800', marginTop: spacing.lg },
});

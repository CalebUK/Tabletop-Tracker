import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Polygon, Stop, Text as SvgText } from 'react-native-svg';
import { colors, radius, spacing } from '../theme';

const SIDES = [4, 6, 8, 10, 12, 20, 100];
// 3D cube face tones (top lightest, right darkest) for a real-die look.
const TOP = '#f6f8fc';
const RIGHT = '#c3c9d6';
const EDGE = '#a9b1c0';
const INK = '#15171c';

// Isometric cube in a 0–100 viewBox: a front square plus top + right faces.
const FRONT_PTS = '14,32 74,32 74,92 14,92';
const TOP_PTS = '14,32 74,32 96,10 36,10';
const RIGHT_PTS = '74,32 74,92 96,70 96,10';

// d6 pip cell centres on the front face (3×3 grid).
const PX = [29, 44, 59];
const PY = [47, 62, 77];
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function numSize(v: number): number {
  return v >= 100 ? 22 : v >= 10 ? 30 : 40;
}

function DieFace({ value, sides, size }: { value: number; sides: number; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="dieFront" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#eef1f6" />
          <Stop offset="1" stopColor="#d8dde6" />
        </LinearGradient>
      </Defs>
      <Polygon points={TOP_PTS} fill={TOP} stroke={EDGE} strokeWidth="1.5" strokeLinejoin="round" />
      <Polygon points={RIGHT_PTS} fill={RIGHT} stroke={EDGE} strokeWidth="1.5" strokeLinejoin="round" />
      <Polygon points={FRONT_PTS} fill="url(#dieFront)" stroke={EDGE} strokeWidth="1.5" strokeLinejoin="round" />
      {sides === 6 ? (
        PIPS[value]?.map((cell) => (
          <Circle key={cell} cx={PX[cell % 3]} cy={PY[Math.floor(cell / 3)]} r="6" fill={INK} />
        ))
      ) : (
        <SvgText
          x="44"
          y="62"
          fontSize={numSize(value)}
          fontWeight="bold"
          fill={INK}
          textAnchor="middle"
          alignmentBaseline="central"
        >
          {value}
        </SvgText>
      )}
    </Svg>
  );
}

function Die({ value, sides, anim, index }: { value: number; sides: number; anim: Animated.Value; index: number }) {
  // Whole-turn spins so each die settles flat, at different speeds to desync.
  const rotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${360 * (2 + (index % 3))}deg`],
  });
  const translateY = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -30, 0] });
  return (
    <Animated.View style={[styles.die, { transform: [{ translateY }, { rotate }] }]}>
      <DieFace value={value} sides={sides} size={66} />
    </Animated.View>
  );
}

export default function DiceRollerScreen() {
  const [sides, setSides] = useState(6);
  const [count, setCount] = useState(2);
  const [results, setResults] = useState<number[]>([]);
  const [rolling, setRolling] = useState(false);
  const anim = useRef(new Animated.Value(0)).current; // spin + bounce
  const pop = useRef(new Animated.Value(1)).current; // settle pop
  const flicker = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (flicker.current) clearInterval(flicker.current); }, []);

  const randDice = () => Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));

  function roll() {
    if (rolling) return;
    setRolling(true);
    const final = randDice();
    setResults(randDice());
    flicker.current = setInterval(() => setResults(randDice()), 70);
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 850,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      if (flicker.current) clearInterval(flicker.current);
      flicker.current = null;
      setResults(final);
      setRolling(false);
      pop.setValue(0.82);
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }).start();
    });
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

        <Pressable style={[styles.rollBtn, rolling && styles.rollBtnOff]} onPress={roll} disabled={rolling}>
          <Text style={styles.rollText}>🎲  {rolling ? 'Rolling…' : `Roll ${count}d${sides}`}</Text>
        </Pressable>

        {results.length > 0 && (
          <Animated.View style={[styles.resultsWrap, { transform: [{ scale: pop }] }]}>
            <View style={styles.diceWrap}>
              {results.map((r, i) => (
                <Die key={i} value={r} sides={sides} anim={anim} index={i} />
              ))}
            </View>
            {results.length > 1 && !rolling && <Text style={styles.total}>Total: {total}</Text>}
          </Animated.View>
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
  rollBtnOff: { opacity: 0.6 },
  rollText: { color: colors.primaryText, fontSize: 18, fontWeight: '800' },
  resultsWrap: { marginTop: spacing.xl * 1.5, alignItems: 'center' },
  diceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, justifyContent: 'center' },
  die: { width: 66, height: 66, alignItems: 'center', justifyContent: 'center' },
  total: { color: colors.primary, fontSize: 22, fontWeight: '800', marginTop: spacing.xl },
});

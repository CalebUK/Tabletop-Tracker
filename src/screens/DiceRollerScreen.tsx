import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Polygon, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { colors, radius, spacing } from '../theme';

const SIDES = [4, 6, 8, 10, 12, 20, 100];
const FACE_EDGE = '#b9bfca';
const INK = '#15171c';

// Polyhedral silhouettes in a 0–100 viewBox (d6 is drawn as a rounded rect).
const SHAPES: Record<number, string> = {
  4: '50,8 93,86 7,86',
  8: '50,5 95,50 50,95 5,50',
  10: '50,5 89,40 50,96 11,40',
  12: '50,5 93,39 76,93 24,93 7,39',
  20: '50,4 91,27 91,73 50,96 9,73 9,27',
  100: '50,5 89,40 50,96 11,40',
};

// d6 pip cells → grid (col,row) centres in the viewBox.
const COLS = [30, 50, 70];
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function numSize(v: number): number {
  return v >= 100 ? 26 : v >= 10 ? 36 : 46;
}

function DieFace({ value, sides, size }: { value: number; sides: number; size: number }) {
  const gid = `dieGrad${sides}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="1" stopColor="#d4d9e2" />
        </LinearGradient>
      </Defs>
      {sides === 6 ? (
        <>
          <Rect x="5" y="5" width="90" height="90" rx="16" fill={`url(#${gid})`} stroke={FACE_EDGE} strokeWidth="2" />
          {PIPS[value]?.map((cell) => (
            <Circle key={cell} cx={COLS[cell % 3]} cy={COLS[Math.floor(cell / 3)]} r="7.5" fill={INK} />
          ))}
        </>
      ) : (
        <>
          <Polygon
            points={SHAPES[sides] ?? SHAPES[100]}
            fill={`url(#${gid})`}
            stroke={FACE_EDGE}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {sides === 20 && (
            <Polygon points="50,30 70,64 30,64" fill="none" stroke={FACE_EDGE} strokeWidth="1.5" strokeLinejoin="round" />
          )}
          <SvgText
            x="50"
            y={sides === 4 ? 80 : 50}
            fontSize={numSize(value)}
            fontWeight="bold"
            fill={INK}
            textAnchor="middle"
            alignmentBaseline="central"
          >
            {value}
          </SvgText>
        </>
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

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';

type Op = '+' | '−' | '×' | '÷';

function compute(a: number, b: number, op: Op): number {
  switch (op) {
    case '+': return a + b;
    case '−': return a - b;
    case '×': return a * b;
    case '÷': return b === 0 ? NaN : a / b;
  }
}

// Trim float noise (e.g. 0.1 + 0.2) without showing endless decimals.
function fmt(n: number): string {
  if (!Number.isFinite(n)) return 'Error';
  return String(parseFloat(n.toPrecision(12)));
}

export default function CalculatorScreen() {
  const [display, setDisplay] = useState('0');
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [overwrite, setOverwrite] = useState(true);

  const isError = display === 'Error';

  function clearAll() {
    setDisplay('0');
    setAcc(null);
    setOp(null);
    setOverwrite(true);
  }

  function inputDigit(d: string) {
    if (isError) clearAll();
    if (overwrite) {
      setDisplay(d);
      setOverwrite(false);
    } else {
      setDisplay((s) => (s === '0' ? d : s + d));
    }
  }

  function inputDot() {
    if (isError) { setDisplay('0.'); setOverwrite(false); return; }
    if (overwrite) { setDisplay('0.'); setOverwrite(false); return; }
    setDisplay((s) => (s.includes('.') ? s : s + '.'));
  }

  function toggleSign() {
    if (isError) return;
    setDisplay((s) => (s.startsWith('-') ? s.slice(1) : s === '0' ? s : '-' + s));
  }

  function percent() {
    if (isError) return;
    setDisplay((s) => fmt(parseFloat(s) / 100));
    setOverwrite(true);
  }

  function chooseOp(next: Op) {
    if (isError) return;
    const v = parseFloat(display);
    if (op != null && !overwrite && acc != null) {
      const r = compute(acc, v, op);
      setAcc(r);
      setDisplay(fmt(r));
    } else {
      setAcc(v);
    }
    setOp(next);
    setOverwrite(true);
  }

  function equals() {
    if (op == null || acc == null || isError) return;
    const v = parseFloat(display);
    const r = compute(acc, v, op);
    setDisplay(fmt(r));
    setAcc(null);
    setOp(null);
    setOverwrite(true);
  }

  const KEYS: { label: string; kind?: 'op' | 'fn' | 'eq'; onPress: () => void; wide?: boolean; active?: boolean }[] = [
    { label: 'C', kind: 'fn', onPress: clearAll },
    { label: '±', kind: 'fn', onPress: toggleSign },
    { label: '%', kind: 'fn', onPress: percent },
    { label: '÷', kind: 'op', onPress: () => chooseOp('÷'), active: op === '÷' && overwrite },
    { label: '7', onPress: () => inputDigit('7') },
    { label: '8', onPress: () => inputDigit('8') },
    { label: '9', onPress: () => inputDigit('9') },
    { label: '×', kind: 'op', onPress: () => chooseOp('×'), active: op === '×' && overwrite },
    { label: '4', onPress: () => inputDigit('4') },
    { label: '5', onPress: () => inputDigit('5') },
    { label: '6', onPress: () => inputDigit('6') },
    { label: '−', kind: 'op', onPress: () => chooseOp('−'), active: op === '−' && overwrite },
    { label: '1', onPress: () => inputDigit('1') },
    { label: '2', onPress: () => inputDigit('2') },
    { label: '3', onPress: () => inputDigit('3') },
    { label: '+', kind: 'op', onPress: () => chooseOp('+'), active: op === '+' && overwrite },
    { label: '0', onPress: () => inputDigit('0'), wide: true },
    { label: '.', onPress: inputDot },
    { label: '=', kind: 'eq', onPress: equals },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.displayWrap}>
        <Text style={styles.display} numberOfLines={1} adjustsFontSizeToFit>
          {display}
        </Text>
      </View>
      <View style={styles.grid}>
        {KEYS.map((k) => (
          <Pressable
            key={k.label}
            style={[
              styles.key,
              k.wide && styles.keyWide,
              k.kind === 'op' && styles.keyOp,
              k.kind === 'fn' && styles.keyFn,
              k.kind === 'eq' && styles.keyEq,
              k.active && styles.keyOpActive,
            ]}
            onPress={k.onPress}
          >
            <Text
              style={[
                styles.keyText,
                (k.kind === 'op' || k.kind === 'eq') && styles.keyTextLight,
                k.kind === 'fn' && styles.keyTextFn,
              ]}
            >
              {k.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const GAP = spacing.sm;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  displayWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.lg,
  },
  display: { color: colors.text, fontSize: 64, fontWeight: '300' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  key: {
    width: `${(100 - 3 * 2) / 4}%`,
    aspectRatio: 1.15,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyWide: { width: `${(100 - 3 * 2) / 4 * 2 + 2}%`, aspectRatio: undefined },
  keyOp: { backgroundColor: colors.primary },
  keyOpActive: { borderWidth: 3, borderColor: colors.primaryText },
  keyFn: { backgroundColor: colors.surface },
  keyEq: { backgroundColor: colors.primary },
  keyText: { color: colors.text, fontSize: 28, fontWeight: '600' },
  keyTextLight: { color: colors.primaryText, fontWeight: '700' },
  keyTextFn: { color: colors.textMuted },
});

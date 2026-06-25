import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';

export default function WhoGoesFirstScreen() {
  const [names, setNames] = useState<string[]>(['', '']);
  const [slot, setSlot] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pop = useRef(new Animated.Value(1)).current;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function setName(i: number, v: string) {
    setNames((list) => list.map((n, idx) => (idx === i ? v : n)));
  }
  function addRow() {
    setNames((list) => [...list, '']);
  }
  function removeRow(i: number) {
    setNames((list) => (list.length <= 2 ? list : list.filter((_, idx) => idx !== i)));
  }

  function decide() {
    if (spinning) return;
    const players = names.map((n) => n.trim()).filter(Boolean);
    if (players.length < 2) return;

    setSpinning(true);
    setLanded(false);
    const finalPick = players[Math.floor(Math.random() * players.length)];
    const totalSpins = 18 + Math.floor(Math.random() * players.length);
    let i = 0;

    const step = () => {
      setSlot(players[i % players.length]);
      i += 1;
      if (i >= totalSpins) {
        setSlot(finalPick);
        setSpinning(false);
        setLanded(true);
        pop.setValue(0.6);
        Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
        return;
      }
      // Ease-out: the reel slows as it approaches the end.
      const progress = i / totalSpins;
      const delay = 45 + progress * progress * 230;
      timer.current = setTimeout(step, delay);
    };
    step();
  }

  const enough = names.filter((n) => n.trim()).length >= 2;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.slot, landed && styles.slotLanded]}>
          {landed && <Text style={styles.slotCaption}>Goes first</Text>}
          <Animated.Text
            style={[styles.slotName, !slot && styles.slotPlaceholder, { transform: [{ scale: landed ? pop : 1 }] }]}
            numberOfLines={1}
          >
            {slot ?? '🎰'}
          </Animated.Text>
        </View>

        <Pressable style={[styles.decideBtn, !enough && styles.decideOff]} onPress={decide} disabled={!enough || spinning}>
          <Text style={styles.decideText}>{spinning ? 'Spinning…' : '🎲  Decide!'}</Text>
        </Pressable>

        <Text style={styles.label}>Players</Text>
        {names.map((n, i) => (
          <View key={i} style={styles.row}>
            <TextInput
              style={styles.input}
              value={n}
              onChangeText={(v) => setName(i, v)}
              placeholder={`Player ${i + 1}`}
              placeholderTextColor={colors.placeholder}
            />
            <Pressable onPress={() => removeRow(i)} hitSlop={8} style={styles.removeBtn}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
        ))}
        <Pressable onPress={addRow} style={styles.addBtn}>
          <Text style={styles.addText}>+ Add player</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  slot: {
    height: 130,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  slotLanded: { borderColor: colors.star },
  slotCaption: { color: colors.textMuted, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  slotName: { color: colors.star, fontSize: 34, fontWeight: '800', textAlign: 'center' },
  slotPlaceholder: { color: colors.textMuted, fontSize: 44 },
  decideBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  decideOff: { opacity: 0.4 },
  decideText: { color: colors.primaryText, fontSize: 18, fontWeight: '800' },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '600', marginTop: spacing.xl, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 15,
  },
  removeBtn: { paddingHorizontal: 4 },
  remove: { color: colors.danger, fontSize: 18 },
  addBtn: { paddingVertical: spacing.sm },
  addText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});

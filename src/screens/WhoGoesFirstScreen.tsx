import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';

export default function WhoGoesFirstScreen() {
  const [names, setNames] = useState<string[]>(['', '']);
  const [order, setOrder] = useState<string[] | null>(null);

  function setName(i: number, v: string) {
    setNames((list) => list.map((n, idx) => (idx === i ? v : n)));
    setOrder(null);
  }
  function addRow() {
    setNames((list) => [...list, '']);
  }
  function removeRow(i: number) {
    setNames((list) => (list.length <= 2 ? list : list.filter((_, idx) => idx !== i)));
    setOrder(null);
  }

  function decide() {
    const players = names.map((n) => n.trim()).filter(Boolean);
    if (players.length < 2) return;
    // Fisher–Yates shuffle for a fair random turn order.
    const shuffled = [...players];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setOrder(shuffled);
  }

  const enough = names.filter((n) => n.trim()).length >= 2;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
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

        <Pressable style={[styles.decideBtn, !enough && styles.decideOff]} onPress={decide} disabled={!enough}>
          <Text style={styles.decideText}>👑  Decide!</Text>
        </Pressable>

        {order && (
          <View style={styles.result}>
            <Text style={styles.firstLabel}>Goes first</Text>
            <Text style={styles.firstName}>{order[0]}</Text>
            {order.length > 1 && (
              <>
                <Text style={styles.orderLabel}>Turn order</Text>
                {order.map((name, i) => (
                  <View key={i} style={styles.orderRow}>
                    <Text style={styles.orderNum}>{i + 1}</Text>
                    <Text style={styles.orderName}>{name}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '600', marginBottom: spacing.sm },
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
  decideBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  decideOff: { opacity: 0.4 },
  decideText: { color: colors.primaryText, fontSize: 18, fontWeight: '800' },
  result: { marginTop: spacing.xl, alignItems: 'center' },
  firstLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  firstName: { color: colors.star, fontSize: 34, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  orderLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '600', marginTop: spacing.xl, marginBottom: spacing.sm, alignSelf: 'flex-start' },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, alignSelf: 'stretch', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  orderNum: { color: colors.textMuted, fontSize: 16, fontWeight: '700', width: 28 },
  orderName: { color: colors.text, fontSize: 16, fontWeight: '600' },
});

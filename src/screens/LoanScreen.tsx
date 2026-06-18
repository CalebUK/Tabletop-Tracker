import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackProps } from '../navigation';
import { getGame, setLoan, returnLoan } from '../db/games';
import { isoToUk, todayUk, ukToIso } from '../lib/dates';
import { colors, radius, spacing } from '../theme';

export default function LoanScreen({ route, navigation }: RootStackProps<'Loan'>) {
  const { gameId } = route.params;
  const [gameName, setGameName] = useState('');
  const [currentLoanTo, setCurrentLoanTo] = useState<string | null>(null);
  const [currentLoanAt, setCurrentLoanAt] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayUk());

  useEffect(() => {
    getGame(gameId).then((g) => {
      if (!g) return;
      setGameName(g.name);
      setCurrentLoanTo(g.loanedTo);
      setCurrentLoanAt(g.loanedAt);
      if (g.loanedTo) setName(g.loanedTo);
      if (g.loanedAt) setDate(isoToUk(g.loanedAt));
      navigation.setOptions({ title: g.loanedTo ? 'Manage Loan' : 'Loan Out' });
    });
  }, [gameId]);

  async function onLoan() {
    if (!name.trim()) {
      Alert.alert('Who borrowed it?', 'Please enter who you loaned the game to.');
      return;
    }
    const iso = ukToIso(date) ?? new Date().toISOString().slice(0, 10);
    await setLoan(gameId, name.trim(), iso);
    navigation.goBack();
  }

  async function onReturn() {
    await returnLoan(gameId);
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.game}>{gameName}</Text>

        {currentLoanTo ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              🤝 Currently loaned to <Text style={styles.bold}>{currentLoanTo}</Text>
              {currentLoanAt ? ` since ${isoToUk(currentLoanAt)}` : ''}
            </Text>
          </View>
        ) : null}

        <Text style={styles.label}>Loaned to</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Dave"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={[styles.label, { marginTop: spacing.lg }]}>Date loaned</Text>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="DD/MM/YYYY"
          placeholderTextColor={colors.textMuted}
        />

        <Pressable style={styles.saveBtn} onPress={onLoan}>
          <Text style={styles.saveBtnText}>
            {currentLoanTo ? 'Update Loan' : 'Loan Out'}
          </Text>
        </Pressable>

        {currentLoanTo ? (
          <Pressable style={styles.returnBtn} onPress={onReturn}>
            <Text style={styles.returnBtnText}>✓ Mark as Returned</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  game: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: spacing.md },
  banner: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  bannerText: { color: colors.text, fontSize: 14 },
  bold: { fontWeight: '700' },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  saveBtnText: { color: colors.primaryText, fontSize: 16, fontWeight: '700' },
  returnBtn: {
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.success,
  },
  returnBtnText: { color: colors.success, fontSize: 15, fontWeight: '700' },
});

import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { RootStackProps } from '../navigation';
import { getGame, setLoan, returnLoan, getAllLocations } from '../db/games';
import { isoToUk, todayUk, ukToIso } from '../lib/dates';
import { colors, radius, spacing } from '../theme';

export default function LoanScreen({ route, navigation }: RootStackProps<'Loan'>) {
  const { gameId } = route.params;
  const headerHeight = useHeaderHeight();
  const [gameName, setGameName] = useState('');
  const [currentLoanTo, setCurrentLoanTo] = useState<string | null>(null);
  const [currentLoanAt, setCurrentLoanAt] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayUk());
  const [returning, setReturning] = useState(false);
  const [returnLocation, setReturnLocation] = useState('');
  const [allLocations, setAllLocations] = useState<string[]>([]);

  useEffect(() => {
    getAllLocations().then(setAllLocations).catch(() => {});
    getGame(gameId).then((g) => {
      if (!g) return;
      setGameName(g.name);
      setCurrentLoanTo(g.loanedTo);
      setCurrentLoanAt(g.loanedAt);
      setReturnLocation(g.location ?? '');
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

  async function confirmReturn() {
    await returnLoan(gameId, returnLocation);
    navigation.goBack();
  }

  // Existing locations, narrowed by what's typed (for consistent spelling).
  const locTyped = returnLocation.trim().toLowerCase();
  const locationSuggestions = allLocations
    .filter((l) => l.toLowerCase() !== locTyped)
    .filter((l) => !locTyped || l.toLowerCase().includes(locTyped))
    .slice(0, 8);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={headerHeight}
      >
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
          placeholderTextColor={colors.placeholder}
        />

        <Text style={[styles.label, { marginTop: spacing.lg }]}>Date loaned</Text>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="DD/MM/YYYY"
          placeholderTextColor={colors.placeholder}
        />

        <Pressable style={styles.saveBtn} onPress={onLoan}>
          <Text style={styles.saveBtnText}>
            {currentLoanTo ? 'Update Loan' : 'Loan Out'}
          </Text>
        </Pressable>

        {currentLoanTo && !returning ? (
          <Pressable style={styles.returnBtn} onPress={() => setReturning(true)}>
            <Text style={styles.returnBtnText}>✓ Mark as Returned</Text>
          </Pressable>
        ) : null}

        {currentLoanTo && returning ? (
          <View style={styles.returnBox}>
            <Text style={styles.label}>Where is it now? (storage location)</Text>
            <TextInput
              style={styles.input}
              value={returnLocation}
              onChangeText={setReturnLocation}
              placeholder="e.g. Hall closet, top shelf"
              placeholderTextColor={colors.placeholder}
            />
            {locationSuggestions.length > 0 && (
              <View style={styles.chipWrap}>
                {locationSuggestions.map((loc) => (
                  <Pressable key={loc} style={styles.chip} onPress={() => setReturnLocation(loc)}>
                    <Text style={styles.chipText}>📍 {loc}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Pressable style={styles.returnConfirm} onPress={confirmReturn}>
              <Text style={styles.returnBtnText}>✓ Confirm return</Text>
            </Pressable>
          </View>
        ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
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
  returnBox: { marginTop: spacing.lg, gap: 6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: { color: colors.text, fontSize: 13 },
  returnConfirm: {
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.success,
    backgroundColor: colors.surfaceAlt,
  },
});

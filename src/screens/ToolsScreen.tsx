import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { colors, radius, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type ToolRoute = 'DiceRoller' | 'WhoGoesFirst' | 'Calculator' | 'Scorepad';

const TOOLS: { route: ToolRoute; emoji: string; title: string; sub: string }[] = [
  { route: 'DiceRoller', emoji: '🎲', title: 'Dice roller', sub: 'Roll any combo of dice' },
  { route: 'WhoGoesFirst', emoji: '👑', title: 'Who goes first?', sub: 'Pick a starting player & turn order' },
  { route: 'Calculator', emoji: '🧮', title: 'Calculator', sub: 'Quick maths for scoring' },
  { route: 'Scorepad', emoji: '📝', title: 'Scorepad', sub: 'Keep running scores' },
];

export default function ToolsScreen() {
  const nav = useNavigation<Nav>();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Tools</Text>
        <Text style={styles.sub}>Handy gadgets for game night.</Text>
        {TOOLS.map((t) => (
          <Pressable key={t.route} style={styles.card} onPress={() => nav.navigate(t.route)}>
            <Text style={styles.cardEmoji}>{t.emoji}</Text>
            <View style={styles.flex1}>
              <Text style={styles.cardTitle}>{t.title}</Text>
              <Text style={styles.cardSub}>{t.sub}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  heading: { color: colors.text, fontSize: 28, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 14, marginTop: 2, marginBottom: spacing.lg },
  flex1: { flex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardEmoji: { fontSize: 30 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  cardSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  chev: { color: colors.textMuted, fontSize: 24 },
});

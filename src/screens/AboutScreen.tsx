import React from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import appConfig from '../../app.json';
import { useOnboarding } from '../components/OnboardingProvider';
import { colors, radius, spacing } from '../theme';

const PRIVACY_URL = 'https://github.com/CalebUK/Tabletop-Tracker/blob/main/PRIVACY.md';

export default function AboutScreen() {
  const version = appConfig.expo.version;
  const { openTour } = useOnboarding();

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerBlock}>
          <Image source={require('../../assets/adaptive-icon.png')} style={styles.logo} />
          <Text style={styles.name}>Tabletop Tracker</Text>
          <Text style={styles.version}>Version {version}</Text>
        </View>

        <Text style={styles.body}>
          Tabletop Tracker helps you catalogue your board game collection, track plays and
          winners, and find the right game for tonight.
        </Text>

        <Text style={styles.sectionTitle}>Your data &amp; privacy</Text>
        <Text style={styles.body}>
          By default everything you add lives only on this device. Your collection, photos, plays
          and notes are not uploaded anywhere unless you choose an action that shares them.
        </Text>
        <Text style={styles.body}>
          Those choices are: looking a game up on BoardGameGeek (sends just the game title);
          exporting a backup or CSV (shares a file wherever you send it); and creating an online
          library.
        </Text>
        <Text style={styles.body}>
          The optional online library uploads a list of your games (name, rating, player count and
          play time — no photos or personal info) so friends with your share code can view it. You
          can delete it any time from the Library tab. Photos and the camera are only used to add
          pictures to your games, stored on-device.
        </Text>

        <Pressable style={styles.linkBtn} onPress={() => Linking.openURL(PRIVACY_URL)}>
          <Text style={styles.linkBtnText}>View full privacy policy ↗</Text>
        </Pressable>

        <Pressable style={styles.linkBtn} onPress={openTour}>
          <Text style={styles.linkBtnText}>Show app tour again</Text>
        </Pressable>

        <Text style={styles.footer}>Made for board game lovers. 🎲</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  headerBlock: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xl },
  logo: { width: 96, height: 96 },
  name: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: spacing.sm },
  version: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  body: { color: colors.text, fontSize: 15, lineHeight: 22, marginBottom: spacing.md },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  linkBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  linkBtnText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  footer: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: spacing.xl },
});

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMeta, setMeta } from '../db/meta';
import { colors, radius, spacing } from '../theme';

const SEEN_KEY = 'onboarding_seen';

interface Slide {
  emoji?: string;
  logo?: boolean;
  title: string;
  body: string;
  hints?: { icon: string; label: string }[];
}

const SLIDES: Slide[] = [
  {
    logo: true,
    title: 'Welcome to Tabletop Tracker',
    body: 'Your whole board game collection — organised, in your pocket.',
  },
  {
    emoji: '🎲',
    title: 'Your Collection',
    body: 'Add games with a photo, rating, location and tags. Swipe a game → to edit, ← to loan, or hold to log a play. Switch between a list and a photo grid, and filter up top:',
    hints: [
      { icon: '📍', label: 'Filter by storage location' },
      { icon: '♥', label: 'Show only your favourites' },
    ],
  },
  {
    emoji: '⭐',
    title: 'Keep a Wishlist',
    body: 'Flip the toggle at the top of your Collection to your Wishlist — games you’d love to own. If a friend’s shared library has one, you’ll see who can lend it, plus suggestions from friends whose ratings match yours. Bought it? One tap moves it into your collection.',
  },
  {
    emoji: '🔍',
    title: 'Find the right game',
    body: 'Filter by players, play time, age, rating and complexity. “At home” hides games that are out on loan, and “Feeling lucky” picks one for tonight.',
  },
  {
    emoji: '📊',
    title: 'Plays, groups & stats',
    body: 'Log who played and who won — even games you don’t own. Create gaming groups for a regular game night, and tap any top player or most-played game to see their full stats.',
  },
  {
    emoji: '👥',
    title: 'Share with friends',
    body: 'Publish your collection to get a share code, and add friends’ codes to browse everyone’s games together. Export a backup any time to keep your data safe (⚙️ top-right).',
  },
];

interface OnboardingCtx {
  openTour: () => void;
}
const Ctx = createContext<OnboardingCtx>({ openTour: () => {} });
export const useOnboarding = () => useContext(Ctx);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const width = Dimensions.get('window').width;

  useEffect(() => {
    getMeta(SEEN_KEY).then((v) => {
      if (v !== '1') setVisible(true);
    });
  }, []);

  function openTour() {
    setPage(0);
    setVisible(true);
    // jump back to the first slide when re-opened
    setTimeout(() => scrollRef.current?.scrollTo({ x: 0, animated: false }), 0);
  }

  function close() {
    setVisible(false);
    setMeta(SEEN_KEY, '1').catch(() => {});
  }

  function next() {
    if (page >= SLIDES.length - 1) {
      close();
    } else {
      scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: true });
    }
  }

  const last = page >= SLIDES.length - 1;

  return (
    <Ctx.Provider value={{ openTour }}>
      {children}
      <Modal visible={visible} animationType="fade" onRequestClose={close}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.topBar}>
            <Pressable onPress={close} hitSlop={10}>
              <Text style={styles.skip}>{last ? '' : 'Skip'}</Text>
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {SLIDES.map((s, i) => (
              <View key={i} style={[styles.slide, { width }]}>
                {s.logo ? (
                  <Image source={require('../../assets/adaptive-icon.png')} style={styles.logo} />
                ) : (
                  <Text style={styles.emoji}>{s.emoji}</Text>
                )}
                <Text style={styles.title}>{s.title}</Text>
                <Text style={styles.body}>{s.body}</Text>
                {s.hints && (
                  <View style={styles.hints}>
                    {s.hints.map((h) => (
                      <View key={h.label} style={styles.hintRow}>
                        <View style={styles.hintIcon}>
                          <Text style={styles.hintIconText}>{h.icon}</Text>
                        </View>
                        <Text style={styles.hintLabel}>{h.label}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
            ))}
          </View>

          <Pressable style={styles.cta} onPress={next}>
            <Text style={styles.ctaText}>{last ? 'Get started' : 'Next'}</Text>
          </Pressable>
        </SafeAreaView>
      </Modal>
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { height: 44, justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: spacing.lg },
  skip: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  logo: { width: 120, height: 120, marginBottom: spacing.xl },
  emoji: { fontSize: 72, marginBottom: spacing.xl },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: spacing.md },
  body: { color: colors.textMuted, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  hints: { marginTop: spacing.xl, gap: spacing.md },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  hintIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintIconText: { fontSize: 20 },
  hintLabel: { color: colors.text, fontSize: 15 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 20 },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  ctaText: { color: colors.primaryText, fontSize: 16, fontWeight: '700' },
});

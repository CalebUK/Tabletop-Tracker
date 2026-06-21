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
    body: 'Add games with a photo, rating, storage location, tags and more. Swipe a game → to edit, ← to loan it out, or hold to log a play.',
  },
  {
    emoji: '🔍',
    title: 'Find the right game',
    body: 'Filter by players, play time, age, rating and category. Tap “Feeling lucky” to let the app pick a game for tonight.',
  },
  {
    emoji: '📊',
    title: 'Plays & Stats',
    body: 'Log who played and who won. See per-game winners, top players and your most-played games.',
  },
  {
    emoji: '👥',
    title: 'Library & Backups',
    body: 'Share your collection with friends using a code, and export a backup any time to keep your data safe (⚙️ top-right).',
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

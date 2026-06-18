import React, { useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { radius, spacing } from '../theme';

interface Action {
  icon: string;
  label: string;
  color: string;
  onTrigger: () => void;
}

interface Props {
  children: React.ReactNode;
  // Revealed by swiping the card right (finger moves right).
  rightSwipe: Action;
  // Revealed by swiping the card left (finger moves left).
  leftSwipe: Action;
}

const MAX_REVEAL = 110;
const THRESHOLD = 70;

// Lightweight swipeable row built on PanResponder so it needs no native module.
// Swipe right -> rightSwipe action; swipe left -> leftSwipe action.
export default function SwipeableRow({ children, rightSwipe, leftSwipe }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [dir, setDir] = useState<'none' | 'right' | 'left'>('none');

  const springBack = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start(() => setDir('none'));
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_e, g) => {
        const clamped = Math.max(-MAX_REVEAL, Math.min(MAX_REVEAL, g.dx));
        translateX.setValue(clamped);
        setDir(clamped > 4 ? 'right' : clamped < -4 ? 'left' : 'none');
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dx > THRESHOLD) {
          springBack();
          rightSwipe.onTrigger();
        } else if (g.dx < -THRESHOLD) {
          springBack();
          leftSwipe.onTrigger();
        } else {
          springBack();
        }
      },
      onPanResponderTerminate: springBack,
    })
  ).current;

  // The action shown behind the card depends on swipe direction.
  const action = dir === 'right' ? rightSwipe : dir === 'left' ? leftSwipe : null;

  return (
    <View style={styles.wrap}>
      {action && (
        <View
          style={[
            styles.actionBg,
            { backgroundColor: action.color, justifyContent: dir === 'right' ? 'flex-start' : 'flex-end' },
          ]}
        >
          <View style={styles.action}>
            <Text style={styles.actionIcon}>{action.icon}</Text>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </View>
        </View>
      )}
      <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md, borderRadius: radius.md, overflow: 'hidden' },
  actionBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  action: { alignItems: 'center' },
  actionIcon: { fontSize: 22 },
  actionLabel: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 2 },
});

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

interface Props {
  children: React.ReactNode;
}
interface State {
  error: Error | null;
}

// Catches any render/runtime error in the tree and shows a friendly recovery
// screen instead of a white screen — so a stray bug never strands a tester.
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.warn('Unhandled error caught by boundary:', error);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>🎲</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            The app hit an unexpected error. Your collection is safe on this device — tap below to get
            back to it.
          </Text>
          <Pressable style={styles.btn} onPress={this.reset}>
            <Text style={styles.btnText}>Restart</Text>
          </Pressable>
          {__DEV__ && (
            <Text style={styles.devError}>{String(this.state.error?.message ?? this.state.error)}</Text>
          )}
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emoji: { fontSize: 56 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  btn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  btnText: { color: colors.primaryText, fontSize: 16, fontWeight: '700' },
  devError: { color: colors.danger, fontSize: 12, marginTop: spacing.lg, textAlign: 'center' },
});

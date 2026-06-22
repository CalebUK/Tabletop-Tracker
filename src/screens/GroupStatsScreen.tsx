import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackProps } from '../navigation';
import { getGroupStats, deleteGroup, GroupStats } from '../db/groups';
import { colors, radius, spacing } from '../theme';

export default function GroupStatsScreen({ route, navigation }: RootStackProps<'GroupStats'>) {
  const { groupId } = route.params;
  const [stats, setStats] = useState<GroupStats | null>(null);

  const load = useCallback(() => {
    getGroupStats(groupId).then((s) => {
      setStats(s);
      navigation.setOptions({ title: s.name });
    });
  }, [groupId]);

  useFocusEffect(load);

  function onDelete() {
    Alert.alert('Delete this group?', 'The plays logged to it are kept, but no longer grouped.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteGroup(groupId).then(() => navigation.goBack()),
      },
    ]);
  }

  if (!stats) return <View style={styles.safe} />;

  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{stats.name}</Text>
      <Text style={styles.sub}>
        {stats.totalPlays} play{stats.totalPlays === 1 ? '' : 's'} logged to this group
      </Text>

      <Pressable
        style={styles.logBtn}
        onPress={() => navigation.navigate('LogPlay', { groupId })}
      >
        <Text style={styles.logBtnText}>+ Log a play for this group</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>🏆 Players</Text>
      {stats.players.length === 0 ? (
        <Text style={styles.muted}>No plays logged yet.</Text>
      ) : (
        stats.players.map((p, i) => {
          const rate = p.plays > 0 ? Math.round((p.wins / p.plays) * 100) : 0;
          return (
            <Pressable
              key={p.name}
              style={styles.row}
              onPress={() => navigation.navigate('PlayerStats', { name: p.name })}
            >
              <Text style={styles.rank}>{i + 1}</Text>
              <Text style={styles.name}>{p.name} ›</Text>
              <Text style={styles.record}>{p.wins}/{p.plays} · {rate}%</Text>
            </Pressable>
          );
        })
      )}

      <Text style={styles.sectionTitle}>🔥 Most played</Text>
      {stats.games.length === 0 ? (
        <Text style={styles.muted}>No games logged yet.</Text>
      ) : (
        stats.games.map((g) =>
          g.gameId != null ? (
            <Pressable
              key={g.name}
              style={styles.row}
              onPress={() => navigation.navigate('GameStats', { gameId: g.gameId as number })}
            >
              <Text style={styles.name}>{g.name} ›</Text>
              <Text style={styles.record}>{g.plays} play{g.plays === 1 ? '' : 's'}</Text>
            </Pressable>
          ) : (
            <View key={g.name} style={styles.row}>
              <Text style={styles.name}>{g.name}</Text>
              <Text style={styles.record}>{g.plays} play{g.plays === 1 ? '' : 's'}</Text>
            </View>
          )
        )
      )}

      <Pressable style={styles.deleteBtn} onPress={onDelete}>
        <Text style={styles.deleteBtnText}>Delete group</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  heading: { color: colors.text, fontSize: 24, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  logBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  logBtnText: { color: colors.primaryText, fontSize: 15, fontWeight: '700' },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: spacing.xl, marginBottom: spacing.sm },
  muted: { color: colors.textMuted, fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rank: { color: colors.textMuted, fontSize: 14, width: 24, fontWeight: '700' },
  name: { color: colors.text, fontSize: 15, flex: 1 },
  record: { color: colors.textMuted, fontSize: 14 },
  deleteBtn: {
    marginTop: spacing.xl,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteBtnText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});

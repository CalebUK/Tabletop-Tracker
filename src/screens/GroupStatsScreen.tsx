import React, { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackProps } from '../navigation';
import {
  getGroupStats,
  deleteGroup,
  renameGroup,
  addGroupMember,
  removeGroupMember,
  setGroupAutofill,
  GroupStats,
} from '../db/groups';
import { colors, radius, spacing } from '../theme';

export default function GroupStatsScreen({ route, navigation }: RootStackProps<'GroupStats'>) {
  const { groupId } = route.params;
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMember, setNewMember] = useState('');

  const load = useCallback(() => {
    getGroupStats(groupId).then((s) => {
      setStats(s);
      navigation.setOptions({ title: s.name });
    });
  }, [groupId]);

  useFocusEffect(load);

  function openRename() {
    setNewName(stats?.name ?? '');
    setRenaming(true);
  }

  async function saveRename() {
    const name = newName.trim();
    if (!name) return;
    await renameGroup(groupId, name);
    setRenaming(false);
    load();
  }

  async function onAddMember() {
    const name = newMember.trim();
    if (!name) return;
    await addGroupMember(groupId, name);
    setNewMember('');
    load();
  }

  function onRemoveMember(name: string) {
    removeGroupMember(groupId, name).then(load);
  }

  function onToggleAutofill(v: boolean) {
    setGroupAutofill(groupId, v).then(load);
  }

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
    <>
    <ScrollView style={styles.safe} contentContainerStyle={styles.content}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>{stats.name}</Text>
        <Pressable onPress={openRename} hitSlop={10}>
          <Text style={styles.rename}>✏️ Rename</Text>
        </Pressable>
      </View>
      <Text style={styles.sub}>
        {stats.totalPlays} play{stats.totalPlays === 1 ? '' : 's'} logged to this group
      </Text>

      <Pressable
        style={styles.logBtn}
        onPress={() => navigation.navigate('LogPlay', { groupId })}
      >
        <Text style={styles.logBtnText}>+ Log a play for this group</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>👤 Members</Text>
      <Text style={styles.muted}>The regulars in this group.</Text>
      {stats.members.length > 0 && (
        <View style={styles.memberRow}>
          {stats.members.map((m) => (
            <Pressable key={m} style={styles.memberChip} onPress={() => onRemoveMember(m)}>
              <Text style={styles.memberChipText}>{m} ✕</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.addMemberRow}>
        <TextInput
          style={styles.memberInput}
          value={newMember}
          onChangeText={setNewMember}
          placeholder="Add a member"
          placeholderTextColor={colors.placeholder}
          onSubmitEditing={onAddMember}
          returnKeyType="done"
        />
        <Pressable style={styles.memberAddBtn} onPress={onAddMember}>
          <Text style={styles.memberAddText}>Add</Text>
        </Pressable>
      </View>
      <View style={styles.autofillRow}>
        <View style={styles.flex1}>
          <Text style={styles.autofillLabel}>Auto-fill when logging</Text>
          <Text style={styles.muted}>Prefill these members as players for this group's games.</Text>
        </View>
        <Switch
          value={stats.autofill}
          onValueChange={onToggleAutofill}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>

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
              onPress={() =>
                navigation.navigate('PlayerStats', { name: p.name, groupId, groupName: stats.name })
              }
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
        stats.games.map((g) => (
          <Pressable
            key={g.name}
            style={styles.row}
            onPress={() =>
              navigation.navigate('GameStats', {
                // Owned games go by id; guest games by name. Both stay group-scoped.
                gameId: g.gameId ?? undefined,
                gameName: g.gameId == null ? g.name : undefined,
                groupId,
                groupName: stats.name,
              })
            }
          >
            <Text style={styles.name}>{g.name} ›</Text>
            <Text style={styles.record}>{g.plays} play{g.plays === 1 ? '' : 's'}</Text>
          </Pressable>
        ))
      )}

      <Pressable style={styles.deleteBtn} onPress={onDelete}>
        <Text style={styles.deleteBtnText}>Delete group</Text>
      </Pressable>
    </ScrollView>

    <Modal visible={renaming} transparent animationType="fade" onRequestClose={() => setRenaming(false)}>
      <Pressable style={styles.backdrop} onPress={() => setRenaming(false)}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>Rename group</Text>
          <TextInput
            style={styles.input}
            value={newName}
            onChangeText={setNewName}
            placeholder="Group name"
            placeholderTextColor={colors.placeholder}
            autoFocus
            onSubmitEditing={saveRename}
            returnKeyType="done"
          />
          <View style={styles.modalBtns}>
            <Pressable onPress={() => setRenaming(false)} hitSlop={10}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
            <Pressable onPress={saveRename} hitSlop={10}>
              <Text style={styles.modalSave}>Save</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  heading: { color: colors.text, fontSize: 24, fontWeight: '700', flexShrink: 1 },
  rename: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  sub: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sheetTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xl },
  modalCancel: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  modalSave: { color: colors.primary, fontSize: 15, fontWeight: '700' },
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
  flex1: { flex: 1 },
  memberRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  memberChip: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  memberChipText: { color: colors.primaryText, fontSize: 13, fontWeight: '600' },
  addMemberRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  memberInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  memberAddBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  memberAddText: { color: colors.primaryText, fontSize: 15, fontWeight: '700' },
  autofillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  autofillLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
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

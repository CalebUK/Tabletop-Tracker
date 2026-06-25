import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackProps } from '../navigation';
import { getGroupRoster, addGroupMember, removeGroupMember, setGroupAutofill } from '../db/groups';
import { colors, radius, spacing } from '../theme';

export default function GroupMembersScreen({ route, navigation }: RootStackProps<'GroupMembers'>) {
  const { groupId, groupName } = route.params;
  const [members, setMembers] = useState<string[]>([]);
  const [autofill, setAutofill] = useState(false);
  const [newMember, setNewMember] = useState('');

  const load = useCallback(() => {
    getGroupRoster(groupId)
      .then((r) => {
        setMembers(r.members);
        setAutofill(r.autofill);
      })
      .catch(() => {});
  }, [groupId]);

  useFocusEffect(load);

  useEffect(() => {
    navigation.setOptions({ title: groupName ? `${groupName} · Members` : 'Members' });
  }, [groupName]);

  async function onAdd() {
    const name = newMember.trim();
    if (!name) return;
    await addGroupMember(groupId, name);
    setNewMember('');
    load();
  }

  function onRemove(name: string) {
    removeGroupMember(groupId, name).then(load);
  }

  function onToggle(v: boolean) {
    setAutofill(v);
    setGroupAutofill(groupId, v).catch(() => {});
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.muted}>The regulars in this group — add anyone who usually plays.</Text>

        {members.length > 0 && (
          <View style={styles.memberRow}>
            {members.map((m) => (
              <Pressable key={m} style={styles.memberChip} onPress={() => onRemove(m)}>
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
            onSubmitEditing={onAdd}
            returnKeyType="done"
          />
          <Pressable style={styles.memberAddBtn} onPress={onAdd}>
            <Text style={styles.memberAddText}>Add</Text>
          </Pressable>
        </View>

        <View style={styles.autofillRow}>
          <View style={styles.flex1}>
            <Text style={styles.autofillLabel}>Auto-fill when logging</Text>
            <Text style={styles.muted}>Prefill these members as players for this group's games.</Text>
          </View>
          <Switch
            value={autofill}
            onValueChange={onToggle}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  muted: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  flex1: { flex: 1 },
  memberRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
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
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  autofillLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
});

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { getGamesForLibrary } from '../db/games';
import {
  getMyLibrary,
  saveMyLibrary,
  clearMyLibrary,
  getFriendLibraries,
  saveFriendLibrary,
  removeFriendLibrary,
  FriendLibrary,
} from '../db/library';
import { publishLibrary, deleteLibrary, fetchLibrary } from '../lib/onlineLibrary';
import { colors, radius, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LibraryScreen() {
  const navigation = useNavigation<Nav>();
  const [myLib, setMyLib] = useState<{ code: string; name: string } | null>(null);
  const [libName, setLibName] = useState('');
  const [gameCount, setGameCount] = useState(0);
  const [friends, setFriends] = useState<FriendLibrary[]>([]);
  const [codeInput, setCodeInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    getMyLibrary().then((l) => {
      setMyLib(l);
      if (l) setLibName(l.name);
    });
    getFriendLibraries().then(setFriends);
    getGamesForLibrary().then((g) => setGameCount(g.length));
  }, []);

  useFocusEffect(load);

  async function onPublish() {
    setBusy(myLib ? 'Updating your library…' : 'Creating your library…');
    try {
      const name = libName.trim() || 'My library';
      const code = await publishLibrary(name, myLib?.code);
      await saveMyLibrary(code, name);
      setMyLib({ code, name });
      Alert.alert(myLib ? 'Library updated' : 'Library created', `Your share code is ${code}.`);
    } catch (e: any) {
      Alert.alert('Could not connect', e?.message ?? 'Please check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  function onShare() {
    if (!myLib) return;
    Share.share({
      message: `Check out my board game collection on Tabletop Tracker! Add it with code: ${myLib.code}`,
    });
  }

  function onDelete() {
    if (!myLib) return;
    Alert.alert('Delete online library?', 'Friends will no longer be able to see your games. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy('Deleting…');
          try {
            await deleteLibrary(myLib.code);
            await clearMyLibrary();
            setMyLib(null);
          } catch (e: any) {
            Alert.alert('Could not delete', e?.message ?? 'Please try again.');
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  async function onAddFriend() {
    const code = codeInput.trim().toUpperCase();
    if (!code) return;
    setBusy('Looking up code…');
    try {
      const lib = await fetchLibrary(code);
      if (!lib) {
        Alert.alert('Not found', `No library found for code ${code}. Double-check the code with your friend.`);
        return;
      }
      await saveFriendLibrary(lib.code, lib.name);
      setCodeInput('');
      load();
      navigation.navigate('FriendLibrary', { code: lib.code, name: lib.name });
    } catch (e: any) {
      Alert.alert('Could not connect', e?.message ?? 'Please check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  function onRemoveFriend(code: string) {
    Alert.alert('Remove this library?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeFriendLibrary(code).then(load) },
    ]);
  }

  const header = (
    <View>
      <Text style={styles.heading}>Library</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>My online library</Text>
        {myLib ? (
          <>
            <Text style={styles.codeLabel}>Share code</Text>
            <Text style={styles.code}>{myLib.code}</Text>
            <TextInput
              style={styles.input}
              value={libName}
              onChangeText={setLibName}
              placeholder="Library name (e.g. Caleb's games)"
              placeholderTextColor={colors.placeholder}
            />
            <View style={styles.btnRow}>
              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={onPublish}>
                <Text style={styles.btnPrimaryText}>↑ Update ({gameCount})</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnOutline]} onPress={onShare}>
                <Text style={styles.btnOutlineText}>Share</Text>
              </Pressable>
            </View>
            <Pressable onPress={onDelete} style={styles.deleteLink}>
              <Text style={styles.deleteLinkText}>Delete online library</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.cardBody}>
              Share your collection ({gameCount} game{gameCount === 1 ? '' : 's'}) so friends can see
              what you have and your ratings. No photos or personal info are shared.
            </Text>
            <TextInput
              style={styles.input}
              value={libName}
              onChangeText={setLibName}
              placeholder="Library name (e.g. Caleb's games)"
              placeholderTextColor={colors.placeholder}
            />
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={onPublish}>
              <Text style={styles.btnPrimaryText}>Create Online Library</Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>A friend's library</Text>
        <View style={styles.btnRow}>
          <TextInput
            style={[styles.input, styles.flex1, { marginBottom: 0 }]}
            value={codeInput}
            onChangeText={(v) => setCodeInput(v.toUpperCase())}
            placeholder="Enter a share code"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="characters"
          />
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={onAddFriend}>
            <Text style={styles.btnPrimaryText}>View</Text>
          </Pressable>
        </View>
      </View>

      {friends.length > 0 && <Text style={styles.savedTitle}>Saved libraries</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={friends}
        keyExtractor={(f) => f.code}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={styles.friendRow}
            onPress={() => navigation.navigate('FriendLibrary', { code: item.code, name: item.name ?? undefined })}
            onLongPress={() => onRemoveFriend(item.code)}
          >
            <View style={styles.flex1}>
              <Text style={styles.friendName}>{item.name ?? 'Library'}</Text>
              <Text style={styles.friendCode}>{item.code}</Text>
            </View>
            <Text style={styles.friendChevron}>›</Text>
          </Pressable>
        )}
      />

      {busy && (
        <View style={styles.overlay}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.overlayText}>{busy}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, paddingBottom: 60 },
  heading: { color: colors.text, fontSize: 26, fontWeight: '700', marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cardBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  codeLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  code: { color: colors.primary, fontSize: 30, fontWeight: '800', letterSpacing: 3 },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.sm,
  },
  flex1: { flex: 1 },
  btnRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  btn: { borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.lg, alignItems: 'center' },
  btnPrimary: { backgroundColor: colors.primary, flexGrow: 1 },
  btnPrimaryText: { color: colors.primaryText, fontSize: 15, fontWeight: '700' },
  btnOutline: { borderWidth: 1, borderColor: colors.border },
  btnOutlineText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  deleteLink: { paddingTop: spacing.sm, alignItems: 'center' },
  deleteLinkText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  savedTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.sm },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  friendName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  friendCode: { color: colors.textMuted, fontSize: 13, letterSpacing: 2 },
  friendChevron: { color: colors.textMuted, fontSize: 22 },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  overlayText: { color: colors.text, fontSize: 15 },
});

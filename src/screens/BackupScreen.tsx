import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { RootStackProps } from '../navigation';
import { exportBackup, exportCsv, importBackup } from '../db/backup';
import { colors, radius, spacing } from '../theme';

export default function BackupScreen({ navigation }: RootStackProps<'Backup'>) {
  const [busy, setBusy] = useState<string | null>(null);

  async function share(uri: string, mimeType: string, title: string) {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Sharing unavailable', `Saved to:\n${uri}`);
      return;
    }
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: title, UTI: 'public.item' });
  }

  async function onExportBackup() {
    setBusy('Building backup…');
    try {
      const uri = await exportBackup();
      await share(uri, 'application/json', 'Save Tabletop Tracker backup');
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Could not create the backup.');
    } finally {
      setBusy(null);
    }
  }

  async function onExportCsv() {
    setBusy('Building CSV…');
    try {
      const uri = await exportCsv();
      await share(uri, 'text/csv', 'Export collection as CSV');
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Could not create the CSV.');
    } finally {
      setBusy(null);
    }
  }

  async function onImport() {
    const res = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const uri = res.assets[0].uri;

    Alert.alert(
      'Replace all data?',
      'Importing a backup will REPLACE everything currently in the app with the contents of this file. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: async () => {
            setBusy('Restoring backup…');
            try {
              await importBackup(uri);
              Alert.alert('Done', 'Your backup has been restored.', [
                { text: 'OK', onPress: () => navigation.navigate('Tabs') },
              ]);
            } catch (e: any) {
              Alert.alert('Import failed', e?.message ?? 'Could not read that backup file.');
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Your collection lives on this device. Use a backup to move to a new phone or keep a
          safe copy.
        </Text>

        <Section title="Back up & restore">
          <Button label="📦  Export full backup" sub="Everything, including photos (.json)" onPress={onExportBackup} />
          <Button label="📥  Import backup" sub="Replace all data from a backup file" danger onPress={onImport} />
        </Section>

        <Section title="Spreadsheet export">
          <Button label="📄  Export collection as CSV" sub="Game list for Excel / Google Sheets" onPress={onExportCsv} />
        </Section>

        <Text style={styles.note}>
          Tip: send the backup to yourself (email, Google Drive, etc.). The CSV is a readable
          list and doesn’t include photos or play history — use the full backup to move devices.
        </Text>
      </ScrollView>

      {busy && (
        <View style={styles.overlay}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.overlayText}>{busy}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Button({
  label,
  sub,
  onPress,
  danger,
}: {
  label: string;
  sub: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable style={[styles.button, danger && styles.buttonDanger]} onPress={onPress}>
      <Text style={styles.buttonLabel}>{label}</Text>
      <Text style={styles.buttonSub}>{sub}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  intro: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  section: { marginTop: spacing.xl },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.sm },
  button: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  buttonDanger: { borderColor: colors.danger },
  buttonLabel: { color: colors.text, fontSize: 16, fontWeight: '600' },
  buttonSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  note: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: spacing.xl },
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

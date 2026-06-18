import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { RootStackProps } from '../navigation';
import { upcLookup } from '../lib/identify';
import { bggSearch, BggSearchResult } from '../lib/bgg';
import { colors, radius, spacing } from '../theme';

type Phase = 'scanning' | 'looking' | 'results' | 'error';

export default function ScanBarcodeScreen({ route, navigation }: RootStackProps<'ScanBarcode'>) {
  const returnGameId = route.params?.gameId;
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('scanning');
  const [message, setMessage] = useState('');
  const [results, setResults] = useState<BggSearchResult[]>([]);
  const [manual, setManual] = useState('');

  async function runSearch(term: string, scannedNote?: string) {
    setPhase('looking');
    setMessage(scannedNote ?? `Searching for "${term}"…`);
    try {
      const found = await bggSearch(term);
      setResults(found);
      if (found.length === 0) {
        setPhase('error');
        setMessage(`No BoardGameGeek match for "${term}". Try searching by name.`);
      } else {
        setPhase('results');
      }
    } catch {
      setPhase('error');
      setMessage('Could not reach BoardGameGeek. Check your connection.');
    }
  }

  async function handleBarcode(result: BarcodeScanningResult) {
    if (phase !== 'scanning') return;
    setPhase('looking');
    setMessage('Looking up barcode…');
    try {
      const title = await upcLookup(result.data);
      if (title) {
        await runSearch(title, `Found "${title}" — searching BoardGameGeek…`);
      } else {
        setPhase('error');
        setMessage(`Barcode ${result.data} wasn't recognised. Try searching by name.`);
      }
    } catch {
      setPhase('error');
      setMessage('Barcode lookup failed. Try searching by name.');
    }
  }

  function pick(r: BggSearchResult) {
    navigation.navigate('EditGame', { gameId: returnGameId, bggId: r.id });
  }

  // --- Permission gate ---
  if (!permission) {
    return <SafeAreaView style={styles.safe} />;
  }
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.infoTitle}>Camera access needed</Text>
          <Text style={styles.infoText}>
            BGK needs the camera to scan a game's barcode.
          </Text>
          <Pressable style={styles.btn} onPress={requestPermission}>
            <Text style={styles.btnText}>Grant Permission</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {phase === 'scanning' && (
        <View style={styles.cameraWrap}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={handleBarcode}
          />
          <View style={styles.reticle} pointerEvents="none" />
          <Text style={styles.scanHint}>Point at the barcode on the box</Text>
        </View>
      )}

      {phase === 'looking' && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.infoText}>{message}</Text>
        </View>
      )}

      {phase === 'results' && (
        <View style={styles.flex1}>
          <Text style={styles.resultsHeading}>Pick the match</Text>
          <FlatList
            data={results}
            keyExtractor={(r) => String(r.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Pressable style={styles.result} onPress={() => pick(item)}>
                <Text style={styles.resultName}>{item.name}</Text>
                {item.year ? <Text style={styles.resultYear}>{item.year}</Text> : null}
              </Pressable>
            )}
          />
          <Pressable style={styles.rescan} onPress={() => setPhase('scanning')}>
            <Text style={styles.rescanText}>↺ Scan again</Text>
          </Pressable>
        </View>
      )}

      {phase === 'error' && (
        <View style={styles.center}>
          <Text style={styles.infoText}>{message}</Text>
          <View style={styles.manualRow}>
            <TextInput
              style={styles.input}
              value={manual}
              onChangeText={setManual}
              placeholder="Search by name…"
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={() => manual.trim() && runSearch(manual.trim())}
              returnKeyType="search"
            />
            <Pressable
              style={styles.btnSmall}
              onPress={() => manual.trim() && runSearch(manual.trim())}
            >
              <Text style={styles.btnText}>Go</Text>
            </Pressable>
          </View>
          <Pressable style={styles.rescan} onPress={() => setPhase('scanning')}>
            <Text style={styles.rescanText}>↺ Scan again</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex1: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  cameraWrap: { flex: 1, overflow: 'hidden' },
  reticle: {
    position: 'absolute',
    top: '35%',
    left: '12%',
    right: '12%',
    height: 140,
    borderWidth: 3,
    borderColor: colors.primary,
    borderRadius: radius.md,
  },
  scanHint: {
    position: 'absolute',
    bottom: spacing.xl,
    alignSelf: 'center',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  infoTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  infoText: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 21 },
  resultsHeading: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  result: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultName: { color: colors.text, fontSize: 15, flex: 1, marginRight: spacing.sm },
  resultYear: { color: colors.textMuted, fontSize: 13 },
  manualRow: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  btnSmall: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  btnText: { color: colors.primaryText, fontSize: 15, fontWeight: '700' },
  rescan: { padding: spacing.md, alignItems: 'center' },
  rescanText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});

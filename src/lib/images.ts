import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

// Folder inside the app's sandbox where we keep game photos permanently.
const IMAGE_DIR = `${FileSystem.documentDirectory}game-images/`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(IMAGE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
  }
}

// Copy a picker result (which lives in a volatile cache) into permanent
// storage and return the stable file:// uri.
async function persist(uri: string): Promise<string> {
  await ensureDir();
  const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
  const dest = `${IMAGE_DIR}${Date.now()}.${ext}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

export async function pickFromLibrary(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return persist(result.assets[0].uri);
}

export async function takePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return persist(result.assets[0].uri);
}

// Remove a stored image file (best-effort; ignores missing files).
export async function deleteImage(uri: string | null): Promise<void> {
  if (!uri || !uri.startsWith(IMAGE_DIR)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // ignore
  }
}

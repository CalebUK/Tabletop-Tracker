// Helpers for identifying a game from a photo (OCR) or a scanned barcode (UPC).
// Both return a best-guess name string that we then feed into the BGG search,
// so the user always confirms the actual match.

// ocr.space free OCR. The public "helloworld" demo key works for light use;
// get your own free key (no card) at https://ocr.space/ocrapi and drop it in.
const OCR_API_KEY = 'helloworld';

// Run OCR on a local image and return a best-guess game name (the longest
// text line, which is usually the title), or null if nothing readable.
export async function ocrImage(uri: string): Promise<string | null> {
  const form = new FormData();
  form.append('apikey', OCR_API_KEY);
  form.append('language', 'eng');
  form.append('OCREngine', '2');
  form.append('scale', 'true');
  // React Native's FormData accepts a {uri,name,type} file object.
  form.append('file', {
    uri,
    name: 'photo.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  const res = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: form });
  if (!res.ok) throw new Error(`OCR failed (${res.status})`);
  const json: any = await res.json();
  if (json.IsErroredOnProcessing) {
    const msg = Array.isArray(json.ErrorMessage) ? json.ErrorMessage[0] : json.ErrorMessage;
    throw new Error(msg || 'OCR could not read this image.');
  }
  const text: string = json.ParsedResults?.[0]?.ParsedText ?? '';
  return pickTitleLine(text);
}

function pickTitleLine(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    // Keep lines with a few letters; drop noise like "2-4 players" or pure symbols.
    .filter((l) => (l.match(/[A-Za-z]/g)?.length ?? 0) >= 3);
  if (lines.length === 0) return null;
  lines.sort((a, b) => b.length - a.length);
  return lines[0];
}

// Look up a scanned UPC/EAN barcode via upcitemdb's free trial endpoint
// (no key, rate-limited) and return the product title, or null.
export async function upcLookup(upc: string): Promise<string | null> {
  const res = await fetch(
    `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(upc)}`
  );
  if (!res.ok) return null;
  const json: any = await res.json();
  const title: string | undefined = json.items?.[0]?.title;
  return title?.trim() || null;
}

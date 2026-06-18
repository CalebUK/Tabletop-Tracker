// Dates are stored as ISO (YYYY-MM-DD) so they sort correctly, but shown to
// the user in UK format (DD/MM/YYYY).

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ISO (YYYY-MM-DD) -> UK (DD/MM/YYYY). Returns the input unchanged if it isn't
// a plain ISO date.
export function isoToUk(iso: string | null): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function todayUk(): string {
  return isoToUk(todayIso());
}

// UK (DD/MM/YYYY) -> ISO (YYYY-MM-DD). Returns null if it can't be parsed into
// a real calendar date.
export function ukToIso(uk: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(uk.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

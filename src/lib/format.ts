// Round to 2 decimal places (numeric), for storing tidy values.
export function round2num(n: number): number {
  return Math.round(n * 100) / 100;
}

// Round to 2 decimal places and drop trailing zeros, for display.
// 7.99774 -> "8", 7.99112 -> "7.99", 7.9 -> "7.9".
export function round2(n: number): string {
  return String(round2num(n));
}

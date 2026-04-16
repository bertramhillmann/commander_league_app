export function normalizeDeckIdentityKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s,]+/g, '')
}

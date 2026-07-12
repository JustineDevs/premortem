export function decodeStoredToken(value: string): string {
  if (value.startsWith('plain:')) {
    return value.slice('plain:'.length);
  }
  return value;
}

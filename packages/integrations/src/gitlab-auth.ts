export function gitLabAuthHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'PRIVATE-TOKEN': token
  };
}

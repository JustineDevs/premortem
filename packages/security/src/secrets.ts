export interface SecretDescriptor {
  name: string;
  provider: 'cloudflare' | 'supabase' | 'azure' | 'gcp' | 'local';
  rotationDays: number;
}

export const defaultSecrets: SecretDescriptor[] = [
  { name: 'GITLAB_TOKEN', provider: 'cloudflare', rotationDays: 30 },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', provider: 'supabase', rotationDays: 30 },
  { name: 'GEMINI_API_KEY', provider: 'gcp', rotationDays: 30 },
  { name: 'AZURE_OPENAI_API_KEY', provider: 'azure', rotationDays: 30 },
  { name: 'NEO4J_PASSWORD', provider: 'local', rotationDays: 60 }
];

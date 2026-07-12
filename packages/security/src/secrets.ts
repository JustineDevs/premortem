export interface SecretDescriptor {
  name: string;
  provider: 'alibaba' | 'supabase' | 'gcp' | 'local';
  rotationDays: number;
}

export const defaultSecrets: SecretDescriptor[] = [
  { name: 'GITLAB_TOKEN', provider: 'alibaba', rotationDays: 30 },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', provider: 'supabase', rotationDays: 30 },
  { name: 'OPENROUTER_API_KEY', provider: 'local', rotationDays: 30 },
  { name: 'GEMINI_API_KEY', provider: 'gcp', rotationDays: 30 },
  { name: 'OPENAI_API_KEY', provider: 'local', rotationDays: 30 },
  { name: 'ANTHROPIC_API_KEY', provider: 'local', rotationDays: 30 },
  { name: 'NEO4J_PASSWORD', provider: 'local', rotationDays: 60 }
];

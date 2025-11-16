import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

/**
 * Secret Manager Integration
 * Fetches secrets from Google Cloud Secret Manager in production
 * Falls back to environment variables for local development
 */

const client = new SecretManagerServiceClient();
const isProduction = process.env.NODE_ENV === 'production';
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT;

/**
 * Fetches a secret from Google Cloud Secret Manager
 * @param secretName - Name of the secret to fetch
 * @returns The secret value as a string
 */
export async function getSecret(secretName: string): Promise<string> {
  // In development, use environment variables
  if (!isProduction) {
    const envValue = process.env[secretName.toUpperCase().replace(/-/g, '_')];
    if (envValue) {
      return envValue;
    }
    console.warn(`Secret "${secretName}" not found in environment variables`);
    return '';
  }

  // In production, fetch from Secret Manager
  try {
    if (!projectId) {
      console.warn('GCP_PROJECT not set, falling back to environment variable');
      const envValue = process.env[secretName.toUpperCase().replace(/-/g, '_')];
      return envValue || '';
    }

    const [version] = await client.accessSecretVersion({
      name: `projects/${projectId}/secrets/${secretName}/versions/latest`,
    });

    const payload = version.payload?.data;
    if (!payload) {
      throw new Error(`Secret ${secretName} has no payload`);
    }

    // Convert Uint8Array to string
    if (typeof payload === 'string') {
      return payload;
    }
    return Buffer.from(payload).toString('utf8');
  } catch (error) {
    console.error(`Error fetching secret "${secretName}":`, error);
    // Fallback to environment variable if Secret Manager fails
    const envValue = process.env[secretName.toUpperCase().replace(/-/g, '_')];
    if (envValue) {
      console.warn(`Using fallback environment variable for ${secretName}`);
      return envValue;
    }
    return '';
  }
}

/**
 * Initializes and loads all required secrets
 * Call this at server startup
 */
export async function loadSecrets(): Promise<{
  anthropicApiKey: string;
  openaiApiKey: string;
}> {
  console.log('Loading secrets...');

  const [anthropicApiKey, openaiApiKey] = await Promise.all([
    getSecret('anthropic-api-key'),
    getSecret('openai-api-key'),
  ]);

  if (!anthropicApiKey && isProduction) {
    console.warn('⚠ Anthropic API key not found - AI features will be unavailable');
  }

  if (!openaiApiKey && isProduction) {
    console.warn('⚠ OpenAI API key not found - TTS features will be unavailable');
  }

  console.log('✓ Secrets loaded successfully');

  return {
    anthropicApiKey,
    openaiApiKey,
  };
}

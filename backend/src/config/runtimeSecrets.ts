import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

function parseSecretJson(secretString: string): Record<string, string> {
  const parsed = JSON.parse(secretString) as Record<string, unknown>;
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined || value === null) {
      continue;
    }
    out[key] = String(value);
  }

  return out;
}

export async function loadRuntimeSecretsFromAws(): Promise<void> {
  const secretId = process.env.APP_SECRETS_MANAGER_SECRET_ID;
  if (!secretId) {
    return;
  }

  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-south-1";
  const client = new SecretsManagerClient({ region });

  const response = await client.send(
    new GetSecretValueCommand({
      SecretId: secretId
    })
  );

  if (!response.SecretString) {
    throw new Error(`Secret '${secretId}' does not contain a SecretString JSON payload.`);
  }

  const values = parseSecretJson(response.SecretString);
  for (const [key, value] of Object.entries(values)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  console.log(`Loaded ${Object.keys(values).length} runtime values from Secrets Manager secret '${secretId}'.`);
}

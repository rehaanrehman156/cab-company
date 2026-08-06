"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadRuntimeSecretsFromAws = loadRuntimeSecretsFromAws;
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
function parseSecretJson(secretString) {
    const parsed = JSON.parse(secretString);
    const out = {};
    for (const [key, value] of Object.entries(parsed)) {
        if (value === undefined || value === null) {
            continue;
        }
        out[key] = String(value);
    }
    return out;
}
async function loadRuntimeSecretsFromAws() {
    const secretId = process.env.APP_SECRETS_MANAGER_SECRET_ID;
    if (!secretId) {
        return;
    }
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-south-1";
    const client = new client_secrets_manager_1.SecretsManagerClient({ region });
    const response = await client.send(new client_secrets_manager_1.GetSecretValueCommand({
        SecretId: secretId
    }));
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

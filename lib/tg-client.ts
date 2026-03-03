import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

declare global {
  var tgClients: Map<string, TelegramClient> | undefined;
  var tgConnecting: Map<string, Promise<void>> | undefined;
}

const clients = globalThis.tgClients || new Map<string, TelegramClient>();
const connecting = globalThis.tgConnecting || new Map<string, Promise<void>>();

if (process.env.NODE_ENV !== 'production') {
  globalThis.tgClients = clients;
  globalThis.tgConnecting = connecting;
}

export async function getClient(sessionString: string) {
  const apiId = Number(process.env.TG_API_ID);
  const apiHash = process.env.TG_API_HASH;

  if (!apiId || !apiHash) {
    throw new Error('TG_API_ID and TG_API_HASH must be set in environment variables');
  }

  // If there's an in-flight connection, wait for it first
  const existingConnect = connecting.get(sessionString);
  if (existingConnect) {
    try {
      await existingConnect;
    } catch {
      // Connection failed, will retry below
    }
  }

  let client = clients.get(sessionString);
  if (!client) {
    client = new TelegramClient(
      new StringSession(sessionString),
      apiId,
      apiHash,
      { connectionRetries: 5, useWSS: true }
    );
    clients.set(sessionString, client);
  }

  if (!client.connected) {
    if (!connecting.has(sessionString)) {
      const connectPromise = client.connect()
        .then(() => {})
        .catch((err) => {
          clients.delete(sessionString);
          throw err;
        })
        .finally(() => {
          connecting.delete(sessionString);
        });
      connecting.set(sessionString, connectPromise);
    }
    await connecting.get(sessionString);
  }

  return client;
}

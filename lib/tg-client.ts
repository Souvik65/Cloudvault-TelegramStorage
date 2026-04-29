import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

declare global {
  var tgClients: Map<string, TelegramClient> | undefined;
  var tgConnecting: Map<string, Promise<void>> | undefined;
}

/**
 * Always reads globalThis directly — never uses a module-level const snapshot.
 * This guarantees all Next.js route bundles (which each get their own module
 * evaluation) share the exact same Map instance at runtime.
 */
function getClientsMap(): Map<string, TelegramClient> {
  if (!globalThis.tgClients) globalThis.tgClients = new Map();
  return globalThis.tgClients;
}

function getConnectingMap(): Map<string, Promise<void>> {
  if (!globalThis.tgConnecting) globalThis.tgConnecting = new Map();
  return globalThis.tgConnecting;
}

export async function getClient(sessionString: string): Promise<TelegramClient> {
  const apiId = Number(process.env.TG_API_ID);
  const apiHash = process.env.TG_API_HASH;
  if (!apiId || !apiHash) throw new Error('TG_API_ID and TG_API_HASH must be set');

  const clients = getClientsMap();
  const connecting = getConnectingMap();

  // Diagnostic: shows whether the cache is being shared correctly between routes
  console.log(`[TG-CLIENT] getClient — cache size: ${clients.size}`);

  // Wait for any in-flight connection on this key
  const inflight = connecting.get(sessionString);
  if (inflight) {
    try { await inflight; } catch { /* connection failed, will retry below */ }
  }

  let client = clients.get(sessionString);
  if (!client) {
    console.log(`[TG-CLIENT] Cache miss — creating new TelegramClient`);
    
    // Internal keys (like 'pending:requestId') should start with an empty session.
    // Real session strings are long base64 strings; internal keys contain colons.
    const isInternalKey = sessionString.includes(':');
    const actualSession = isInternalKey ? '' : sessionString;
    
    client = new TelegramClient(
      new StringSession(actualSession),
      apiId,
      apiHash,
      { connectionRetries: 5, requestRetries: 3 }
    );
    client.setLogLevel('none' as any);
    clients.set(sessionString, client);
  } else {
    console.log(`[TG-CLIENT] Cache hit — reusing existing client (connected: ${client.connected})`);
  }

  if (!client.connected) {
    if (!connecting.has(sessionString)) {
      const connectPromise = client.connect()
        .then(() => {})
        .catch((err) => {
          getClientsMap().delete(sessionString);
          throw err;
        })
        .finally(() => {
          getConnectingMap().delete(sessionString);
        });
      connecting.set(sessionString, connectPromise);
    }
    await connecting.get(sessionString);
  }

  return client;
}

export function cacheClient(sessionString: string, client: TelegramClient) {
  const clients = getClientsMap();
  const existing = clients.get(sessionString);

  // If replacing a DIFFERENT connected instance, disconnect it to prevent leaks
  if (existing && existing !== client && existing.connected) {
    console.warn(`[TG-CLIENT] cacheClient: disconnecting ghost client to prevent resource leak`);
    existing.disconnect().catch(() => {});
  }

  clients.set(sessionString, client);
}

/**
 * Re-key a cached client from oldKey → newKey.
 * Called after sign-in to migrate the pending-session client to the
 * authenticated session key so the first post-login API call is a cache hit.
 */
export function updateClientKey(oldKey: string, newKey: string) {
  if (oldKey === newKey) return;
  const clients = getClientsMap();
  const connecting = getConnectingMap();
  
  console.log(`[TG-CLIENT] updateClientKey re-keying — map size: ${clients.size}`);
  
  if (clients.has(newKey)) {
    console.warn(`[TG-CLIENT] updateClientKey: newKey already exists in cache, will be overwritten`);
    const existingNew = clients.get(newKey);
    // If it's a different client and it's connected, disconnect it to avoid resource leaks
    if (existingNew && existingNew.connected) {
      existingNew.disconnect().catch(() => {});
    }
  }
  
  const client = clients.get(oldKey);
  if (client) {
    clients.set(newKey, client);
    clients.delete(oldKey);
    
    // Migrate in-flight connection promise if present
    const connectPromise = connecting.get(oldKey);
    if (connectPromise) {
      // Remove from old key immediately
      connecting.delete(oldKey);
      
      // Create a wrapper that handles cleanup for the NEW key, 
      // since the original promise closure is bound to the old key.
      const wrappedPromise = connectPromise
        .catch((err) => {
          getClientsMap().delete(newKey);
          throw err;
        })
        .finally(() => {
          getConnectingMap().delete(newKey);
        });
        
      connecting.set(newKey, wrappedPromise);
    }
    console.log(`[TG-CLIENT] Re-keyed successfully.`);
  } else {
    console.warn(`[TG-CLIENT] updateClientKey: oldKey not found in cache!`);
  }
}

export async function disconnectClient(key: string) {
  const clients = getClientsMap();
  const connecting = getConnectingMap();
  
  // 1. Remove from connecting map (prevent new connections)
  connecting.delete(key);
  
  // 2. Disconnect and remove from client map
  const client = clients.get(key);
  if (client) {
    clients.delete(key);
    if (client.connected) {
      console.log(`[TG-CLIENT] Disconnecting client "${key.substring(0, 8)}..."`);
      await client.disconnect().catch(() => {});
    }
  }
}


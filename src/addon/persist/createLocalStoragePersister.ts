import { PersistedClient, Persister } from './types';

interface CreateLocalStoragePersisterOptions {
    key?: string;
    throttleTime?: number;
    serialize?: (client: PersistedClient) => string;
    deserialize?: (cachedString: string) => PersistedClient;
    storage?: Storage;
}

export function createLocalStoragePersister({
    key = 'QUANTUM_QUERY_OFFLINE_CACHE',
    throttleTime = 1000,
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    storage = typeof window !== 'undefined' ? window.localStorage : undefined,
}: CreateLocalStoragePersisterOptions = {}): Persister {

    // Simple throttle implementation
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let lastArgs: PersistedClient | null = null;

    const save = () => {
        if (lastArgs && storage) {
            try {
                storage.setItem(key, serialize(lastArgs));
            } catch (err) {
                console.error('Quantum Query: Failed to save to storage', err);
            }
        }
        timeout = null;
    };

    return {
        persistClient(client: PersistedClient) {
            lastArgs = client;
            if (timeout) return;
            timeout = setTimeout(save, throttleTime);
        },

        restoreClient(): PersistedClient | undefined {
            if (!storage) return undefined;
            const cachedString = storage.getItem(key);
            if (!cachedString) return undefined;
            try {
                return deserialize(cachedString);
            } catch (err) {
                console.error('Quantum Query: Failed to parse from storage', err);
                return undefined;
            }
        },

        removeClient() {
            storage?.removeItem(key);
        },
    };
}

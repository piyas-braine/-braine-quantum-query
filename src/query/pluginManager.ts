import { type QueryPlugin } from './types';
import type { QueryKeyInput, CacheEntry } from './queryStorage';

/**
 * Minimal Plugin Client API (Principle of Least Privilege)
 * Plugins only get access to what they need, not the entire QueryClient
 */
export interface PluginClientAPI {
    getSnapshot(): Map<string, CacheEntry<unknown>>;
    invalidate(key: QueryKeyInput): void;
    has(key: QueryKeyInput): boolean;
    isStale(key: QueryKeyInput): boolean;
}

export class PluginManager {
    private plugins: QueryPlugin[] = [];
    private client: PluginClientAPI | null = null;

    setClient(client: PluginClientAPI): void {
        this.client = client;
    }

    add(plugin: QueryPlugin): void {
        this.plugins.push(plugin);
    }

    onFetchStart(queryKey: unknown[]): void {
        this.plugins.forEach(p => p.onFetchStart?.(queryKey));
    }

    onFetchSuccess(queryKey: unknown[], data: unknown): void {
        this.plugins.forEach(p => p.onFetchSuccess?.(queryKey, data));
    }

    onFetchError(queryKey: unknown[], error: Error): void {
        this.plugins.forEach(p => p.onFetchError?.(queryKey, error));
    }

    onInvalidate(queryKey: unknown[]): void {
        this.plugins.forEach(p => p.onInvalidate?.(queryKey));
    }

    onQueryUpdated(queryKey: unknown[], data: unknown): void {
        this.plugins.forEach(p => p.onQueryUpdated?.(queryKey, data));
    }

    /**
     * Get client API for plugins that need it
     */
    getClient(): PluginClientAPI {
        if (!this.client) {
            throw new Error('[Quantum] PluginManager: Client not initialized. Call setClient() first.');
        }
        return this.client;
    }
}

import { type QueryPlugin } from './types';

export class PluginManager {
    private plugins: QueryPlugin[] = [];
    private client: any;

    setClient(client: any) {
        this.client = client;
    }

    add(plugin: QueryPlugin) {
        this.plugins.push(plugin);
    }

    onFetchStart(queryKey: unknown[]) {
        this.plugins.forEach(p => p.onFetchStart?.(queryKey));
    }

    onFetchSuccess(queryKey: unknown[], data: unknown) {
        this.plugins.forEach(p => p.onFetchSuccess?.(queryKey, data));
    }

    onFetchError(queryKey: unknown[], error: Error) {
        this.plugins.forEach(p => p.onFetchError?.(queryKey, error));
    }

    onInvalidate(queryKey: unknown[]) {
        this.plugins.forEach(p => p.onInvalidate?.(queryKey));
    }

    onQueryUpdated(queryKey: unknown[], data: unknown) {
        this.plugins.forEach(p => p.onQueryUpdated?.(queryKey, data));
    }
}

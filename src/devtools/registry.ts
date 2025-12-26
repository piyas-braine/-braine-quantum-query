import { type Signal, createSignal } from '../signals';

export interface StoreEntry {
    name: string;
    store: object;
}

// Global registry of stores for DevTools
const stores = createSignal<StoreEntry[]>([]);

export function registerStore(store: object, name: string = 'Store') {
    const current = stores.get();
    if (!current.find(s => s.store === store)) {
        stores.set([...current, { name, store }]);
    }
}

export function getStores() {
    return stores;
}

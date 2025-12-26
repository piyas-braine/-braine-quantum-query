import { registerStore } from '../devtools/registry';

export function enableDevTools(store: object, name: string = 'Store') {
    // 1. Register with Quantum DevTools (Built-in)
    registerStore(store, name);

    // 2. Connect to Redux DevTools Extension (External) - TODO: Port to Signals
    console.warn("DevTools for Signals are WIP");
}

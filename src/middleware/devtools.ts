import { subscribe } from '../store/proxy';
import { registerStore } from '../devtools/registry';

interface ReduxDevTools {
    connect: (options: { name: string }) => {
        init: (state: unknown) => void;
        send: (action: { type: string; payload: unknown }, state: unknown) => void;
    };
}

export function enableDevTools(store: object, name: string = 'Store') {
    // 1. Register with Quantum DevTools (Built-in)
    registerStore(store, name);

    // 2. Connect to Redux DevTools Extension (External)
    const win = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : null;
    const extension = win?.__REDUX_DEVTOOLS_EXTENSION__ as ReduxDevTools | undefined;

    if (!extension) return;

    const devTools = extension.connect({ name });

    devTools.init(store);

    subscribe(store, (_target, prop, value) => {
        devTools.send({ type: `SET_${String(prop)}`, payload: value }, store);
    });
}

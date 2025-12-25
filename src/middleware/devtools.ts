import { subscribe } from '../core/proxy';

export function enableDevTools(store: any, name: string = 'Store') {
    if (typeof window === 'undefined' || !(window as any).__REDUX_DEVTOOLS_EXTENSION__) return;

    const devTools = (window as any).__REDUX_DEVTOOLS_EXTENSION__.connect({ name });

    devTools.init(store);

    subscribe(store, (target, prop, value) => {
        devTools.send({ type: `SET_${String(prop)}`, payload: value }, store);
    });
}

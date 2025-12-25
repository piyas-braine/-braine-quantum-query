import React, { Suspense } from 'react';
import { useStore, createState } from '../index';

// 1. Global Store
const globalStore = createState({
    user: { name: 'Anonymous' },
    async login() {
        this.user = new Promise(resolve =>
            setTimeout(() => resolve({ name: 'Logged In' }), 1000)
        ) as unknown as { name: string };
    }
});

export function App() {
    const snap = useStore(globalStore);

    return (
        <div>
            <h1>Hello, {snap.user.name}</h1>
            <button onClick={() => globalStore.login()}>
                Login (Async)
            </button>

            <Suspense fallback="Loading lazy component...">
                <AsyncData />
            </Suspense>
        </div>
    );
}

function AsyncData() {
    // 2. Local State
    const local = useStore(createState({ count: 0 }));

    return (
        <button onClick={() => local.count++}>
            Count: {local.count}
        </button>
    );
}

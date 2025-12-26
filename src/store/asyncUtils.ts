import { scheduleUpdate } from './scheduler';

const PROMISE_CACHE = new WeakMap<Promise<unknown>, unknown>();
const PROMISE_STATUS = new WeakMap<Promise<unknown>, 'pending' | 'fulfilled' | 'rejected'>();
const PROMISE_ERROR = new WeakMap<Promise<unknown>, unknown>();

export function isPromise(value: unknown): value is Promise<unknown> {
    return !!value && typeof (value as Record<string, unknown>).then === 'function';
}

export function handlePromise(promise: Promise<unknown>, triggerUpdate: () => void) {
    if (PROMISE_STATUS.has(promise)) return; // Already tracking

    PROMISE_STATUS.set(promise, 'pending');

    promise.then(
        (value) => {
            PROMISE_STATUS.set(promise, 'fulfilled');
            PROMISE_CACHE.set(promise, value);
            triggerUpdate();
        },
        (error) => {
            PROMISE_STATUS.set(promise, 'rejected');
            PROMISE_ERROR.set(promise, error);
            triggerUpdate();
        }
    );
}

export function unwrapPromise(promise: Promise<unknown>) {
    const status = PROMISE_STATUS.get(promise);

    if (status === 'fulfilled') {
        return PROMISE_CACHE.get(promise);
    } else if (status === 'rejected') {
        throw PROMISE_ERROR.get(promise);
    } else {
        // It's pending. throw to suspend.
        // Important: We need to make sure we don't throw if we are just inspecting
        // outside of React render. But standard Suspense behavior is to throw.
        throw promise;
    }
}

export function getPromiseState(promise: Promise<unknown>) {
    return {
        status: PROMISE_STATUS.get(promise) || 'pending',
        value: PROMISE_CACHE.get(promise),
        error: PROMISE_ERROR.get(promise)
    };
}

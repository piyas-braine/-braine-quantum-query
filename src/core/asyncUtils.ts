import { scheduleUpdate } from './scheduler';

const PROMISE_CACHE = new WeakMap<Promise<any>, any>();
const PROMISE_STATUS = new WeakMap<Promise<any>, 'pending' | 'fulfilled' | 'rejected'>();
const PROMISE_ERROR = new WeakMap<Promise<any>, any>();

export function isPromise(value: any): value is Promise<any> {
    return !!value && typeof value.then === 'function';
}

export function handlePromise(promise: Promise<any>, triggerUpdate: () => void) {
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

export function unwrapPromise(promise: Promise<any>) {
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

export function getPromiseState(promise: Promise<any>) {
    return {
        status: PROMISE_STATUS.get(promise) || 'pending',
        value: PROMISE_CACHE.get(promise),
        error: PROMISE_ERROR.get(promise)
    };
}

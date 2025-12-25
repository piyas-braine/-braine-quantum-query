import { getActiveListener, setActiveListener } from './proxy';

export function computed<T>(fn: () => T) {
    // We need to track dependencies of this function
    // And when they change, re-evaluate.
    // But we also want to be lazy.

    // This is actually complex. 
    // For a simple scalable lib, 'getters' on the state object are the natural 'computed'.
    // Since our proxy tracks *access*, if you have a getter:
    // get fullName() { return this.first + this.last }
    // Accessing `state.fullName` will trigger reads on `first` and `last`.
    // The component listener effectively subscribes to `first` and `last` directly!

    // So, NATIVE PROTECTED GETTERS work out of the box with our proxy!
    // No special `computed` function needed for basic cases.

    // However, for expensive computations, we want MEMOIZATION.

    let value: T;
    let dirty = true;

    // To implement memoization correctly with automatic invalidation, 
    // we would need a dependency graph.
    // Given the constraint of <1kb and simplicity, 
    // we might skip complex graph-based computed and rely on React's `useMemo` 
    // OR standard getters.

    // But let's try a simple memoizer.
    return {
        get value() {
            if (dirty) {
                value = fn();
                dirty = false;
            }
            return value;
        }
    };
}

// Actually, the "Killer Feature" of tracking proxies is that standard JS getters AUTOMATICALLY work.
// We just need to document that.
// But for *expensive* derived state, we might want a `derive` helper.

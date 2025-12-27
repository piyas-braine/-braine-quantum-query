/**
 * Stable Hash Utility (Production Grade)
 * Deterministically hashes values ensuring object key order doesn't affect the hash.
 * 
 * Performance Safeguards:
 * - Recursion depth limit (prevent Stack Overflow)
 * - Size limit (prevent CPU lockout on massive keys)
 */
export function stableHash(value: unknown, depth = 0): string {
    // 1. Recursion Guard (Max depth 15 for query keys is plenty)
    if (depth > 15) {
        throw new Error("[Quantum] Query key is too deeply nested. Max depth is 15.");
    }

    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

    if (typeof value !== 'object') {
        // Primitives: Prefix with type to prevent "123" vs 123 collision
        const strValue = String(value);
        // 2. Length Guard for primitives (rare but safer)
        if (strValue.length > 1000) {
            return `${typeof value}:[large-string:${strValue.slice(0, 10)}...]`;
        }
        return `${typeof value}:${strValue}`;
    }

    if (Array.isArray(value)) {
        return `array:[${value.map(v => stableHash(v, depth + 1)).join(',')}]`;
    }

    // Objects
    const keys = Object.keys(value).sort();

    // Performance optimization: limit number of keys to hash if it's too many?
    // For now, let's stick to sorted join.
    return `object:{${keys.map(key => `${key}:${stableHash((value as Record<string, unknown>)[key], depth + 1)}`).join(',')}}`;
}
/**
 * Deep Equality Utility (Optimized for State Comparison)
 * Performs a structural check without stringification.
 */
export function isDeepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;

    if (a && b && typeof a === 'object' && typeof b === 'object') {
        const objA = a as Record<string, unknown>;
        const objB = b as Record<string, unknown>;

        if (objA.constructor !== objB.constructor) return false;

        let length, i, keys;
        if (Array.isArray(a)) {
            // Type guard ensures both are arrays
            if (!Array.isArray(b)) return false;

            length = a.length;
            if (length !== b.length) return false;
            for (i = length; i-- !== 0;) {
                if (!isDeepEqual(a[i], b[i])) return false;
            }
            return true;
        }

        if (objA.valueOf !== Object.prototype.valueOf) return objA.valueOf() === objB.valueOf();
        if (objA.toString !== Object.prototype.toString) return objA.toString() === objB.toString();

        keys = Object.keys(objA);
        length = keys.length;
        if (length !== Object.keys(objB).length) return false;

        for (const key of keys) {
            if (!Object.prototype.hasOwnProperty.call(objB, key)) return false;
        }

        for (const key of keys) {
            if (!isDeepEqual(objA[key], objB[key])) return false;
        }

        return true;
    }

    // NaN check
    return a !== a && b !== b;
}

/**
 * Stable Hash Utility
 * Deterministically hashes values ensuring object key order doesn't affect the hash.
 * Handles: primitives, arrays, objects, nested structures.
 * 
 * Update: Adds type prefixes to prevent collisions (e.g. 123 vs "123").
 */
export function stableHash(value: unknown): string {
    if (value === null) {
        return 'null';
    }

    if (value === undefined) {
        return 'undefined';
    }

    if (typeof value !== 'object') {
        // Primitives: Prefix with type to prevent "123" vs 123 collision
        return `${typeof value}:${String(value)}`;
    }

    if (Array.isArray(value)) {
        // Hash array elements in order
        return `array:[${value.map(stableHash).join(',')}]`;
    }

    // Objects
    const keys = Object.keys(value).sort();
    // Hash object keys in sorted order
    // Format: object:{key1:hash1,key2:hash2}
    return `object:{${keys.map(key => `${key}:${stableHash((value as Record<string, unknown>)[key])}`).join(',')}}`;
}

/**
 * Stable Hash Utility
 * Deterministically hashes values to ensuring object key order doesn't affect the hash.
 * Handles: primitives, arrays, objects, nested structures.
 */
export function stableHash(value: any): string {
    if (value === null || typeof value !== 'object') {
        return String(value);
    }

    if (Array.isArray(value)) {
        // Hash array elements in order
        return '[' + value.map(stableHash).join(',') + ']';
    }

    const keys = Object.keys(value).sort();
    // Hash object keys in sorted order
    return '{' + keys.map(key => `${key}:${stableHash(value[key])}`).join(',') + '}';
}

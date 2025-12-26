import { type Schema } from '../types';

/**
 * Validates data against a provided schema.
 * Supports any schema library that implements the `parse` method (Zod, etc.)
 */
export function validateWithSchema<T>(data: unknown, schema?: Schema<T>): T {
    if (!schema) {
        return data as T;
    }
    return schema.parse(data);
}

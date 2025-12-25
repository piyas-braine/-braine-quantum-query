
import { describe, it, expect } from 'vitest';

describe('Environment Verification', () => {
    it('should support Response.clone', () => {
        const res = new Response('test', { status: 200 });
        expect(typeof res.clone).toBe('function');
        const clone = res.clone();
        expect(clone).toBeInstanceOf(Response);
    });
});

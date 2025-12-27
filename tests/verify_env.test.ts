import { describe, it, expect } from 'vitest';
import * as Lib from '../src/index';

describe('Environment & API Check', () => {
    it('should have working environment', () => {
        expect(true).toBe(true);
    });

    it('should export Public API', () => {
        expect(Lib.useQuery).toBeDefined();
        expect(Lib.useMutation).toBeDefined();
        expect(Lib.useSuspenseQuery).toBeDefined();
        expect(Lib.QueryClient).toBeDefined();
        expect(Lib.atom).toBeDefined();
    });
});

describe('Environment Verification', () => {
    it('should support Response.clone', () => {
        const res = new Response('test');
        const clone = res.clone();
        expect(clone).toBeInstanceOf(Response);
    });
});

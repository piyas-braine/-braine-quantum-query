import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHttpClient } from '../src/addon/httpClient';

const mockFetch = vi.fn();
global.fetch = mockFetch;
// Mock setTimeout/clearTimeout for predictable tests? 
// No, let's use real time for simplicity or vitest fake timers.
// Vitest fake timers are better.

describe('HttpClient Enterprise 2.0', () => {
    beforeEach(() => {
        mockFetch.mockReset();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should timeout if request takes too long', async () => {
        mockFetch.mockImplementation(async (input, init) => {
            const signal = (input instanceof Request) ? input.signal : init?.signal;

            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => resolve(new Response('{}', { status: 200 })), 5000);
                if (signal) {
                    signal.addEventListener('abort', () => {
                        clearTimeout(timer);
                        reject(new DOMException('Aborted', 'AbortError'));
                    });
                }
            });
        });

        const api = createHttpClient({ baseURL: 'http://test', timeout: 1000 }); // Timeout 1s

        const promise = api.get('/slow');

        // Fast-forward time
        vi.advanceTimersByTime(2000);

        await expect(promise).rejects.toThrow('Aborted');
    });

    it('should retry on 500 error', async () => {
        // 1. Fail (500)
        mockFetch.mockResolvedValueOnce(new Response('Error', { status: 500, statusText: 'Internal Server Error' }));

        // 2. Success (200)
        mockFetch.mockResolvedValueOnce(new Response('{"id": 1}', { status: 200 }));

        const api = createHttpClient({
            retry: { retries: 2, baseDelay: 100, maxDelay: 1000 }
        });

        const promise = api.get<{ id: number }>('/flaky');

        // Advance time for backoff delay
        await vi.advanceTimersByTimeAsync(200);

        const res = await promise;
        expect(res.id).toBe(1);
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should NOT retry on 404', async () => {
        mockFetch.mockResolvedValueOnce(new Response('Not Found', { status: 404, statusText: 'Not Found' }));

        const api = createHttpClient({ retry: 3 });

        await expect(api.get('/missing')).rejects.toThrow('HTTP Error 404');
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });
});

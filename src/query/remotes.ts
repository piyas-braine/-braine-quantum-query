
import { QueryError, reportError } from './errors';

export class QueryRemotes {
    private deduplicationCache = new Map<string, {
        promise: Promise<unknown>;
        status: 'pending' | 'resolved' | 'rejected';
        timestamp: number;
    }>();
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;

    constructor() {
        // Periodic cleanup of stale entries
        this.cleanupTimer = setInterval(() => {
            this.cleanupStaleEntries();
        }, 30000); // 30 seconds
    }

    async fetch<T>(
        key: string,
        fn: (context: { signal?: AbortSignal }) => Promise<T>,
        options?: {
            signal?: AbortSignal;
            retry?: number | boolean;
            retryDelay?: number | ((attemptIndex: number) => number);
        }
    ): Promise<T> {
        // Check for existing pending request
        const existing = this.deduplicationCache.get(key);

        if (existing && existing.status === 'pending') {
            // Return existing promise for deduplication
            return existing.promise as Promise<T>;
        }

        // Create new request
        const promise = this.executeWithRetry(fn, options);

        // Track with status
        this.deduplicationCache.set(key, {
            promise,
            status: 'pending',
            timestamp: Date.now()
        });

        try {
            const result = await promise;

            // Update status but keep in cache briefly for deduplication
            const entry = this.deduplicationCache.get(key);
            if (entry) {
                entry.status = 'resolved';
            }

            // Clean up after short delay to allow concurrent requests to dedupe
            setTimeout(() => {
                this.deduplicationCache.delete(key);
            }, 100);

            return result;
        } catch (error) {
            // Update status
            const entry = this.deduplicationCache.get(key);
            if (entry) {
                entry.status = 'rejected';
            }

            // Clean up immediately on error
            this.deduplicationCache.delete(key);
            throw error;
        }
    }

    private async executeWithRetry<T>(
        fn: (context: { signal?: AbortSignal }) => Promise<T>,
        options?: {
            signal?: AbortSignal;
            retry?: number | boolean;
            retryDelay?: number | ((attemptIndex: number) => number);
            queryKey?: unknown[];
        }
    ): Promise<T> {
        const maxRetries = this.resolveRetry(options?.retry);
        let attempt = 0;

        while (true) {
            attempt++;
            try {
                return await fn({ signal: options?.signal });
            } catch (error) {
                // Convert to QueryError for intelligent handling
                const queryError = QueryError.fromUnknown(error, {
                    queryKey: options?.queryKey,
                    retryCount: attempt
                });

                // Report error globally
                reportError(queryError);

                // Check if we should retry
                if (!queryError.shouldRetry(attempt, maxRetries) ||
                    (options?.signal && options.signal.aborted)) {
                    throw queryError;
                }

                // Use QueryError's intelligent retry delay
                const delay = this.calculateRetryDelay(attempt, options?.retryDelay, queryError);
                await this.wait(delay, options?.signal);
            }
        }
    }

    private calculateRetryDelay(
        attempt: number,
        retryDelay?: number | ((attemptIndex: number) => number),
        queryError?: QueryError
    ): number {
        // If QueryError provided, use its intelligent delay
        if (queryError) {
            const baseDelay = queryError.getRetryDelay(attempt);
            // Add jitter
            const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
            return baseDelay + jitter;
        }

        let delay: number;

        if (typeof retryDelay === 'number') {
            delay = retryDelay;
        } else if (typeof retryDelay === 'function') {
            delay = retryDelay(attempt - 1);
        } else {
            // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
            delay = 1000 * (2 ** (attempt - 1));
        }

        // Add jitter: ±25% randomization to prevent thundering herd
        const jitter = delay * 0.25 * (Math.random() * 2 - 1);
        delay = delay + jitter;

        // Cap at 30s
        return Math.min(delay, 30000);
    }

    private resolveRetry(retry: number | boolean | undefined): number {
        if (typeof retry === 'number') return retry;
        if (retry === false) return 0;
        return 3;
    }

    private wait(ms: number, signal?: AbortSignal): Promise<void> {
        return new Promise((resolve, reject) => {
            if (signal?.aborted) return reject(new Error('Aborted'));

            const timer = setTimeout(() => {
                cleanup();
                resolve();
            }, ms);

            const onAbort = () => {
                cleanup();
                reject(new Error('Aborted'));
            };

            const cleanup = () => {
                clearTimeout(timer);
                signal?.removeEventListener('abort', onAbort);
            };

            signal?.addEventListener('abort', onAbort);
        });
    }

    private cleanupStaleEntries(): void {
        const now = Date.now();
        const MAX_AGE = 60000; // 1 minute

        for (const [key, entry] of this.deduplicationCache.entries()) {
            if (now - entry.timestamp > MAX_AGE) {
                this.deduplicationCache.delete(key);
            }
        }
    }

    destroy(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        this.deduplicationCache.clear();
    }
}

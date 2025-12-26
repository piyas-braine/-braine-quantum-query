
export class QueryRemotes {
    private deduplicationCache = new Map<string, Promise<unknown>>();

    async fetch<T>(
        key: string,
        fn: (context: { signal?: AbortSignal }) => Promise<T>,
        options?: {
            signal?: AbortSignal;
            retry?: number | boolean;
            retryDelay?: number | ((attemptIndex: number) => number);
        }
    ): Promise<T> {
        // Deduplication
        if (this.deduplicationCache.has(key)) {
            return this.deduplicationCache.get(key) as Promise<T>;
        }

        const promise = this.executeWithRetry(fn, options);

        this.deduplicationCache.set(key, promise);

        try {
            const result = await promise;
            this.deduplicationCache.delete(key);
            return result;
        } catch (error) {
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
        }
    ): Promise<T> {
        const maxRetries = this.resolveRetry(options?.retry);
        let attempt = 0;

        while (true) {
            attempt++;
            try {
                return await fn({ signal: options?.signal });
            } catch (error) {
                if (attempt > maxRetries || (options?.signal && options.signal.aborted)) {
                    throw error;
                }

                let delay = 1000 * (2 ** (attempt - 1));
                if (options?.retryDelay) {
                    delay = typeof options.retryDelay === 'number'
                        ? options.retryDelay
                        : options.retryDelay(attempt - 1);
                }

                // Cap at 30s
                delay = Math.min(delay, 30000);

                await this.wait(delay, options?.signal);
            }
        }
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
}

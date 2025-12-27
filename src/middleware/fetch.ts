import type { Middleware } from './types';
import { HttpError } from '../clientTypes';

// Fetch Terminator
export const FetchMiddleware: Middleware<unknown> = async (ctx) => {
    return fetch(ctx.req);
};

// Retry Middleware
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

interface RetryConfig {
    retries?: number;
    baseDelay?: number;
    maxDelay?: number;
}

export const RetryMiddleware: Middleware<unknown> = async (ctx, next) => {
    const retryConfigRaw = ctx.config.retry;

    if (!retryConfigRaw) return next(ctx);

    let config: RetryConfig;
    if (typeof retryConfigRaw === 'number') {
        config = { retries: retryConfigRaw };
    } else if (typeof retryConfigRaw === 'boolean') {
        // 10/10 Logic: Handle boolean shortcut
        config = retryConfigRaw ? { retries: 3 } : { retries: 0 };
    } else if (typeof retryConfigRaw === 'object' && retryConfigRaw !== null) {
        config = retryConfigRaw as RetryConfig;
    } else {
        // Invalid config, skip retry
        return next(ctx);
    }

    const { retries = 0, baseDelay = 1000, maxDelay = 3000 } = config;

    const attempt = async (count: number): Promise<Response> => {
        try {
            const response = await next(ctx);
            if (!response.ok && response.status !== 401) { // 401 handled by Auth
                // Don't retry 4xx except 429
                if (response.status < 500 && response.status !== 429) {
                    return response;
                }

                // Throw to trigger retry for 5xx or 429
                throw new HttpError(response.status, response.statusText);
            }
            return response;
        } catch (err: unknown) {
            if (count < retries) {
                // Ignore Abort
                if (err instanceof Error && err.name === 'AbortError') throw err;

                const d = Math.min(baseDelay * (2 ** count), maxDelay);
                await delay(d);
                return attempt(count + 1);
            }
            throw err;
        }
    };

    return attempt(0);
};

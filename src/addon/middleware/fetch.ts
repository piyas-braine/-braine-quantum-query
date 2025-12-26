import { Middleware } from './types';
import { HttpError } from '../clientTypes';

// Fetch Terminator
export const FetchMiddleware: Middleware<any> = async (ctx) => {
    return fetch(ctx.req);
};

// Retry Middleware
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

interface RetryConfig {
    retries?: number;
    baseDelay?: number;
    maxDelay?: number;
}

export const RetryMiddleware: Middleware<any> = async (ctx, next) => {
    // Safe unknown cast with type guard or interface
    const retryConfigRaw = ctx.config.retry as unknown;

    if (!retryConfigRaw) return next(ctx);

    let config: RetryConfig;
    if (typeof retryConfigRaw === 'number') {
        config = { retries: retryConfigRaw };
    } else {
        config = retryConfigRaw as RetryConfig;
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

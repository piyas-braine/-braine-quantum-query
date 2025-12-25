import { Middleware } from './types';
import { HttpError } from '../clientTypes';

// Fetch Terminator
export const FetchMiddleware: Middleware<any> = async (ctx) => {
    return fetch(ctx.req);
};

// Retry Middleware
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const RetryMiddleware: Middleware<any> = async (ctx, next) => {
    const retryConfig = ctx.config.retry as any; // Cast or normalize
    // We assume normalized config in ctx?

    if (!retryConfig) return next(ctx);

    const { retries = 0, baseDelay = 1000, maxDelay = 3000 } = typeof retryConfig === 'number'
        ? { retries: retryConfig }
        : retryConfig;

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
        } catch (err: any) {
            if (count < retries) {
                // Ignore Abort
                if (err.name === 'AbortError') throw err;

                const d = Math.min(baseDelay * (2 ** count), maxDelay);
                await delay(d);
                return attempt(count + 1);
            }
            throw err;
        }
    };

    return attempt(0);
};

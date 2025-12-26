import { type RequestConfig, type HttpClient } from '../clientTypes';

export type CacheEntry<T = unknown> = {
    data: T;
    timestamp: number;
    expiresAt: number;
};

export type MiddlewareContext<T> = {
    req: Request;
    config: RequestConfig<T>;
    cache: Map<string, CacheEntry<unknown>>;
    inflight: Map<string, Promise<unknown>>;
    client: HttpClient;
};

export type MiddlewareNext<T> = (ctx: MiddlewareContext<T>) => Promise<Response>;

export type Middleware<T> = (ctx: MiddlewareContext<T>, next: MiddlewareNext<T>) => Promise<Response>;

export function compose<T>(middleware: Middleware<T>[]): Middleware<T> {
    return (ctx, next) => {
        let index = -1;

        async function dispatch(i: number): Promise<Response> {
            // if (i <= index) throw new Error('next() called multiple times'); // Allow retries
            index = i;

            let fn = middleware[i];
            if (i === middleware.length) fn = next as unknown as Middleware<T>; // Terminator

            if (!fn) return Promise.resolve(new Response(null, { status: 404 })); // Should handle fetch

            try {
                return fn(ctx, dispatch.bind(null, i + 1));
            } catch (err) {
                return Promise.reject(err);
            }
        }

        return dispatch(0);
    };
}

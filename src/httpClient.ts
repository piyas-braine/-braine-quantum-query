import { compose } from './middleware/types';
import type { Middleware, MiddlewareContext, CacheEntry } from './middleware/types';
import { DedupeMiddleware } from './middleware/dedupe';
import { CacheMiddleware } from './middleware/cache';
import { AuthMiddleware } from './middleware/auth';
import { RetryMiddleware, FetchMiddleware } from './middleware/fetch';
import { HttpError } from './clientTypes';
import type { HttpClientConfig, RequestConfig, HttpClient } from './clientTypes';

export function createHttpClient(config: HttpClientConfig): HttpClient {
    const cache = new Map<string, CacheEntry<unknown>>();
    const inflight = new Map<string, Promise<unknown>>();

    // Assemble Middleware Chain
    // Order: Interceptors (Manual) -> Dedupe -> Cache -> Auth -> Retry -> Fetch
    const pipeline = compose([
        DedupeMiddleware,
        CacheMiddleware,
        AuthMiddleware,
        RetryMiddleware,
        FetchMiddleware
    ]);

    const client: HttpClient = {
        config, // Expose for middleware access

        async request<T>(endpoint: string, options: RequestConfig<T> = {}): Promise<T> {
            let url = config.baseURL ? `${config.baseURL}${endpoint}` : endpoint;

            // 0. Global Setup & Interceptors
            let headers = new Headers({
                'Content-Type': 'application/json',
                ...config.headers,
                ...options.headers
            });

            // Merge Timeout/Abort
            const timeoutMs = options.timeout ?? config.timeout ?? 10000;
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeoutMs);

            const userSignal = options.signal;
            // Listen to user signal to abort controller?
            if (userSignal) {
                if (userSignal.aborted) {
                    clearTimeout(id);
                    throw new Error('Aborted');
                }
                userSignal.addEventListener('abort', () => {
                    clearTimeout(id);
                    controller.abort();
                });
            }

            // Construct Request Object
            const { cache: _c, schema: _s, timeout: _t, retry: _r, ...fetchOptions } = options;
            let req = new Request(url, {
                ...fetchOptions,
                headers,
                signal: controller.signal
            });

            // 1. Interceptor: Request (Before Middleware)
            if (config.interceptors?.request) {
                const newConfig = await config.interceptors.request({ ...options, headers: Object.fromEntries(headers) });
                const { cache: _nc, schema: _ns, timeout: _nt, retry: _nr, ...newFetchOptions } = newConfig;
                req = new Request(url, {
                    ...newFetchOptions,
                    signal: controller.signal
                });
            }

            // Create Context
            const ctx: MiddlewareContext<T> = {
                req,
                config: {
                    ...options,
                    retry: options.retry !== undefined ? options.retry : config.retry
                }, // Merge retry
                cache,
                inflight,
                client: this // Pass client for Auth access hooks
            };

            try {
                // EXECUTE MIDDLEWARE PIPELINE
                let response = await pipeline(ctx, async () => new Response('Internal Error', { status: 500 }));

                clearTimeout(id);

                // 2. Interceptor: Response
                if (config.interceptors?.response) {
                    response = await config.interceptors.response(response);
                }

                if (!response.ok) {
                    throw new HttpError(response.status, `HTTP Error ${response.status}`);
                }

                // 3. Parse & Validate
                let data: unknown;
                if (response.status === 204) {
                    data = {};
                } else {
                    const text = await response.text();
                    try {
                        data = JSON.parse(text);
                    } catch {
                        data = text;
                    }
                }

                if (options.schema) {
                    try {
                        if (options.schema.parse) return options.schema.parse(data);
                        if (options.schema.validateSync) return options.schema.validateSync(data);
                    } catch (error: unknown) {
                        const err = error as Record<string, unknown>;
                        // Compatibility: Wrap Zod/Validation errors
                        if (err.errors || err.name === 'ZodError' || err.name === 'ValidationError') {
                            throw new Error(`Validation Error: ${JSON.stringify(err.errors || err.message)}`);
                        }
                        throw error;
                    }
                }

                return data as T;
            } catch (err) {
                clearTimeout(id);
                throw err;
            }
        },

        get<T>(url: string, config?: RequestConfig<T>) {
            return this.request<T>(url, { ...config, method: 'GET' });
        },
        post<T>(url: string, data?: unknown, config?: RequestConfig<T>) {
            return this.request<T>(url, { ...config, method: 'POST', body: JSON.stringify(data) });
        },
        put<T>(url: string, data?: unknown, config?: RequestConfig<T>) {
            return this.request<T>(url, { ...config, method: 'PUT', body: JSON.stringify(data) });
        },
        delete<T>(url: string, config?: RequestConfig<T>) {
            return this.request<T>(url, { ...config, method: 'DELETE' });
        },
        patch<T>(url: string, data?: unknown, config?: RequestConfig<T>) {
            return this.request<T>(url, { ...config, method: 'PATCH', body: JSON.stringify(data) });
        }
    };
    return client;
}

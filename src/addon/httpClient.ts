import { compose } from './middleware/types';
import type { Middleware, MiddlewareContext, CacheEntry } from './middleware/types';
import { DedupeMiddleware } from './middleware/dedupe';
import { CacheMiddleware } from './middleware/cache';
import { AuthMiddleware } from './middleware/auth';
import { RetryMiddleware, FetchMiddleware } from './middleware/fetch';
import { HttpError } from './clientTypes';
import type { HttpClientConfig, RequestConfig } from './clientTypes';

export type HttpClient = {
    get: <T>(url: string, config?: RequestConfig<T>) => Promise<T>;
    post: <T>(url: string, data?: unknown, config?: RequestConfig<T>) => Promise<T>;
    put: <T>(url: string, data?: unknown, config?: RequestConfig<T>) => Promise<T>;
    delete: <T>(url: string, config?: RequestConfig<T>) => Promise<T>;
    patch: <T>(url: string, data?: unknown, config?: RequestConfig<T>) => Promise<T>;
    request: <T>(url: string, config?: RequestConfig<T>) => Promise<T>;
    config: HttpClientConfig; // Expose config for middleware
};

export function createHttpClient(config: HttpClientConfig): HttpClient {
    const cache = new Map<string, CacheEntry>();
    const inflight = new Map<string, Promise<any>>();

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
            let req = new Request(url, {
                ...options,
                headers,
                signal: controller.signal
            });

            // 1. Interceptor: Request (Before Middleware)
            if (config.interceptors?.request) {
                // Interceptors modify 'options', we must rebuild Request?
                // Legacy interceptor API modified config object.
                const newConfig = await config.interceptors.request({ ...options, headers: Object.fromEntries(headers) });
                // Rebuild Headers
                // This is a bit messy with legacy interceptor support + Request object.
                // ideally interceptors should be middleware too.
                // For now, let's just use the config output.
                req = new Request(url, {
                    ...newConfig,
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
                    } catch (error: any) {
                        // Compatibility: Wrap Zod/Validation errors
                        if (error.errors || error.name === 'ZodError' || error.name === 'ValidationError') {
                            throw new Error(`Validation Error: ${JSON.stringify(error.errors || error.message)}`);
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

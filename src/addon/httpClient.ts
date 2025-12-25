// Utility: Wait for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class HttpError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'HttpError';
    }
}

export type RetryConfig = {
    retries: number;
    baseDelay: number;
    maxDelay: number;
    shouldRetry?: (error: unknown, attempt: number) => boolean;
};

export type HttpClientConfig = {
    baseURL?: string;
    headers?: Record<string, string>;
    timeout?: number; // ms
    retry?: number | RetryConfig;
    auth?: {
        getToken: () => string | Promise<string | null>;
        onTokenExpired: (client: HttpClient) => Promise<string | null>;
        onAuthFailed?: () => void;
    };
    interceptors?: {
        request?: (config: RequestConfig<unknown>) => RequestConfig<unknown> | Promise<RequestConfig<unknown>>;
        response?: (response: Response) => Response | Promise<Response>;
    };
};

export type Validator<T> = {
    parse?: (data: unknown) => T; // Zod
    validateSync?: (data: unknown) => T; // Yup
};

export type RequestConfig<T> = RequestInit & {
    schema?: Validator<T>;
    timeout?: number;
    retry?: number | RetryConfig;
};

export type HttpClient = {
    get: <T>(url: string, config?: RequestConfig<T>) => Promise<T>;
    post: <T>(url: string, data?: unknown, config?: RequestConfig<T>) => Promise<T>;
    put: <T>(url: string, data?: unknown, config?: RequestConfig<T>) => Promise<T>;
    delete: <T>(url: string, config?: RequestConfig<T>) => Promise<T>;
    patch: <T>(url: string, data?: unknown, config?: RequestConfig<T>) => Promise<T>;
    request: <T>(url: string, config?: RequestConfig<T>) => Promise<T>;
};

export function createHttpClient(config: HttpClientConfig): HttpClient {
    let isRefreshing = false;
    let refreshPromise: Promise<string | null> | null = null;

    // In-flight request registry
    const inflightRequests = new Map<string, Promise<any>>();

    // Normalize Retry Config
    const getRetryConfig = (reqConfig?: RequestConfig<unknown>): RetryConfig | null => {
        const raw = reqConfig?.retry ?? config.retry;
        if (raw === undefined || raw === 0) return null;
        if (typeof raw === 'number') {
            return { retries: raw, baseDelay: 1000, maxDelay: 5000 };
        }
        return raw;
    };

    const client: HttpClient = {
        async request<T>(endpoint: string, options: RequestConfig<T> = {}): Promise<T> {
            let url = config.baseURL ? `${config.baseURL}${endpoint}` : endpoint;

            // Deduplication Logic
            const method = options.method || 'GET';
            const isGet = method.toUpperCase() === 'GET';
            const dedupeKey = isGet ? `${method}:${url}` : null;

            if (dedupeKey && inflightRequests.has(dedupeKey)) {
                return inflightRequests.get(dedupeKey) as Promise<T>;
            }

            const retryConfig = getRetryConfig(options);

            // Timeout Logic
            const timeoutMs = options.timeout ?? config.timeout ?? 10000;
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeoutMs);

            // Merge signals (User signal + Timeout signal)
            const userSignal = options.signal;
            let finalSignal = controller.signal;

            if (userSignal) {
                if (userSignal.aborted) {
                    clearTimeout(id);
                    throw new Error('Aborted');
                }
            }

            const executeBaseRequest = async (overrideToken?: string): Promise<Response> => {
                let headers: HeadersInit = {
                    'Content-Type': 'application/json',
                    ...config.headers,
                    ...options.headers,
                };

                // 1. Inject Token
                if (overrideToken) {
                    (headers as any)['Authorization'] = `Bearer ${overrideToken}`;
                } else if (config.auth) {
                    const token = await config.auth.getToken();
                    if (token) {
                        (headers as any)['Authorization'] = `Bearer ${token}`;
                    }
                }

                let requestConfig: RequestConfig<unknown> = {
                    ...options,
                    headers,
                    signal: finalSignal
                };

                // 2. Interceptor: Request
                if (config.interceptors?.request) {
                    requestConfig = await config.interceptors.request(requestConfig);
                }

                try {
                    // Verify user signal didn't abort while we were waiting for token/interceptors
                    if (userSignal?.aborted) throw new DOMException('Aborted', 'AbortError');

                    let response = await fetch(url, requestConfig);

                    // 3. Interceptor: Response
                    if (config.interceptors?.response) {
                        response = await config.interceptors.response(response);
                    }
                    return response;
                } catch (error) {
                    throw error;
                }
            };

            const attemptRequest = async (attempt: number): Promise<Response> => {
                try {
                    const response = await executeBaseRequest();

                    // 4. Auth Refresh Logic (401)
                    if (response.status === 401 && config.auth) {
                        if (!isRefreshing) {
                            isRefreshing = true;
                            refreshPromise = config.auth.onTokenExpired(client)
                                .finally(() => {
                                    isRefreshing = false;
                                    refreshPromise = null;
                                });
                        }

                        const newToken = await refreshPromise;

                        if (newToken) {
                            return executeBaseRequest(newToken); // Retry once with new token
                        } else {
                            config.auth.onAuthFailed?.();
                            throw new HttpError(401, 'Authentication Failed');
                        }
                    }

                    if (!response.ok) {
                        throw new HttpError(response.status, `HTTP Error ${response.status}`);
                    }

                    return response;
                } catch (error: any) {
                    // Retry Logic
                    if (retryConfig && attempt < retryConfig.retries) {
                        const isAbort = error.name === 'AbortError';
                        if (isAbort) throw error; // Don't retry aborts

                        // Don't retry client errors (4xx), except maybe 429
                        if (error instanceof HttpError) {
                            if (error.status < 500 && error.status !== 429) {
                                throw error;
                            }
                        }

                        // Determine delay
                        const d = Math.min(
                            retryConfig.baseDelay * (2 ** attempt),
                            retryConfig.maxDelay
                        );
                        await delay(d);
                        return attemptRequest(attempt + 1);
                    }
                    throw error;
                }
            };

            const execute = async (): Promise<T> => {
                try {
                    const response = await attemptRequest(0);
                    clearTimeout(id); // Clear timeout on success

                    // 5. Parse JSON
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

                    // 6. Schema Validation (Runtime Data Integrity)
                    if (options.schema) {
                        try {
                            if (options.schema.parse) {
                                return options.schema.parse(data);
                            } else if (options.schema.validateSync) {
                                return options.schema.validateSync(data);
                            }
                        } catch (error) {
                            throw new Error(`Validation Error: ${error}`);
                        }
                    }

                    return data as T;
                } catch (err) {
                    clearTimeout(id); // Clear timeout on error
                    throw err;
                }
            };

            const promise = execute();

            if (dedupeKey) {
                inflightRequests.set(dedupeKey, promise);
            }

            try {
                return await promise;
            } finally {
                if (dedupeKey) {
                    inflightRequests.delete(dedupeKey);
                }
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

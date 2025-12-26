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

export type CacheConfig = {
    ttl: number; // Time in ms
    force?: boolean; // Bypass cache
};

// Forward declaration to avoid cycle
export interface HttpClient {
    get: <T>(url: string, config?: RequestConfig<T>) => Promise<T>;
    post: <T>(url: string, data?: unknown, config?: RequestConfig<T>) => Promise<T>;
    put: <T>(url: string, data?: unknown, config?: RequestConfig<T>) => Promise<T>;
    delete: <T>(url: string, config?: RequestConfig<T>) => Promise<T>;
    patch: <T>(url: string, data?: unknown, config?: RequestConfig<T>) => Promise<T>;
    request: <T>(url: string, config?: RequestConfig<T>) => Promise<T>;
    config: HttpClientConfig;
}

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

export type RequestConfig<T> = Omit<RequestInit, 'cache'> & {
    schema?: Validator<T> | undefined;
    timeout?: number | undefined;
    retry?: number | RetryConfig | undefined;
    cache?: CacheConfig | RequestCache;
};

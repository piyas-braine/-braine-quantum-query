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
export type HttpClient = any;

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
    schema?: Validator<T> | undefined;
    timeout?: number | undefined;
    retry?: number | RetryConfig | undefined;
    cache?: CacheConfig;
};

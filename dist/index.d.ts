declare function subscribe(store: object, callback: (target: any, prop: any, value: any) => void): () => boolean;
declare function createState<T extends object>(initialState: T): T;

type ModelDefinition<S, A, C> = {
    state: S;
    actions?: A & ThisType<S & A & C>;
    computed?: C & ThisType<S & A & C>;
};
type ComputedValues<T> = {
    [K in keyof T]: T[K] extends (...args: any[]) => infer R ? R : never;
};
declare function defineModel<S extends object, A extends object, C extends object>(def: ModelDefinition<S, A, C>): S & A & ComputedValues<C>;

declare function useStore<T extends object>(store: T): T;

declare function scheduleUpdate(callback: () => void): void;

declare function enableDevTools(store: any, name?: string): void;

declare function computed<T>(fn: () => T): {
    readonly value: T;
};

declare class HttpError extends Error {
    status: number;
    constructor(status: number, message: string);
}
type RetryConfig = {
    retries: number;
    baseDelay: number;
    maxDelay: number;
    shouldRetry?: (error: unknown, attempt: number) => boolean;
};
type HttpClientConfig = {
    baseURL?: string;
    headers?: Record<string, string>;
    timeout?: number;
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
type Validator<T> = {
    parse?: (data: unknown) => T;
    validateSync?: (data: unknown) => T;
};
type RequestConfig<T> = RequestInit & {
    schema?: Validator<T>;
    timeout?: number;
    retry?: number | RetryConfig;
};
type HttpClient = {
    get: <T>(url: string, config?: RequestConfig<T>) => Promise<T>;
    post: <T>(url: string, data?: unknown, config?: RequestConfig<T>) => Promise<T>;
    put: <T>(url: string, data?: unknown, config?: RequestConfig<T>) => Promise<T>;
    delete: <T>(url: string, config?: RequestConfig<T>) => Promise<T>;
    patch: <T>(url: string, data?: unknown, config?: RequestConfig<T>) => Promise<T>;
    request: <T>(url: string, config?: RequestConfig<T>) => Promise<T>;
};
declare function createHttpClient(config: HttpClientConfig): HttpClient;

declare function isPromise(value: any): value is Promise<any>;
declare function handlePromise(promise: Promise<any>, triggerUpdate: () => void): void;
declare function unwrapPromise(promise: Promise<any>): any;
declare function getPromiseState(promise: Promise<any>): {
    status: "pending" | "fulfilled" | "rejected";
    value: any;
    error: any;
};

export { type HttpClient, type HttpClientConfig, HttpError, type RequestConfig, type RetryConfig, type Validator, computed, createHttpClient, createState, defineModel, enableDevTools, getPromiseState, handlePromise, isPromise, scheduleUpdate, subscribe, unwrapPromise, useStore };

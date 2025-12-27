/**
 * Comprehensive Error Classification System
 * Provides detailed error types, retry strategies, and error reporting
 */

export enum ErrorType {
    // Network Errors
    NETWORK = 'network',
    TIMEOUT = 'timeout',
    OFFLINE = 'offline',

    // HTTP Errors
    BAD_REQUEST = 'bad_request',          // 400
    UNAUTHORIZED = 'unauthorized',        // 401
    FORBIDDEN = 'forbidden',              // 403
    NOT_FOUND = 'not_found',             // 404
    CONFLICT = 'conflict',                // 409
    SERVER_ERROR = 'server_error',        // 500+

    // Application Errors
    VALIDATION = 'validation',
    PARSE_ERROR = 'parse_error',
    SELECTOR_ERROR = 'selector_error',
    SCHEMA_ERROR = 'schema_error',

    // Query Errors
    CANCELLED = 'cancelled',
    UNKNOWN = 'unknown'
}

export interface ErrorMetadata {
    statusCode?: number;
    url?: string;
    method?: string;
    queryKey?: unknown[];
    timestamp: number;
    retryCount?: number;
}

export class QueryError extends Error {
    public readonly type: ErrorType;
    public readonly retryable: boolean;
    public readonly metadata: ErrorMetadata;
    public readonly originalError?: Error;

    constructor(
        message: string,
        type: ErrorType,
        metadata: Partial<ErrorMetadata> = {},
        originalError?: Error
    ) {
        super(message);
        this.name = 'QueryError';
        this.type = type;
        this.metadata = {
            timestamp: Date.now(),
            ...metadata
        };
        this.originalError = originalError;
        this.retryable = this.determineRetryability(type);

        // Maintain proper stack trace (Node.js only)
        const ErrorConstructor = Error as typeof Error & {
            captureStackTrace?: (targetObject: object, constructorOpt?: Function) => void;
        };
        if (ErrorConstructor.captureStackTrace) {
            ErrorConstructor.captureStackTrace(this, QueryError);
        }
    }

    private determineRetryability(type: ErrorType): boolean {
        // Network errors are retryable
        if ([ErrorType.NETWORK, ErrorType.TIMEOUT, ErrorType.OFFLINE].includes(type)) {
            return true;
        }

        // Some HTTP errors are retryable
        if ([ErrorType.SERVER_ERROR].includes(type)) {
            return true;
        }

        // Client errors are not retryable
        return false;
    }

    /**
     * Create QueryError from HTTP response
     */
    static fromResponse(response: Response, metadata: Partial<ErrorMetadata> = {}): QueryError {
        const statusCode = response.status;
        let type: ErrorType;

        if (statusCode === 400) type = ErrorType.BAD_REQUEST;
        else if (statusCode === 401) type = ErrorType.UNAUTHORIZED;
        else if (statusCode === 403) type = ErrorType.FORBIDDEN;
        else if (statusCode === 404) type = ErrorType.NOT_FOUND;
        else if (statusCode === 409) type = ErrorType.CONFLICT;
        else if (statusCode >= 500) type = ErrorType.SERVER_ERROR;
        else type = ErrorType.UNKNOWN;

        return new QueryError(
            `HTTP ${statusCode}: ${response.statusText}`,
            type,
            { ...metadata, statusCode, url: response.url }
        );
    }

    /**
     * Create QueryError from unknown error
     */
    static fromUnknown(error: unknown, metadata: Partial<ErrorMetadata> = {}): QueryError {
        if (error instanceof QueryError) {
            return error;
        }

        if (error instanceof Error) {
            // Network errors
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                return new QueryError(
                    'Network request failed',
                    ErrorType.NETWORK,
                    metadata,
                    error
                );
            }

            // Timeout errors
            if (error.name === 'AbortError' || error.message.includes('timeout')) {
                return new QueryError(
                    'Request timeout',
                    ErrorType.TIMEOUT,
                    metadata,
                    error
                );
            }

            // Generic error
            return new QueryError(
                error.message,
                ErrorType.UNKNOWN,
                metadata,
                error
            );
        }

        // Non-Error objects
        return new QueryError(
            String(error),
            ErrorType.UNKNOWN,
            metadata
        );
    }

    /**
     * Check if error should be retried
     */
    shouldRetry(attemptCount: number, maxRetries: number): boolean {
        if (attemptCount >= maxRetries) return false;
        return this.retryable;
    }

    /**
     * Get retry delay based on error type
     */
    getRetryDelay(attemptCount: number): number {
        // Network errors: aggressive retry
        if (this.type === ErrorType.NETWORK || this.type === ErrorType.OFFLINE) {
            return Math.min(1000 * (2 ** attemptCount), 10000);
        }

        // Server errors: slower retry
        if (this.type === ErrorType.SERVER_ERROR) {
            return Math.min(2000 * (2 ** attemptCount), 30000);
        }

        // Default exponential backoff
        return Math.min(1000 * (2 ** attemptCount), 30000);
    }

    /**
     * Serialize for logging/monitoring
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            type: this.type,
            retryable: this.retryable,
            metadata: this.metadata,
            stack: this.stack,
            originalError: this.originalError?.message
        };
    }
}

/**
 * Global error handler hook
 */
export type ErrorHandler = (error: QueryError) => void;

class ErrorReporter {
    private handlers: Set<ErrorHandler> = new Set();

    subscribe(handler: ErrorHandler): () => void {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }

    report(error: QueryError): void {
        this.handlers.forEach(handler => {
            try {
                handler(error);
            } catch (e) {
                console.error('[Quantum] Error handler threw:', e);
            }
        });
    }
}

export const errorReporter = new ErrorReporter();

/**
 * Helper to report errors globally
 */
export function reportError(error: unknown, metadata?: Partial<ErrorMetadata>): QueryError {
    const queryError = QueryError.fromUnknown(error, metadata);
    errorReporter.report(queryError);
    return queryError;
}

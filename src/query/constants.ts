// Production-ready constants for @braine/quantum-query
// Eliminates magic numbers and provides single source of truth

export const DEFAULTS = {
    // Cache & Staleness
    STALE_TIME_MS: 5 * 60 * 1000,      // 5 minutes
    CACHE_TIME_MS: 5 * 60 * 1000,      // 5 minutes
    MAX_CACHE_SIZE: 100,                // Maximum cached queries

    // Retry Logic
    RETRY_ATTEMPTS: 3,
    RETRY_BASE_DELAY_MS: 1000,          // 1 second
    RETRY_MAX_DELAY_MS: 30000,          // 30 seconds
    RETRY_JITTER_FACTOR: 0.25,          // ±25% randomization

    // Deduplication
    DEDUP_CLEANUP_DELAY_MS: 100,        // Keep resolved promises briefly
    DEDUP_MAX_AGE_MS: 60000,            // 1 minute max age for stale entries

    // Garbage Collection
    GC_CHECK_INTERVAL_MS: 30000,        // 30 seconds

    // DevTools
    DEVTOOLS_MAX_HISTORY: 50,           // Max query history entries
} as const;

export const ERROR_MESSAGES = {
    SIGNAL_CREATE_FAILED: '[Quantum] Failed to create signal for query key',
    COMPUTED_SET: '[Quantum] Cannot set a computed signal directly',
    COMPUTED_UPDATE: '[Quantum] Cannot update a computed signal directly',
    SELECTOR_ERROR: '[Quantum] Selector function threw an error',
    INFINITE_DATA_MISSING: 'Infinite query data missing',
} as const;

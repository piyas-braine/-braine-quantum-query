import { Middleware } from './types';

export const CacheMiddleware: Middleware<any> = async (ctx, next) => {
    const { method, url } = ctx.req;
    const { cache: cacheConfig } = ctx.config;

    // Only cache GET
    if (method !== 'GET' || !cacheConfig?.ttl || cacheConfig.force) {
        // Validate if method is NOT get, we might want to invalidate cache?
        // For now, simple standard cache.
        return next(ctx);
    }

    const key = `${method}:${url}`;
    const cache = ctx.cache;

    // 1. Check Cache
    if (cache.has(key)) {
        const entry = cache.get(key)!;
        if (entry.expiresAt > Date.now()) {
            // Reconstruct Response from Cache
            // We stored "data" (parsed JSON) in our previous implementation.
            // But Middleware returns 'Response'.
            // So we mock a Response.
            const blob = JSON.stringify(entry.data);
            return new Response(blob, { status: 200, statusText: 'OK (Cached)' });
        } else {
            cache.delete(key);
        }
    }

    // 2. Fetch Network
    const response = await next(ctx);

    // 3. Store in Cache (if successful)
    if (response.ok) {
        // We need to read body to cache it.
        // Response body can be read once.
        const clone = response.clone();
        const text = await clone.text();

        try {
            const data = JSON.parse(text);

            // Clone data for storage safety
            // (Wait, do we need to structuredClone here using our fix?)
            // Since we parsed from text, 'data' is a fresh object.
            // But we should store a deep copy if we want? No, JSON.parse creates fresh.
            // But we accepted that storing ref is dangerous if consumers mutate it.
            // The cache map holds it.
            // When we READ from cache (above), we might need to clone.
            // Actually, we reconstruct Response from stringified data above, which creates copy.

            cache.set(key, {
                data: data, // Storing raw data object
                timestamp: Date.now(),
                expiresAt: Date.now() + cacheConfig.ttl
            });
        } catch {
            // Not JSON? Don't cache for now or cache text.
        }
    }

    return response;
};

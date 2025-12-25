import { Middleware } from './types';

export const DedupeMiddleware: Middleware<any> = async (ctx, next) => {
    // Only dedupe GET requests (or configurable?)
    if (ctx.req.method !== 'GET') {
        return next(ctx);
    }

    // Dedupe Key
    const key = `${ctx.req.method}:${ctx.req.url}`;

    // Check flight
    if (ctx.inflight.has(key)) {
        // Wait for existing promise
        // BUT middleware returns Response. 
        // We can't share a Promise<Response> easily because Response body is a stream (consumed once).
        // Solution: We must clone the response if we share it.
        // OR: Since we return JSON usually, we dedupe the JSON parsing?
        // Wait, standard dedupe usually shares the PROMISE of the Fetch.
        // Response.clone() is needed.

        const promise = ctx.inflight.get(key) as Promise<Response>;
        const response = await promise;
        return response.clone();
    }

    // Create new promise wrapping the chain

    // Actually, if we use response.clone(), we lock the original?
    // Correct Pattern:
    // The *first* caller executes 'next'. It gets a response.
    // Subsequent callers await that same promise. 
    // All of them must receive a CLONED response so they can read body independently.

    // BUT 'next(ctx)' executes the fetch.
    const sharedPromise = next(ctx)
        .then(res => {
            // We need to return a clone to the cache/inflight map?
            // Or typically, we assume the response is text/json buffered.
            // Let's stick to simple Response cloning for now.
            return res;
        })
        .catch(err => {
            ctx.inflight.delete(key);
            throw err;
        });

    ctx.inflight.set(key, sharedPromise);

    try {
        const response = await sharedPromise;
        return response.clone();
    } finally {
        // Remove from inflight after completion? 
        // Usually we want to keep it there until it settles.
        ctx.inflight.delete(key);
    }
};

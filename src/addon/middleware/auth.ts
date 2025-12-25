import { type Middleware } from './types';
import { HttpError } from '../clientTypes'; // Reuse error class

export const AuthMiddleware: Middleware<any> = async (ctx, next) => {
    const { auth } = ctx.client.config;



    // 1. Inject Token (only if not already present)
    if (auth && auth.getToken && !ctx.req.headers.get('Authorization')) {
        const token = await auth.getToken();

        if (token) {
            // Create new headers with Authorization
            const newHeaders = new Headers(ctx.req.headers);
            newHeaders.set('Authorization', `Bearer ${token}`);

            // Create new request with auth header
            const newReq = new Request(ctx.req, {
                headers: newHeaders
            });



            // IMPORTANT: Mutate ctx.req directly (don't create new ctx object)
            // This is necessary because Retry middleware uses a closure over ctx
            ctx.req = newReq;


        }
    }

    // 2. Execute request
    const response = await next(ctx);



    // 3. Handle 401
    if (response.status === 401 && auth && auth.onTokenExpired) {
        // Refresh Logic
        // We need to lock refresh globally? 
        // In separate file scope?
        // Or handle simple retry.

        try {
            const newToken = await auth.onTokenExpired(ctx.client);
            if (newToken) {
                // Create new headers with refreshed token
                const newHeaders = new Headers(ctx.req.headers);
                newHeaders.set('Authorization', `Bearer ${newToken}`);

                // Create new request from URL (not cloning to avoid header issues)
                const newReq = new Request(ctx.req.url, {
                    method: ctx.req.method,
                    headers: newHeaders,
                    body: ctx.req.body,
                    mode: ctx.req.mode,
                    credentials: ctx.req.credentials,
                    cache: ctx.req.cache,
                    redirect: ctx.req.redirect,
                    referrer: ctx.req.referrer,
                    integrity: ctx.req.integrity
                });

                // IMPORTANT: Mutate ctx.req directly (same as initial auth injection)
                ctx.req = newReq;
                return next(ctx);
                // Wait, next here calls the NEXT middleware (Retry -> Fetch).
                // It does NOT restart the whole chain (Dedupe -> Cache).
                // Example: If 401, we want to fetch again.
                // If we call 'next' again, we skip dedupe/cache?
                // Actually, if we refresh token, we bypassed cache anyway (401).
                // So calling downstream middleware is correct.
            } else {
                auth.onAuthFailed?.();
                throw new HttpError(401, 'Authentication Failed');
            }
        } catch (err) {
            throw err;
        }
    }

    return response;
};

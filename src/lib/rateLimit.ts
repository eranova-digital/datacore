import { FastifyRequest, FastifyReply } from "fastify";
import { env } from "./env";
import { RateLimitEntry } from "../types";

// In-memory store for rate limiting
// Key: IP address, Value: RateLimitEntry
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * IP-based rate limiting middleware
 * Limits requests per IP address based on configured window and max requests
 * Adds standard rate limit headers to all responses
 */
export const rateLimitMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
    const ip = request.ip;
    const now = Date.now();
    const windowMs = env.rateLimitWindow;
    const maxRequests = env.rateLimitMaxRequests;

    // Get or create rate limit entry for this IP
    let entry = rateLimitStore.get(ip);

    if (!entry) {
        // First request from this IP
        entry = {
            count: 1,
            resetTime: now + windowMs
        };
        rateLimitStore.set(ip, entry);
    } else if (now > entry.resetTime) {
        // Window has expired - reset the counter
        entry.count = 1;
        entry.resetTime = now + windowMs;
        rateLimitStore.set(ip, entry);
    } else {
        // Increment the counter
        entry.count++;
    }

    // Calculate remaining requests and reset time
    const remaining = Math.max(0, maxRequests - entry.count);
    const resetTime = Math.ceil(entry.resetTime / 1000); // Convert to seconds for header

    // Add standard rate limit headers
    reply.header('X-RateLimit-Limit', maxRequests.toString());
    reply.header('X-RateLimit-Remaining', remaining.toString());
    reply.header('X-RateLimit-Reset', resetTime.toString());

    // Check if limit exceeded
    if (entry.count > maxRequests) {
        const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
        const requestId = (request as any).requestId || crypto.randomUUID();

        reply.header('Retry-After', retryAfter.toString());
        reply.code(429).type('application/json').send({
            message: 'Too many requests. Please try again later.',
            data: {
                error: 'Rate limit exceeded',
                retryAfter: `${retryAfter} seconds`
            },
            meta: {
                status: 429,
                timestamp: new Date().toISOString(),
                requestId: requestId
            }
        });
        return;
    }
};

/**
 * Cleanup expired rate limit entries periodically
 * Should be called periodically to prevent memory leaks
 */
export const cleanupRateLimitStore = () => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitStore.entries()) {
        if (now > entry.resetTime + env.rateLimitWindow) {
            rateLimitStore.delete(ip);
        }
    }
};

// Run cleanup every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);


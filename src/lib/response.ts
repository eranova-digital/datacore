import { FastifyReply, FastifyRequest } from "fastify";

export const response = (
    reply: FastifyReply,
    message: string,
    data?: unknown,
    status: number = 200,
    request?: FastifyRequest,
    source?: string
) => {
    const requestId = (request as any)?.requestId || crypto.randomUUID();
    const meta: any = {
        status,
        timestamp: new Date().toISOString(),
        requestId
    };

    // Add source if provided
    if (source) {
        meta.source = source;
    }

    const responsePayload = {
        message,
        data,
        meta
    };

    // Store response body for logging
    if (request) {
        (request as any).responseBody = responsePayload;
    }

    reply.code(status).type('application/json').send(responsePayload);
    return;
}
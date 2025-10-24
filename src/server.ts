import fastify from "fastify"
import AutoLoad from "@fastify/autoload"
import path from "path"
import { prisma } from "./lib/prisma"
import { logger } from "./lib/logger"
import { env } from "./lib/env"
import { rateLimitMiddleware } from "./lib/rateLimit"

const start = async () => {
    try {
        const server = fastify()

        // Initialize request logging - runs first
        server.addHook('onRequest', async (request) => {
            // Generate and attach request ID
            const requestId = crypto.randomUUID();
            (request as any).requestId = requestId;
            (request as any).startTime = Date.now();

            // Log request to database if enabled
            if (env.logRequests) {
                try {
                    // Decide whether to log request body
                    let requestBodyToLog: string | null = null;
                    if (env.logRequestBodies && request.body) {
                        const bodyStr = JSON.stringify(request.body);
                        requestBodyToLog = bodyStr.length > env.maxBodyLogSize
                            ? bodyStr.substring(0, env.maxBodyLogSize) + '... [TRUNCATED]'
                            : bodyStr;
                    }

                    await prisma.request.create({
                        data: {
                            id: requestId,
                            ip: request.ip,
                            ua: request.headers['user-agent'] || 'unknown',
                            url: request.url,
                            method: request.method,
                            requestBody: requestBodyToLog,
                            requestParams: Object.keys(request.params || {}).length > 0 ? JSON.stringify(request.params) : null,
                            requestQuery: Object.keys(request.query || {}).length > 0 ? JSON.stringify(request.query) : null,
                        }
                    });
                } catch (error) {
                    logger.error(`Failed to create request log: ${error}`);
                }
            }
        })

        // Rate limiting middleware
        server.addHook('onRequest', rateLimitMiddleware)

        // Dynamically load routes from /routes directory
        server.register(AutoLoad, {
            dir: path.join(__dirname, "routes"),
            options: {
                prefix: '',

            }
        })

        // Update request log with response data
        server.addHook('onResponse', async (request, reply) => {
            const responseTime = Date.now() - ((request as any).startTime || Date.now());
            logger.info(`${reply.statusCode} ${request.method} ${request.url} - ${responseTime}ms`);

            if (env.logRequests) {
                try {
                    const requestId = (request as any).requestId;
                    const responseBody = (request as any).responseBody;
                    const isError = reply.statusCode >= 400;

                    // Decide whether to log response body
                    let responseBodyToLog: string | null = null;
                    const shouldLogBody = env.logResponseBodies || (env.logBodiesOnErrorsOnly && isError);

                    if (shouldLogBody && responseBody) {
                        const bodyStr = JSON.stringify(responseBody);
                        responseBodyToLog = bodyStr.length > env.maxBodyLogSize
                            ? bodyStr.substring(0, env.maxBodyLogSize) + '... [TRUNCATED]'
                            : bodyStr;
                    }

                    await prisma.request.update({
                        where: { id: requestId },
                        data: {
                            responseStatus: reply.statusCode,
                            responseBody: responseBodyToLog,
                            responseTime,
                            completedAt: new Date()
                        }
                    });
                } catch (error) {
                    logger.error(`Failed to update request log: ${error}`);
                }
            }
        })

        await server.listen({ port: env.port, host: '0.0.0.0' })
        logger.info(`Server is running on port ${env.port}`)
        logger.info(`Rate limiting: ${env.rateLimitMaxRequests} requests per ${env.rateLimitWindow}ms`)
        logger.info(`Data freshness: ${env.dataFreshnessHours} hours`)
        logger.info(`Request logging: ${env.logRequests ? 'enabled' : 'disabled'}`)
    } catch (err) {
        logger.fatal(err as string)
    }
}

logger.info("Starting server...")
start()
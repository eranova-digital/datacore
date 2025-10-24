import { FastifyInstance, FastifyPluginOptions } from "fastify"
import { logger } from "../lib/logger"
import { response } from "../lib/response"
import { env } from "../lib/env"

export default async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    logger.info('Registering main route.')

    // Health check
    fastify.get('/', async (request, reply) => {
        response(reply, 'DataCore API is running', {
            version: env.version,
            endpoints: {
                v1: {
                    businessRecord: '/v1/:cui',
                    balanceSheet: '/v1/:cui/bilant/:an',
                    allBalanceSheets: '/v1/:cui/bilant',
                    completeData: '/v1/:cui/complete'
                }
            }
        }, 200, request);
        return;
    })
}

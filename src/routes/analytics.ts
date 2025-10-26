import { FastifyInstance, FastifyPluginOptions } from "fastify"
import { logger } from "../lib/logger"
import { response } from "../lib/response"
import { prisma } from "../lib/prisma"

export default async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    logger.info('Registering analytics route.')

    fastify.get('/analytics', async (request, reply) => {

        const totalRequests = await prisma.request.count();
        const totalRequestsLastHour = await prisma.request.count({
            where: {
                createdAt: {
                    gte: new Date(Date.now() - 1 * 60 * 60 * 1000),
                },
            },
        });
        const totalRequestsLastDay = await prisma.request.count({
            where: {
                createdAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                },
            },
        });
        const totalRequestsLastWeek = await prisma.request.count({
            where: {
                createdAt: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                },
            },
        });
        const totalRequestsLastMonth = await prisma.request.count({
            where: {
                createdAt: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                },
            },
        });
        const yourRequests = await prisma.request.count({
            where: {
                ip: request.ip,
            },
        });
        const totalBusinessRecords = await prisma.businessRecord.count();

        response(reply, 'DataCore API Analytics', {
            totalRequests: totalRequests,
            totalRequestsIn: {
                lastHour: totalRequestsLastHour,
                lastDay: totalRequestsLastDay,
                lastWeek: totalRequestsLastWeek,
                lastMonth: totalRequestsLastMonth,
            },
            yourRequests: yourRequests,
            cachedBusinessRecords: totalBusinessRecords,
        }, 200, request);
        return;
    })
}

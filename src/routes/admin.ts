import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify"
import { logger } from "../lib/logger"
import { response } from "../lib/response"
import { env } from "../lib/env"
import { prisma } from "../lib/prisma"

export default async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    logger.info('Registering admin route.')

    const authorize = (request: FastifyRequest, reply: FastifyReply) => {
        if (request.headers['authorization'] !== `Bearer ${env.adminToken}`) {
            response(reply, 'Unauthorized', null, 401, request);
            return;
        }
    }

    // Admin routes
    fastify.get('/admin', async (request, reply) => {
        authorize(request, reply);
        response(reply, 'You are authorized to access the admin API', {
            version: env.version,
            endpoints: {
                v1: {
                    analytics: {
                        requests: '/admin/analytics/requests?take=100&skip=0',
                        requestsByIp: '/admin/analytics/requests/:ip?take=100&skip=0',
                        businessRecords: '/admin/analytics/businessRecords?take=100&skip=0',
                        businessRecordsOverview: '/admin/analytics/businessRecords/overview',
                    },
                    security: {
                        blockedIps: '/admin/security/ips?take=100&skip=0',
                        blockIp: '/admin/security/ips/:ip/block',
                        unblockIp: '/admin/security/ips/:ip/unblock',
                    },
                }
            }
        }, 200, request);
        return;
    });

    fastify.get('/admin/analytics/requests', async (request, reply) => {
        authorize(request, reply);
        const { take, skip } = request.query as { take: number | undefined; skip: number | undefined };
        const requests = await prisma.request.findMany({
            orderBy: {
                createdAt: 'desc',
            },
            take: take ? Number(take) : 100,
            skip: skip ? Number(skip) : 0,
        });
        response(reply, 'Requests', requests, 200, request);
        return;
    });

    fastify.get('/admin/analytics/requests/:ip', async (request, reply) => {
        authorize(request, reply);
        const { ip } = request.params as { ip: string };
        if (!ip || !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
            response(reply, 'Invalid IP address', null, 400, request);
            return;
        }
        const { take, skip } = request.query as { take: number | undefined; skip: number | undefined };
        const requests = await prisma.request.findMany({
            where: { ip },
            orderBy: {
                createdAt: 'desc',
            },
            take: take ? Number(take) : 100,
            skip: skip ? Number(skip) : 0,
        });
        response(reply, 'Requests by IP', requests, 200, request);
        return;
    });

    fastify.get('/admin/analytics/businessRecords', async (request, reply) => {
        authorize(request, reply);
        const { take, skip } = request.query as { take: number | undefined; skip: number | undefined };

        const businessRecords = await prisma.businessRecord.findMany({
            orderBy: {
                createdAt: 'desc',
            },
            take: take ? Number(take) : 100,
            skip: skip ? Number(skip) : 0,
        });
        response(reply, 'Business Records', businessRecords, 200, request);
        return;
    });

    fastify.get('/admin/analytics/businessRecords/overview', async (request, reply) => {
        authorize(request, reply);
        const overview = await prisma.businessRecord.aggregate({
            _count: true,
        });
        response(reply, 'Business Records Overview', {
            total: overview._count
        }, 200, request);
        return;
    });

    fastify.get('/admin/security/ips/:ip/block', async (request, reply) => {
        authorize(request, reply);
        const { ip } = request.params as { ip: string };
        if (!ip || !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
            response(reply, 'Invalid IP address', null, 400, request);
            return;
        }
        const blockedIp = await prisma.blockedIp.findUnique({ where: { ip } });
        if (blockedIp) {
            response(reply, 'IP already blocked', null, 400, request);
            return;
        }
        await prisma.blockedIp.create({
            data: { ip },
        });
        response(reply, 'IP blocked', { ip }, 200, request);
        return;
    });

    fastify.get('/admin/security/ips/:ip/unblock', async (request, reply) => {
        authorize(request, reply);
        const { ip } = request.params as { ip: string };
        if (!ip || !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
            response(reply, 'Invalid IP address', null, 400, request);
            return;
        }
        const blockedIp = await prisma.blockedIp.findUnique({ where: { ip } });
        if (!blockedIp) {
            response(reply, 'IP not found in blocked IPs', null, 404, request);
            return;
        }
        await prisma.blockedIp.delete({ where: { id: blockedIp.id } });
        response(reply, 'IP unblocked', null, 200, request);
        return;
    });

    fastify.get('/admin/security/ips', async (request, reply) => {
        authorize(request, reply);
        const { take, skip } = request.query as { take: number | undefined; skip: number | undefined };
        const blockedIps = await prisma.blockedIp.findMany({
            orderBy: {
                createdAt: 'desc',
            },
            take: take ? Number(take) : 100,
            skip: skip ? Number(skip) : 0,
        });
        response(reply, 'Blocked IPs', {
            total: blockedIps.length,
            blockedIps,
        }, 200, request);
        return;
    });
}

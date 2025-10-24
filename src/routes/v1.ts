import { FastifyInstance, FastifyPluginOptions } from "fastify"
import { logger } from "../lib/logger"
import { response } from "../lib/response"
import {
    getBusinessRecord,
    getBalanceSheet,
    getAllBalanceSheets,
    getCompleteCompanyData,
    validateCui
} from "../lib/mirrorManager"

export default async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    logger.info('Registering v1 routes.')

    // v1 healthcheck
    fastify.get('/v1', async (request, reply) => {
        response(reply, 'Healthcheck is ok', { responseTime: Date.now() - (request as any).startTime }, 200, request);
        return;
    })

    // Get business record (general info)
    fastify.get('/v1/:cui', async (request, reply) => {
        try {
            const { cui } = request.params as { cui: string };

            if (!cui) {
                response(reply, 'CUI is required', null, 400, request);
                return;
            }

            if (!validateCui(cui)) {
                response(reply, 'Invalid CUI format', null, 400, request);
                return;
            }

            logger.info(`API request: Get business record for CUI ${cui}`);

            const { data: businessRecord, source } = await getBusinessRecord(cui);

            response(reply, 'Success', businessRecord, 200, request, source);
            return;
        } catch (error) {
            logger.error(`Error in /v1/:cui: ${error}`);
            response(reply, 'Error fetching business record', { error: (error as Error).message }, 500, request);
            return;
        }
    })

    // Get specific balance sheet by year
    fastify.get('/v1/:cui/bilant/:an', async (request, reply) => {
        try {
            const { cui, an } = request.params as { cui: string; an: string };

            if (!cui) {
                response(reply, 'CUI is required', null, 400, request);
                return;
            }

            if (!an) {
                response(reply, 'Year (an) is required', null, 400, request);
                return;
            }

            if (!validateCui(cui)) {
                response(reply, 'Invalid CUI format', null, 400, request);
                return;
            }

            const year = parseInt(an);
            if (isNaN(year) || year < 2014 || year > new Date().getFullYear()) {
                response(reply, 'Invalid year. Must be between 2014 and current year', null, 400, request);
                return;
            }

            logger.info(`API request: Get balance sheet for CUI ${cui}, year ${year}`);

            const { data: balanceSheet, source } = await getBalanceSheet(cui, year);

            // Get business record to include cui and denumire
            const { data: businessRecord } = await getBusinessRecord(cui);

            response(reply, 'Success', {
                cui: businessRecord.cui,
                denumire: businessRecord.denumire,
                balanceSheet
            }, 200, request, source);
            return;
        } catch (error) {
            logger.error(`Error in /v1/:cui/bilant/:an: ${error}`);

            if ((error as Error).message.includes('not found')) {
                response(reply, 'Balance sheet not found', { error: (error as Error).message }, 404, request);
                return;
            }

            response(reply, 'Error fetching balance sheet', { error: (error as Error).message }, 500, request);
            return;
        }
    })

    // Get all balance sheets for a CUI
    fastify.get('/v1/:cui/bilant', async (request, reply) => {
        try {
            const { cui } = request.params as { cui: string };

            if (!cui) {
                response(reply, 'CUI is required', null, 400, request);
                return;
            }

            if (!validateCui(cui)) {
                response(reply, 'Invalid CUI format', null, 400, request);
                return;
            }

            logger.info(`API request: Get all balance sheets for CUI ${cui}`);

            // Get balance sheets
            const { data: balanceSheets, source } = await getAllBalanceSheets(cui);

            // Get business record to include cui and denumire
            const { data: businessRecord } = await getBusinessRecord(cui);

            response(reply, 'Success', {
                cui: businessRecord.cui,
                denumire: businessRecord.denumire,
                count: balanceSheets.length,
                balanceSheets
            }, 200, request, source);
            return;
        } catch (error) {
            logger.error(`Error in /v1/:cui/bilant: ${error}`);
            response(reply, 'Error fetching balance sheets', { error: (error as Error).message }, 500, request);
            return;
        }
    })

    // Get complete company data (business record + all balance sheets)
    fastify.get('/v1/:cui/complete', async (request, reply) => {
        try {
            const { cui } = request.params as { cui: string };

            if (!cui) {
                response(reply, 'CUI is required', null, 400, request);
                return;
            }

            if (!validateCui(cui)) {
                response(reply, 'Invalid CUI format', null, 400, request);
                return;
            }

            logger.info(`API request: Get complete data for CUI ${cui}`);

            const { data: completeData, source } = await getCompleteCompanyData(cui);

            response(reply, 'Success', completeData, 200, request, source);
            return;
        } catch (error) {
            logger.error(`Error in /v1/:cui/complete: ${error}`);
            response(reply, 'Error fetching complete company data', { error: (error as Error).message }, 500, request);
            return;
        }
    })
}
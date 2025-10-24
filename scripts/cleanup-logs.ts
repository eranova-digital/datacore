import { prisma } from '../src/lib/prisma';
import { logger } from '../src/lib/logger';

/**
 * Cleanup old request logs from the database
 * 
 * Strategy:
 * - Delete successful requests (2xx, 3xx) older than 7 days
 * - Delete error requests (4xx, 5xx) older than 30 days
 * - This keeps error logs longer for debugging
 */

async function cleanupOldLogs() {
    try {
        logger.info('Starting request log cleanup...');

        // Delete successful requests older than 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const successResult = await prisma.request.deleteMany({
            where: {
                createdAt: {
                    lt: sevenDaysAgo
                },
                responseStatus: {
                    gte: 200,
                    lt: 400
                }
            }
        });

        logger.info(`Deleted ${successResult.count} successful requests older than 7 days`);

        // Delete error requests older than 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const errorResult = await prisma.request.deleteMany({
            where: {
                createdAt: {
                    lt: thirtyDaysAgo
                },
                responseStatus: {
                    gte: 400
                }
            }
        });

        logger.info(`Deleted ${errorResult.count} error requests older than 30 days`);

        // Get current stats
        const totalRemaining = await prisma.request.count();
        logger.info(`Total requests remaining in database: ${totalRemaining}`);

        logger.info('Request log cleanup completed successfully');
    } catch (error) {
        logger.error(`Error during cleanup: ${error}`);
        throw error;
    }
}

// Run the cleanup
cleanupOldLogs()
    .catch((error) => {
        console.error('Cleanup failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });


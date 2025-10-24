import { env } from "../env";
import { logger } from "../logger";

/**
 * Request bundler for ANAF API
 * Collects multiple CUI requests and bundles them into single requests
 * Respects ANAF rate limit of 1 request per second
 */

interface GeneralInfoBundleItem {
    cui: number;
    data: string;
    resolve: (value: any) => void;
    reject: (reason: Error) => void;
}

class AnafRequestBundler {
    private generalInfoQueue: GeneralInfoBundleItem[] = [];
    private generalInfoTimer: NodeJS.Timeout | null = null;
    private lastRequestTime: number = 0;
    private requestQueue: (() => Promise<void>)[] = [];
    private isProcessingQueue: boolean = false;

    /**
     * Add a general info request to the bundle queue
     */
    async addGeneralInfoRequest(cui: number, data: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.generalInfoQueue.push({ cui, data, resolve, reject });

            // Set timer to flush the queue after wait time
            if (!this.generalInfoTimer) {
                this.generalInfoTimer = setTimeout(() => {
                    this.flushGeneralInfoQueue();
                }, env.anafBundleWaitMs);
            }

            // If queue is full, flush immediately
            if (this.generalInfoQueue.length >= env.anafBundleMaxSize) {
                if (this.generalInfoTimer) {
                    clearTimeout(this.generalInfoTimer);
                    this.generalInfoTimer = null;
                }
                this.flushGeneralInfoQueue();
            }
        });
    }

    /**
     * Flush the general info queue and send bundled request
     */
    private async flushGeneralInfoQueue() {
        if (this.generalInfoQueue.length === 0) return;

        // Take all items from queue
        const items = [...this.generalInfoQueue];
        this.generalInfoQueue = [];
        this.generalInfoTimer = null;

        // Add to request queue to respect rate limiting
        this.requestQueue.push(async () => {
            await this.sendGeneralInfoBundledRequest(items);
        });

        // Process queue if not already processing
        if (!this.isProcessingQueue) {
            this.processRequestQueue();
        }
    }

    /**
     * Process the request queue with rate limiting
     */
    private async processRequestQueue() {
        if (this.isProcessingQueue) return;
        this.isProcessingQueue = true;

        while (this.requestQueue.length > 0) {
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;

            // Wait if needed to respect rate limit
            if (timeSinceLastRequest < env.anafRateLimitMs) {
                const waitTime = env.anafRateLimitMs - timeSinceLastRequest;
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            const request = this.requestQueue.shift();
            if (request) {
                this.lastRequestTime = Date.now();
                try {
                    await request();
                } catch (error) {
                    logger.error(`Error processing bundled request: ${error}`);
                }
            }
        }

        this.isProcessingQueue = false;
    }

    /**
     * Normalize CUI for comparison (remove leading zeros, trim whitespace)
     */
    private normalizeCui(cui: string | number): string {
        return parseInt(cui.toString().trim(), 10).toString();
    }

    /**
     * Send bundled general info request to ANAF API
     */
    private async sendGeneralInfoBundledRequest(items: GeneralInfoBundleItem[]) {
        try {
            logger.info(`Sending bundled ANAF general info request with ${items.length} CUIs`);

            const requestBody = items.map(item => ({
                cui: item.cui,
                data: item.data
            }));

            const response = await fetch(env.anafGeneralInfoUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`ANAF API returned status ${response.status}`);
            }

            const data = await response.json();

            logger.debug(`ANAF Response: ${JSON.stringify(data)}`);

            // Normalize CUIs for comparison
            // Build map with normalized CUI keys
            const foundMap = new Map();
            if (data.found) {
                for (const record of data.found) {
                    const normalizedCui = this.normalizeCui(record.date_generale.cui);
                    foundMap.set(normalizedCui, record);
                }
            }

            // Build set with normalized CUI keys
            const notFoundSet = new Set();
            if (data.notFound) {
                for (const cui of data.notFound) {
                    const normalizedCui = this.normalizeCui(cui);
                    notFoundSet.add(normalizedCui);
                }
            }

            // Resolve promises based on response
            for (const item of items) {
                const normalizedCui = this.normalizeCui(item.cui);

                if (foundMap.has(normalizedCui)) {
                    logger.debug(`Found CUI ${item.cui} (normalized: ${normalizedCui})`);
                    item.resolve(foundMap.get(normalizedCui));
                } else if (notFoundSet.has(normalizedCui)) {
                    logger.debug(`CUI ${item.cui} (normalized: ${normalizedCui}) not found in ANAF`);
                    item.reject(new Error(`CUI ${item.cui} not found`));
                } else {
                    logger.error(`CUI ${item.cui} (normalized: ${normalizedCui}) not in response. Available CUIs: ${Array.from(foundMap.keys()).join(', ')}`);
                    item.reject(new Error(`CUI ${item.cui} not in response`));
                }
            }

            logger.info(`Successfully processed bundled request: ${data.found?.length || 0} found, ${data.notFound?.length || 0} not found`);
        } catch (error) {
            logger.error(`Error in bundled ANAF request: ${error}`);
            // Reject all promises
            for (const item of items) {
                item.reject(error as Error);
            }
        }
    }
}

// Singleton instance
export const anafBundler = new AnafRequestBundler();


import dotenv from "dotenv"

// Load environment variables from .env file
dotenv.config()

export const env = {
    version: process.env.VERSION || '1.0.0',
    host: process.env.HOST || 'localhost',
    isDocker: process.env.IS_DOCKER ? process.env.IS_DOCKER === 'true' : false,
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
    authorName: process.env.AUTHOR_NAME || 'eranova',
    logRequests: process.env.LOG_REQUESTS ? process.env.LOG_REQUESTS === 'true' : process.env.NODE_ENV === 'development',

    // Request logging configuration
    logRequestBodies: process.env.LOG_REQUEST_BODIES ? process.env.LOG_REQUEST_BODIES === 'true' : false, // Only in development
    logResponseBodies: process.env.LOG_RESPONSE_BODIES ? process.env.LOG_RESPONSE_BODIES === 'true' : false, // Only in development
    logBodiesOnErrorsOnly: process.env.LOG_BODIES_ON_ERRORS_ONLY ? process.env.LOG_BODIES_ON_ERRORS_ONLY === 'true' : true, // Log bodies only for errors (4xx, 5xx)
    maxBodyLogSize: process.env.MAX_BODY_LOG_SIZE ? parseInt(process.env.MAX_BODY_LOG_SIZE) : 5000, // Max 5KB body size to log

    logToConsole: process.env.LOG_TO_CONSOLE ? process.env.LOG_TO_CONSOLE === 'true' : process.env.NODE_ENV === 'development',

    // ANAF API Configuration
    anafGeneralInfoUrl: process.env.ANAF_GENERAL_INFO_URL || 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva',
    anafBalanceSheetUrl: process.env.ANAF_BALANCE_SHEET_URL || 'https://webservicesp.anaf.ro/bilant',

    // Rate Limiting Configuration
    rateLimitWindow: process.env.RATE_LIMIT_WINDOW ? parseInt(process.env.RATE_LIMIT_WINDOW) : 60000, // 1 minute default
    rateLimitMaxRequests: process.env.RATE_LIMIT_MAX_REQUESTS ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) : 100, // 100 requests per minute default

    // ANAF Rate Limiting (1 request per second)
    anafRateLimitMs: 1000, // Fixed at 1 second as per ANAF rules

    // Request bundling configuration
    anafBundleMaxSize: 100, // Max 100 CUIs per request as per ANAF rules
    anafBundleWaitMs: process.env.ANAF_BUNDLE_WAIT_MS ? parseInt(process.env.ANAF_BUNDLE_WAIT_MS) : 100, // Wait 100ms to collect requests

    // Data freshness (how old data can be before refetching)
    dataFreshnessHours: process.env.DATA_FRESHNESS_HOURS ? parseInt(process.env.DATA_FRESHNESS_HOURS) : 24, // 24 hours default

    // Admin token
    adminToken: process.env.ADMIN_TOKEN || '',
}
# DataCore API

A high-performance REST API service for accessing Romanian business and financial data from ANAF (Agenția Națională de Administrare Fiscală - Romanian National Agency for Fiscal Administration).

**Author:** [eranova](https://eranova.ro)  
**Version:** 1.0.0

## Overview

DataCore provides a unified API to access Romanian business records and financial statements (balance sheets). It integrates with ANAF's public APIs, implements intelligent caching, request bundling, and rate limiting to provide fast, reliable access to company data.

### Key Features

- 🚀 **High Performance**: Built on Fastify for maximum throughput
- 💾 **Smart Caching**: Local SQLite database caches data to minimize API calls
- 🔄 **Request Bundling**: Automatically bundles concurrent requests to optimize ANAF API usage
- 🛡️ **Rate Limiting**: Protects both your API and ANAF services
- 📊 **Comprehensive Logging**: Track all requests with configurable logging levels
- 📝 **TypeScript**: Full type safety and excellent developer experience
- ✅ **Data Validation**: CUI validation and data integrity checks

## Architecture

The service acts as an intelligent proxy between clients and ANAF APIs:

```
Client → DataCore API → [Cache Check] → ANAF APIs
                              ↓
                         SQLite Database
```

**Components:**
- **Fastify Server**: High-performance HTTP server
- **Prisma ORM**: Type-safe database access with SQLite
- **ANAF Integrators**: Handles communication with ANAF APIs
- **Mirror Manager**: Manages data freshness and cache strategy
- **Bundler**: Optimizes multiple requests into batched ANAF calls

## Data Models

### Business Record
General company information including:
- Company identification (CUI, name, registration number)
- Contact information (phone, addresses)
- Legal information (legal form, registration status)
- VAT information (status, periods, split VAT, VAT on collection)
- CAEN code (business activity classification)

### Balance Sheet
Financial statements containing accounting indicators organized by year (2014-present).

## API Endpoints

All endpoints are prefixed with `/v1`.

### Health Check
```http
GET /v1
```
Returns API health status.

### Get Business Record
```http
GET /v1/:cui
```
Retrieve general business information for a company.

**Parameters:**
- `cui` (path): Company Unique Identifier (CUI)

**Example:**
```bash
curl http://localhost:3000/v1/12345678
```

### Get Balance Sheet by Year
```http
GET /v1/:cui/bilant/:an
```
Retrieve balance sheet for a specific year.

**Parameters:**
- `cui` (path): Company Unique Identifier
- `an` (path): Year (2014 to current year)

**Example:**
```bash
curl http://localhost:3000/v1/12345678/bilant/2023
```

### Get All Balance Sheets
```http
GET /v1/:cui/bilant
```
Retrieve all available balance sheets for a company.

**Example:**
```bash
curl http://localhost:3000/v1/12345678/bilant
```

### Get Complete Company Data
```http
GET /v1/:cui/complete
```
Retrieve both business record and all balance sheets in a single request.

**Example:**
```bash
curl http://localhost:3000/v1/12345678/complete
```

## Response Format

All responses follow this structure:

```json
{
  "message": "Success",
  "data": { ... },
  "source": "cache|anaf",
  "responseTime": 123
}
```

**Fields:**
- `message`: Human-readable status message
- `data`: Response payload
- `source`: Indicates if data came from cache or ANAF API
- `responseTime`: Request processing time in milliseconds

## Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd datacore
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**

Create a `.env` file in the project root:

```env
# Server Configuration
PORT=3000
VERSION=1.0.0
AUTHOR_NAME=eranova
NODE_ENV=development

# Database
DATABASE_URL="file:./prisma/dev.db"

# Request Logging
LOG_REQUESTS=true
LOG_REQUEST_BODIES=false
LOG_RESPONSE_BODIES=false
LOG_BODIES_ON_ERRORS_ONLY=true
MAX_BODY_LOG_SIZE=5000
LOG_TO_CONSOLE=true

# ANAF API URLs (use defaults or override)
ANAF_GENERAL_INFO_URL=https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva
ANAF_BALANCE_SHEET_URL=https://webservicesp.anaf.ro/bilant

# Rate Limiting
RATE_LIMIT_WINDOW=60000        # 1 minute in ms
RATE_LIMIT_MAX_REQUESTS=100    # 100 requests per window

# Request Bundling
ANAF_BUNDLE_WAIT_MS=100        # Wait 100ms to collect requests

# Data Freshness
DATA_FRESHNESS_HOURS=24        # Refetch data older than 24 hours
```

4. **Initialize the database**
```bash
npx prisma generate
npx prisma migrate dev
```

5. **Build the project**
```bash
npm run build
```

6. **Start the server**

Development mode (with hot reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## Development

### Project Structure

```
├── src/
│   ├── generated/prisma/      # Prisma client (auto-generated)
│   ├── lib/
│   │   ├── integrators/       # ANAF API integrators
│   │   │   ├── anafGeneralInfo.ts
│   │   │   ├── anafBalanceSheet.ts
│   │   │   └── anafBundler.ts
│   │   ├── env.ts             # Environment configuration
│   │   ├── logger.ts          # Logging utility
│   │   ├── mirrorManager.ts   # Cache management
│   │   ├── prisma.ts          # Prisma client setup
│   │   ├── rateLimit.ts       # Rate limiting middleware
│   │   └── response.ts        # Response formatting
│   ├── routes/
│   │   ├── main.ts            # Main route
│   │   └── v1.ts              # API v1 routes
│   ├── types/
│   │   └── index.ts           # TypeScript type definitions
│   └── server.ts              # Server entry point
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── dev.db                 # SQLite database
├── out/                       # Compiled JavaScript output
├── scripts/
│   └── cleanup-logs.ts        # Log cleanup utility
├── package.json
└── tsconfig.json
```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run production server
- `npm run cleanup:logs` - Clean old request logs from database

### Database Management

**View database:**
```bash
npx prisma studio
```

**Reset database:**
```bash
npx prisma migrate reset
```

**Update schema:**
1. Edit `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name <migration-name>`
3. Run `npx prisma generate`

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `VERSION` | API version | `1.0.0` |
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | Database connection string | `file:./prisma/dev.db` |
| `LOG_REQUESTS` | Enable request logging | `true` in dev |
| `LOG_REQUEST_BODIES` | Log request bodies | `false` |
| `LOG_RESPONSE_BODIES` | Log response bodies | `false` |
| `LOG_BODIES_ON_ERRORS_ONLY` | Log bodies only on errors | `true` |
| `MAX_BODY_LOG_SIZE` | Max body size to log (bytes) | `5000` |
| `LOG_TO_CONSOLE` | Enable console logging | `true` in dev |
| `RATE_LIMIT_WINDOW` | Rate limit window (ms) | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |
| `ANAF_BUNDLE_WAIT_MS` | Request bundling delay (ms) | `100` |
| `DATA_FRESHNESS_HOURS` | Cache validity period (hours) | `24` |

### Rate Limiting

DataCore implements two layers of rate limiting:

1. **Client Rate Limiting**: Protects your API from abuse (configurable)
2. **ANAF Rate Limiting**: Respects ANAF's 1 request/second limit (fixed)

### Request Bundling

When multiple clients request data simultaneously, the bundler:
- Waits `ANAF_BUNDLE_WAIT_MS` to collect similar requests
- Groups up to 100 CUIs per ANAF API call
- Distributes responses to all waiting clients

This significantly reduces API calls and improves performance.

### Data Freshness

Cached data older than `DATA_FRESHNESS_HOURS` is automatically refetched from ANAF.
The `source` field in responses indicates whether data came from cache or ANAF.

## Logging

### Request Logging

All requests are logged to the database (`Request` model) with:
- Request details (IP, user agent, URL, method)
- Request parameters, query strings, and bodies (configurable)
- Response status, body (configurable), and timing
- Timestamps (created, completed)

### Console Logging

Structured logs for:
- Server startup and configuration
- API requests and responses
- ANAF API calls
- Errors and warnings
- Database operations

### Log Cleanup

Remove old logs to manage database size:
```bash
npm run cleanup:logs
```

## Error Handling

The API returns standard HTTP status codes:

- `200` - Success
- `400` - Bad Request (invalid CUI, invalid year, etc.)
- `404` - Not Found (balance sheet not available)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

Error responses include descriptive messages:

```json
{
  "message": "Invalid CUI format",
  "data": null,
  "responseTime": 5
}
```

## CUI Validation

CUI (Company Unique Identifier) validation ensures:
- Only numeric characters
- Length between 2-10 digits
- Valid format per Romanian standards

## ANAF API Integration

DataCore integrates with two ANAF APIs:

### 1. General Information API
- URL: `https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva`
- Provides: Company registration data, VAT status, addresses
- Rate limit: 1 request/second
- Max batch size: 100 CUIs

### 2. Balance Sheet API  
- URL: `https://webservicesp.anaf.ro/bilant`
- Provides: Financial statements with accounting indicators
- Rate limit: 1 request/second
- Years: 2014 to present

## Production Deployment

### Recommendations

1. **Use PostgreSQL or MySQL** instead of SQLite for production
   - Update `DATABASE_URL` in `.env`
   - Update `provider` in `prisma/schema.prisma`
   - Run migrations

2. **Enable HTTPS** with reverse proxy (nginx, Caddy)

3. **Set appropriate rate limits** based on your usage

4. **Monitor logs** and database size

5. **Use process manager** (PM2, systemd) for auto-restart

6. **Set production environment**
   ```env
   NODE_ENV=production
   LOG_TO_CONSOLE=false
   LOG_REQUEST_BODIES=false
   LOG_RESPONSE_BODIES=false
   ```

### Example PM2 Configuration

```json
{
  "apps": [{
    "name": "datacore",
    "script": "./out/server.js",
    "instances": 4,
    "exec_mode": "cluster",
    "env": {
      "NODE_ENV": "production"
    }
  }]
}
```

## Performance

### Optimizations

- **Fastify**: Extremely fast HTTP framework
- **SQLite**: Fast local caching (upgrade for production)
- **Request Bundling**: Reduces ANAF API calls by up to 100x
- **Data Caching**: Serves most requests from local database
- **Connection Pooling**: Efficient database connections

### Benchmarks

With caching (typical scenario):
- Response time: ~5-20ms
- Throughput: Thousands of requests/second

Without caching (ANAF API calls):
- Response time: ~200-500ms (ANAF API latency)
- Throughput: Limited by ANAF rate limits

## License

Copyright © 2024 eranova. All rights reserved.

## Support

For issues, questions, or contributions:
- Email: contact@eranova.ro
- Website: https://eranova.ro

## Acknowledgments

Data provided by ANAF (Agenția Națională de Administrare Fiscală) through their public APIs.


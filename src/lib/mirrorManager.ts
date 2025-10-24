import { BusinessRecordDTO, BalanceSheetDTO } from "../types";
import { logger } from "./logger";
import { env } from "./env";
import {
    getBusinessRecordFromDatabase,
    fetchBusinessRecordFromAnaf,
    saveBusinessRecordToDatabase,
    updateDenumireCaen
} from "./integrators/anafGeneralInfo";
import {
    getBalanceSheetFromDatabase,
    fetchBalanceSheetFromAnaf,
    saveBalanceSheetToDatabase,
    getAllBalanceSheetsForCui,
    fetchMissingBalanceSheets,
    areAllIndicatorsZero
} from "./integrators/anafBalanceSheet";

/**
 * Mirror Manager
 * Handles data synchronization between ANAF APIs and local database
 * Implements the "Mirror Mat" logic from the architecture diagram
 */

/**
 * Check if data is stale based on configured freshness hours
 */
function isDataStale(lastUpdated: Date): boolean {
    const now = new Date();
    const hoursDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
    return hoursDiff > env.dataFreshnessHours;
}

/**
 * Get current date in YYYY-MM-DD format for ANAF queries
 */
function getCurrentDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Validate CUI format
 * CUI should be a numeric string
 */
export function validateCui(cui: string): boolean {
    // Remove RO prefix if present
    const cleanCui = cui.replace(/^RO/i, '');

    // Check if it's numeric
    return /^\d+$/.test(cleanCui);
}

/**
 * Clean CUI - remove RO prefix and ensure numeric
 */
export function cleanCui(cui: string): string {
    return cui.replace(/^RO/i, '');
}

/**
 * Get business record - checks database first, fetches from ANAF if not found or stale
 * Also fetches balance sheets to enrich with denumireCaen
 */
export async function getBusinessRecord(cui: string): Promise<{ data: BusinessRecordDTO; source: string }> {
    logger.info(`Mirror Manager: Getting business record for CUI ${cui}`);

    // Validate CUI
    if (!validateCui(cui)) {
        throw new Error(`Invalid CUI format: ${cui}`);
    }

    const cleanedCui = cleanCui(cui);

    // Check database first
    const dbRecord = await getBusinessRecordFromDatabase(cleanedCui);

    if (dbRecord) {
        logger.info(`Found business record for CUI ${cleanedCui} in database`);

        // Check if data is stale (we need to get the actual record with lastUpdated)
        const fullRecord = await import("./prisma").then(m =>
            m.prisma.businessRecord.findUnique({ where: { cui: cleanedCui } })
        );

        if (fullRecord && !isDataStale(fullRecord.lastUpdated)) {
            logger.info(`Business record for CUI ${cleanedCui} is fresh, using cached data`);

            // If denumireCaen is missing, try to get it from balance sheets
            if (!dbRecord.denumireCaen) {
                logger.info(`Business record missing denumireCaen, fetching from balance sheets`);
                await enrichBusinessRecordWithDenumireCaen(cleanedCui);
                // Refetch the record with updated denumireCaen
                const updatedRecord = await getBusinessRecordFromDatabase(cleanedCui);
                return { data: updatedRecord || dbRecord, source: env.authorName };
            }

            return { data: dbRecord, source: env.authorName };
        }

        logger.info(`Business record for CUI ${cleanedCui} is stale, fetching fresh data`);
    } else {
        logger.info(`Business record for CUI ${cleanedCui} not found in database, fetching from ANAF`);
    }

    // Fetch from ANAF
    const currentDate = getCurrentDate();
    const anafRecord = await fetchBusinessRecordFromAnaf(parseInt(cleanedCui), currentDate);

    // Save to database
    await saveBusinessRecordToDatabase(anafRecord);

    // Enrich with denumireCaen from balance sheets
    await enrichBusinessRecordWithDenumireCaen(cleanedCui);

    // Refetch to get the enriched record
    const enrichedRecord = await getBusinessRecordFromDatabase(cleanedCui);

    // Determine if this is new or updated
    const source = dbRecord ? 'ANAF (updated)' : 'ANAF (new)';

    return { data: enrichedRecord || anafRecord, source };
}

/**
 * Enrich business record with denumireCaen from balance sheets
 */
async function enrichBusinessRecordWithDenumireCaen(cui: string): Promise<void> {
    try {
        // Try to fetch the most recent balance sheet to get denCaen
        const currentYear = new Date().getFullYear();
        for (let year = currentYear; year >= currentYear - 5; year--) {
            try {
                const { dto, denCaen } = await fetchBalanceSheetFromAnaf(cui, year);
                if (denCaen) {
                    logger.info(`Enriching business record for CUI ${cui} with denumireCaen from year ${year}: ${denCaen}`);
                    await updateDenumireCaen(cui, denCaen);

                    // Save the balance sheet if it's not all zeros
                    if (!areAllIndicatorsZero(dto.indicators)) {
                        await saveBalanceSheetToDatabase(cui, dto);
                    }
                    break;
                }
            } catch (error) {
                // Continue to next year if not found
                continue;
            }
        }
    } catch (error) {
        logger.warn(`Could not enrich business record with denumireCaen for CUI ${cui}: ${error}`);
        // Don't throw - this is non-critical enrichment
    }
}

/**
 * Get balance sheet - checks database first, fetches from ANAF if not found or stale
 */
export async function getBalanceSheet(cui: string, an: number): Promise<{ data: BalanceSheetDTO; source: string }> {
    logger.info(`Mirror Manager: Getting balance sheet for CUI ${cui}, year ${an}`);

    // Validate CUI
    if (!validateCui(cui)) {
        throw new Error(`Invalid CUI format: ${cui}`);
    }

    const cleanedCui = cleanCui(cui);

    // Check database first
    const dbBalanceSheet = await getBalanceSheetFromDatabase(cleanedCui, an);

    if (dbBalanceSheet) {
        logger.info(`Found balance sheet for CUI ${cleanedCui}, year ${an} in database`);

        // Check if data is stale
        const fullRecord = await import("./prisma").then(m =>
            m.prisma.balanceSheet.findUnique({
                where: {
                    cui_an: { cui: cleanedCui, an }
                }
            })
        );

        if (fullRecord && !isDataStale(fullRecord.lastUpdated)) {
            logger.info(`Balance sheet for CUI ${cleanedCui}, year ${an} is fresh, using cached data`);
            return { data: dbBalanceSheet, source: env.authorName };
        }

        logger.info(`Balance sheet for CUI ${cleanedCui}, year ${an} is stale, fetching fresh data`);
    } else {
        logger.info(`Balance sheet for CUI ${cleanedCui}, year ${an} not found in database, fetching from ANAF`);
    }

    // Fetch from ANAF
    const { dto, denCaen } = await fetchBalanceSheetFromAnaf(cleanedCui, an);

    // Save to database
    await saveBalanceSheetToDatabase(cleanedCui, dto);

    // Update business record with denCaen if available
    if (denCaen) {
        try {
            await updateDenumireCaen(cleanedCui, denCaen);
        } catch (error) {
            logger.warn(`Could not update denumireCaen: ${error}`);
        }
    }

    // Determine if this is new or updated
    const source = dbBalanceSheet ? 'ANAF (updated)' : 'ANAF (new)';

    return { data: dto, source };
}

/**
 * Get all balance sheets for a CUI
 * Automatically fetches missing years from registration year to current year
 * Filters out sheets where all indicators are zero
 */
export async function getAllBalanceSheets(cui: string): Promise<{ data: BalanceSheetDTO[]; source: string }> {
    logger.info(`Mirror Manager: Getting all balance sheets for CUI ${cui}`);

    // Validate CUI
    if (!validateCui(cui)) {
        throw new Error(`Invalid CUI format: ${cui}`);
    }

    const cleanedCui = cleanCui(cui);

    // First, get the business record to find registration date
    let businessRecord: BusinessRecordDTO;
    try {
        const result = await getBusinessRecord(cui);
        businessRecord = result.data;
    } catch (error) {
        logger.warn(`Could not get business record for CUI ${cui}, using 2014 as start year`);
        businessRecord = { dataInregistrare: '2014-01-01' } as BusinessRecordDTO;
    }

    const currentYear = new Date().getFullYear();
    // Ensure startYear is at least 2014 (ANAF dataset minimum)
    const registrationYear = businessRecord.dataInregistrare ? parseInt(businessRecord.dataInregistrare.split('-')[0]) : 2014;
    const startYear = Math.max(registrationYear, 2014);

    // Get all cached balance sheets from database
    let dbBalanceSheets = await getAllBalanceSheetsForCui(cleanedCui);

    // Filter out any with all indicators = 0 (shouldn't be there, but just in case)
    dbBalanceSheets = dbBalanceSheets.filter(sheet => !areAllIndicatorsZero(sheet.indicators));

    // Check which years we have
    const existingYears = new Set(dbBalanceSheets.map(sheet => sheet.an));

    // Determine if we need to fetch missing years
    const allYears = Array.from({ length: currentYear - startYear + 1 }, (_, i) => startYear + i);
    const missingYears = allYears.filter(year => !existingYears.has(year));

    if (missingYears.length === 0) {
        logger.info(`Found all ${dbBalanceSheets.length} balance sheets for CUI ${cleanedCui} in database`);
        return { data: dbBalanceSheets, source: env.authorName };
    }

    logger.info(`Found ${dbBalanceSheets.length} cached balance sheets, fetching ${missingYears.length} missing years`);

    // Fetch missing years
    const { balanceSheets: newBalanceSheets, denCaen } = await fetchMissingBalanceSheets(
        cleanedCui,
        existingYears,
        startYear,
        currentYear
    );

    // Combine and sort by year (descending)
    const allBalanceSheets = [...dbBalanceSheets, ...newBalanceSheets].sort((a, b) => b.an - a.an);

    // Enrich business record with denumireCaen from balance sheets
    if (denCaen) {
        try {
            await updateDenumireCaen(cleanedCui, denCaen);
            logger.info(`Updated business record with denumireCaen: ${denCaen}`);
        } catch (error) {
            logger.warn(`Could not update denumireCaen: ${error}`);
        }
    }

    logger.info(`Returning ${allBalanceSheets.length} total balance sheets for CUI ${cleanedCui}`);

    // Determine source: if we had to fetch new data, it's from ANAF (new), otherwise eranova
    const source = newBalanceSheets.length > 0 ? 'ANAF (new)' : env.authorName;

    return { data: allBalanceSheets, source };
}

/**
 * Get complete company data (business record + all balance sheets)
 */
export async function getCompleteCompanyData(cui: string): Promise<{
    data: {
        businessRecord: BusinessRecordDTO;
        balanceSheets: BalanceSheetDTO[];
    };
    source: string;
}> {
    logger.info(`Mirror Manager: Getting complete company data for CUI ${cui}`);

    const [businessRecordResult, balanceSheetsResult] = await Promise.all([
        getBusinessRecord(cui),
        getAllBalanceSheets(cui)
    ]);

    // Determine source: if any data came from ANAF, use that as source
    let source = env.authorName;
    if (businessRecordResult.source !== env.authorName || balanceSheetsResult.source !== env.authorName) {
        // If either is from ANAF, prioritize showing ANAF source
        if (businessRecordResult.source.includes('new') || balanceSheetsResult.source.includes('new')) {
            source = 'ANAF (new)';
        } else {
            source = 'ANAF (updated)';
        }
    }

    return {
        data: {
            businessRecord: businessRecordResult.data,
            balanceSheets: balanceSheetsResult.data
        },
        source
    };
}

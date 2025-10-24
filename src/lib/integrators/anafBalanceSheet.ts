import { AnafBalanceSheetResponse, BalanceSheetDTO } from "../../types";
import { logger } from "../logger";
import { env } from "../env";
import { prisma } from "../prisma";
import { mapIndicators } from "../indicatorMapping";

/**
 * ANAF Balance Sheet API Integrator
 * Handles fetching and storing balance sheet data from ANAF
 */

/**
 * Fetch balance sheet from ANAF API
 * Note: Balance sheet API uses GET, not bundling needed
 * Returns denCaen separately for business record enrichment
 */
export async function fetchBalanceSheetFromAnaf(cui: string, an: number): Promise<{ dto: BalanceSheetDTO; denCaen?: string }> {
    try {
        logger.info(`Fetching balance sheet for CUI ${cui}, year ${an} from ANAF`);

        const url = `${env.anafBalanceSheetUrl}?an=${an}&cui=${cui}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Balance sheet not found for CUI ${cui}, year ${an}`);
            }
            throw new Error(`ANAF API returned status ${response.status}`);
        }

        const data: AnafBalanceSheetResponse = await response.json();

        // Map indicators to named fields
        const indicators = mapIndicators(data.i);

        const dto: BalanceSheetDTO = {
            an: data.an,
            indicators
        };

        logger.info(`Successfully fetched balance sheet for CUI ${cui}, year ${an}`);
        return { dto, denCaen: data.den_caen };
    } catch (error) {
        logger.error(`Error fetching balance sheet for CUI ${cui}, year ${an}: ${error}`);
        throw error;
    }
}

/**
 * Save balance sheet to database
 */
export async function saveBalanceSheetToDatabase(cui: string, dto: BalanceSheetDTO): Promise<void> {
    try {
        await prisma.balanceSheet.upsert({
            where: {
                cui_an: {
                    cui,
                    an: dto.an
                }
            },
            update: {
                indicators: JSON.stringify(dto.indicators)
            },
            create: {
                cui,
                an: dto.an,
                indicators: JSON.stringify(dto.indicators)
            }
        });

        logger.info(`Successfully saved balance sheet for CUI ${cui}, year ${dto.an} to database`);
    } catch (error) {
        logger.error(`Error saving balance sheet for CUI ${cui}, year ${dto.an}: ${error}`);
        throw error;
    }
}

/**
 * Get balance sheet from database
 */
export async function getBalanceSheetFromDatabase(cui: string, an: number): Promise<BalanceSheetDTO | null> {
    try {
        const balanceSheet = await prisma.balanceSheet.findUnique({
            where: {
                cui_an: {
                    cui,
                    an
                }
            }
        });

        if (!balanceSheet) return null;

        return {
            an: balanceSheet.an,
            indicators: JSON.parse(balanceSheet.indicators)
        };
    } catch (error) {
        logger.error(`Error getting balance sheet for CUI ${cui}, year ${an}: ${error}`);
        throw error;
    }
}

/**
 * Get all balance sheets for a CUI from database
 * Filters out sheets where all indicators are zero
 */
export async function getAllBalanceSheetsForCui(cui: string): Promise<BalanceSheetDTO[]> {
    try {
        const balanceSheets = await prisma.balanceSheet.findMany({
            where: { cui },
            orderBy: {
                an: 'desc'
            }
        });

        const dtos = balanceSheets.map(bs => ({
            an: bs.an,
            indicators: JSON.parse(bs.indicators)
        }));

        // Filter out sheets where all indicators are zero
        return dtos.filter(dto => !areAllIndicatorsZero(dto.indicators));
    } catch (error) {
        logger.error(`Error getting balance sheets for CUI ${cui}: ${error}`);
        throw error;
    }
}

/**
 * Check if all indicators in a balance sheet are zero
 */
export function areAllIndicatorsZero(indicators: { [key: string]: number }): boolean {
    return Object.values(indicators).every(val => val === 0);
}

/**
 * Fetch all balance sheets from registration year (minimum 2014) to current year
 * Stops iteration when encountering a sheet where all indicators are zero,
 * BUT only after finding at least one valid sheet (to handle cases where
 * recent years aren't filed yet but older years have data)
 * Returns denCaen from the most recent sheet for business record enrichment
 */
export async function fetchAllBalanceSheets(cui: string, dataInregistrare?: string): Promise<{ balanceSheets: BalanceSheetDTO[]; denCaen?: string }> {
    try {
        const currentYear = new Date().getFullYear();
        // Ensure startYear is at least 2014 (ANAF dataset minimum)
        const registrationYear = dataInregistrare ? parseInt(dataInregistrare.split('-')[0]) : 2014;
        const startYear = Math.max(registrationYear, 2014);

        logger.info(`Fetching balance sheets for CUI ${cui} from ${startYear} to ${currentYear}`);

        const balanceSheets: BalanceSheetDTO[] = [];
        let latestDenCaen: string | undefined;

        // Iterate from current year backwards to registration year
        for (let year = currentYear; year >= startYear; year--) {
            try {
                const { dto, denCaen } = await fetchBalanceSheetFromAnaf(cui, year);

                // Capture denCaen from first (most recent) valid sheet
                if (!latestDenCaen && denCaen) {
                    latestDenCaen = denCaen;
                }

                // If all indicators are zero
                if (areAllIndicatorsZero(dto.indicators)) {
                    // Only STOP if we've already found at least one valid balance sheet
                    // Otherwise, continue (company might not have filed recent years yet)
                    if (balanceSheets.length > 0) {
                        logger.info(`All indicators are zero for year ${year}, stopping iteration (previous years will also be zero)`);
                        break;
                    } else {
                        logger.info(`All indicators are zero for year ${year}, continuing (no valid sheets found yet)`);
                        continue;
                    }
                }

                balanceSheets.push(dto);
                await saveBalanceSheetToDatabase(cui, dto);

                // Add small delay to respect rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                // If 404, the balance sheet doesn't exist for that year - continue to next year
                if ((error as Error).message.includes('not found')) {
                    logger.info(`No balance sheet for year ${year}, continuing to previous year`);
                    continue;
                }
                // For other errors, log but continue
                logger.warn(`Error fetching balance sheet for year ${year}: ${error}`);
                continue;
            }
        }

        logger.info(`Successfully fetched ${balanceSheets.length} balance sheets for CUI ${cui}`);
        return { balanceSheets, denCaen: latestDenCaen };
    } catch (error) {
        logger.error(`Error in fetchAllBalanceSheets for CUI ${cui}: ${error}`);
        throw error;
    }
}

/**
 * Fetch specific years that are missing from the database
 * Stops iteration when encountering all zeros (BUT only after finding at least
 * one valid sheet, to handle cases where recent years aren't filed yet)
 * Ensures minimum year is 2014 (ANAF dataset minimum)
 * Returns denCaen from the most recent fetched sheet
 */
export async function fetchMissingBalanceSheets(
    cui: string,
    existingYears: Set<number>,
    startYear: number,
    endYear: number
): Promise<{ balanceSheets: BalanceSheetDTO[]; denCaen?: string }> {
    const balanceSheets: BalanceSheetDTO[] = [];
    let latestDenCaen: string | undefined;

    // Ensure we don't go below 2014 (ANAF dataset minimum)
    const effectiveStartYear = Math.max(startYear, 2014);

    for (let year = endYear; year >= effectiveStartYear; year--) {
        // Skip if we already have this year
        if (existingYears.has(year)) {
            continue;
        }

        try {
            const { dto, denCaen } = await fetchBalanceSheetFromAnaf(cui, year);

            // Capture denCaen from first (most recent) valid sheet
            if (!latestDenCaen && denCaen) {
                latestDenCaen = denCaen;
            }

            // If all indicators are zero
            if (areAllIndicatorsZero(dto.indicators)) {
                // Only STOP if we've already found at least one valid balance sheet
                // Otherwise, continue (company might not have filed recent years yet)
                if (balanceSheets.length > 0) {
                    logger.info(`All indicators are zero for year ${year}, stopping iteration (previous years will also be zero)`);
                    break;
                } else {
                    logger.info(`All indicators are zero for year ${year}, continuing (no valid sheets found yet)`);
                    continue;
                }
            }

            balanceSheets.push(dto);
            await saveBalanceSheetToDatabase(cui, dto);

            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
            if ((error as Error).message.includes('not found')) {
                logger.info(`No balance sheet for year ${year}`);
                continue;
            }
            logger.warn(`Error fetching balance sheet for year ${year}: ${error}`);
            continue;
        }
    }

    return { balanceSheets, denCaen: latestDenCaen };
}

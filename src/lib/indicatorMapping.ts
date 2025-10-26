/**
 * Dynamic indicator mapping from ANAF balance sheet responses
 * Uses the actual val_den_indicator from ANAF and converts to camelCase
 */

import { AnafBalanceSheetIndicator } from "../types";
import { toCamelCase } from "./utils";

/**
 * Convert array of ANAF indicators to named object
 * Uses val_den_indicator from ANAF response and converts to camelCase
 */
export function mapIndicators(anafIndicators: AnafBalanceSheetIndicator[]): { [key: string]: number } {
    const result: { [key: string]: number } = {};

    for (const item of anafIndicators) {
        // Use val_den_indicator from ANAF and convert to camelCase
        const name = toCamelCase(item.val_den_indicator);
        result[name] = item.val_indicator;
    }

    return result;
}


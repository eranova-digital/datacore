/**
 * Dynamic indicator mapping from ANAF balance sheet responses
 * Uses the actual val_den_indicator from ANAF and converts to camelCase
 */

import { AnafBalanceSheetIndicator } from "../types";

/**
 * Convert a string to camelCase
 * Handles Romanian diacritics and special characters
 */
export function toCamelCase(str: string): string {
    return str
        // Remove leading/trailing whitespace
        .trim()
        // Replace Romanian diacritics (both cedilla and comma-below variations)
        .replace(/[ăĂ]/g, 'a')
        .replace(/[âÂ]/g, 'a')
        .replace(/[îÎ]/g, 'i')
        .replace(/[șȘşŞ]/g, 's')  // s with comma below and s with cedilla
        .replace(/[țȚţŢ]/g, 't')  // t with comma below and t with cedilla
        // Replace non-alphanumeric characters with spaces
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        // Convert to camelCase
        .split(' ')
        .filter(word => word.length > 0)
        .map((word, index) => {
            word = word.toLowerCase();
            if (index === 0) {
                return word;
            }
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join('');
}

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


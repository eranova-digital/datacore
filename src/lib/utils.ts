import { FastifyRequest } from "fastify";
import { env } from "./env";

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
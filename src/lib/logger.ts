import { env } from "./env";

export const logger = {
    info: (message: string) => {
        if (env.logToConsole) {
            console.log(`[${new Date().toISOString()}] ` + message)
        }
    },
    debug: (message: string) => {
        if (env.logToConsole) {
            console.log(`[${new Date().toISOString()}][DEBUG] ` + message)
        }
    },
    warn: (message: string) => {
        if (env.logToConsole) {
            console.warn(`[${new Date().toISOString()}][WARN] ` + message)
        }
    },
    error: (message: string) => {
        console.error(`[${new Date().toISOString()}][ERROR] ` + message)
    },
    fatal: (message: string) => {
        console.log(`\n\n[${new Date().toISOString()}][ERROR] A fatal error occurred:`)
        console.error(message)
    }
}
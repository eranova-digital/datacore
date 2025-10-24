import { PrismaClient } from '../generated/prisma/client'

// Singleton pattern for Prisma Client
// Prevents multiple instances during hot-reload in development
declare global {
    var prisma: PrismaClient | undefined
}

export const prisma = global.prisma || new PrismaClient()

// Save the client in global for development hot-reload
if (process.env.NODE_ENV !== 'production') {
    global.prisma = prisma
}

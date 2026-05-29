import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import path from "node:path";

// Singleton: garante que existe apenas um PrismaClient em toda a aplicação.
// Em desenvolvimento com hot-reload, o módulo pode ser recarregado várias vezes.
// Por isso, guardamos a instância na variável global do Node.js.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const sqliteFile = databaseUrl.startsWith("file:")
  ? databaseUrl.slice("file:".length) || "./dev.db"
  : databaseUrl;

const sqlitePath = path.isAbsolute(sqliteFile)
  ? sqliteFile
  : path.resolve(process.cwd(), sqliteFile);

const adapter = new PrismaBetterSqlite3({ url: sqlitePath });

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
    // log: ["query"] → mostra cada SQL executado no console (ótimo para debug)
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Uso em qualquer arquivo:
// import { prisma } from "@/prisma/client";
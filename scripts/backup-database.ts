/**
 * Full logical backup of the database via Prisma Client.
 *
 * Works through Prisma Accelerate (where pg_dump cannot connect).
 * Writes db_backups/<YYYYMMDD-HHmm>.json containing every row of every table.
 * Restore with: npx tsx scripts/restore-database.ts db_backups/<file>.json
 *
 * Usage: npx tsx --env-file=.env scripts/backup-database.ts
 */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

// Order matters for restore: parents before children.
export const TABLE_ORDER = [
  "school",
  "teacher",
  "student",
  "studentReport",
  "learningMaterial",
  "recommendation",
  "teacherAssistant",
  "studentThread",
  "studentMaterialProgress",
] as const;

async function main() {
  const startedAt = new Date();
  const data: Record<string, unknown[]> = {};

  for (const table of TABLE_ORDER) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (prisma as any)[table].findMany();
    data[table] = rows;
  }

  const backup = {
    meta: {
      createdAt: startedAt.toISOString(),
      format: "persona-lingua-prisma-json/1",
      tables: Object.fromEntries(
        TABLE_ORDER.map((t) => [t, data[t].length])
      ),
    },
    data,
  };

  const stamp = startedAt
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .slice(0, 13); // YYYYMMDD-HHmm
  const dir = join(process.cwd(), "db_backups");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${stamp}.json`);
  writeFileSync(file, JSON.stringify(backup, null, 2));

  console.log(`Backup written: ${file}`);
  console.table(backup.meta.tables);
}

main()
  .catch((err) => {
    console.error("Backup failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

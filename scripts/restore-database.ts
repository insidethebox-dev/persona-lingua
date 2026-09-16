/**
 * Restore a backup produced by scripts/backup-database.ts.
 *
 * Inserts rows table by table in parent-first order. Existing rows with the
 * same primary key are left untouched (skipDuplicates), so this is safe to run
 * against a partially populated database. It never deletes anything.
 *
 * Usage: npx tsx --env-file=.env scripts/restore-database.ts db_backups/<file>.json
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { TABLE_ORDER } from "./backup-database";

const prisma = new PrismaClient();

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: restore-database.ts <backup.json>");
    process.exit(1);
  }

  const backup = JSON.parse(readFileSync(file, "utf8"));
  if (backup?.meta?.format !== "persona-lingua-prisma-json/1") {
    console.error("Unrecognised backup format");
    process.exit(1);
  }

  for (const table of TABLE_ORDER) {
    const rows = backup.data[table] ?? [];
    if (rows.length === 0) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (prisma as any)[table].createMany({
      data: rows,
      skipDuplicates: true,
    });
    console.log(`${table}: ${result.count}/${rows.length} rows inserted`);
  }
}

main()
  .catch((err) => {
    console.error("Restore failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

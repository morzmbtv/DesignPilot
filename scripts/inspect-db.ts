import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const expectedTables = [
  "Project",
  "ProjectRule",
  "Screen",
  "ScreenVersion",
  "DesignComponent",
  "DesignToken",
  "DesignAsset",
  "DesignPattern",
  "DesignImport",
  "ComponentSimilarityReport",
  "StyleSimilarityReport",
  "DesignDecision",
  "ScreenSummary",
  "AiPromptLog",
  "User",
  "Account",
  "Session",
  "VerificationToken",
  "UserSettings",
] as const;

type TableRow = { table_name: string };
type ColumnRow = { column_name: string; data_type: string; is_nullable: string };
type MigrationRow = { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null };
type CountRow = { count: bigint };

async function tableExists(table: string) {
  const rows = await prisma.$queryRaw<TableRow[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${table}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function countRows(table: string) {
  if (!(await tableExists(table))) return null;
  const rows = await prisma.$queryRawUnsafe<CountRow[]>(`SELECT COUNT(*)::bigint AS count FROM "${table}"`);
  return rows[0]?.count?.toString() ?? "0";
}

async function main() {
  console.log("DesignPilot database inspection");
  console.log("================================");

  const tableStatuses = await Promise.all(expectedTables.map(async (table) => ({
    table,
    exists: await tableExists(table),
    rows: await countRows(table),
  })));

  console.table(tableStatuses);

  const projectColumns = await prisma.$queryRaw<ColumnRow[]>`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Project'
    ORDER BY ordinal_position
  `;

  console.log("\nProject columns:");
  console.table(projectColumns);

  const hasMigrationTable = await tableExists("_prisma_migrations");
  console.log(`\n_prisma_migrations exists: ${hasMigrationTable ? "yes" : "no"}`);

  if (hasMigrationTable) {
    const migrations = await prisma.$queryRaw<MigrationRow[]>`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      ORDER BY started_at ASC
    `;
    console.table(migrations.map((migration) => ({
      migration: migration.migration_name,
      status: migration.rolled_back_at ? "rolled_back" : migration.finished_at ? "applied" : "started_not_finished",
      finishedAt: migration.finished_at?.toISOString() ?? null,
    })));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

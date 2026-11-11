import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDb, getDb } from "./client";

/** Applies pending SQL migrations from packages/db/migrations. Run: npm run db:migrate (tunnel open). */
async function main(): Promise<void> {
  const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
  await migrate(getDb(), { migrationsFolder });
  console.log("Migrations applied");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDb);

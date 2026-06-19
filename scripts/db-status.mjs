import {
  appliedMigrations,
  createDatabaseClient,
  databaseConfig,
  loadDotEnv,
  migrationFiles,
  printDatabaseTarget
} from './db-utils.mjs';

loadDotEnv();

const config = databaseConfig();
const db = createDatabaseClient(config);

try {
  printDatabaseTarget(config);

  const { files } = await migrationFiles();
  const applied = await appliedMigrations(db);
  const appliedNames = new Set(applied.map((migration) => migration.filename));
  const pending = files.filter((file) => !appliedNames.has(file));
  const latestApplied = applied.at(-1);

  console.log(`Migrations available: ${files.length}`);
  console.log(`Migrations applied: ${applied.length}`);
  console.log(`Migrations pending: ${pending.length}`);
  console.log(`Latest applied migration: ${latestApplied ? latestApplied.filename : 'none'}`);

  if (pending.length > 0) {
    console.log('Pending migrations:');
    for (const file of pending) {
      console.log(`- ${file}`);
    }
  }
} finally {
  await db.close();
}

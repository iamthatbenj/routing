import {
  appliedMigrations,
  createDatabaseClient,
  databaseConfig,
  ensureSchemaMigrations,
  loadDotEnv,
  migrationFiles,
  migrationStatements,
  printDatabaseTarget,
  remoteMigrationConfirmed
} from './db-utils.mjs';

loadDotEnv();

const config = databaseConfig();

printDatabaseTarget(config);

if (config.mode === 'remote' && !remoteMigrationConfirmed()) {
  console.error('Refusing to run migrations against a remote database without explicit confirmation.');
  console.error('Re-run with `npm run db:migrate -- --yes` or set DATABASE_MIGRATE_CONFIRM=1.');
  process.exit(1);
}

const db = createDatabaseClient(config);

try {
  await ensureSchemaMigrations(db);

  const { migrationsDir, files } = await migrationFiles();
  const applied = await appliedMigrations(db);
  const appliedNames = new Set(applied.map((migration) => migration.filename));

  for (const file of files) {
    if (appliedNames.has(file)) {
      console.log(`Skipping ${file}`);
      continue;
    }

    const statements = await migrationStatements(migrationsDir, file);

    for (const statement of statements) {
      await db.execute(statement);
    }

    await db.execute({
      sql: 'INSERT INTO schema_migrations (filename) VALUES (?)',
      args: [file]
    });
    console.log(`Applied ${file}`);
  }
} finally {
  await db.close();
}

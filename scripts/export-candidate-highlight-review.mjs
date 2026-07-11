import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createDatabaseClient, databaseConfig, loadDotEnv, printDatabaseTarget } from './db-utils.mjs';

const DEFAULT_PATTERNS = [
  '%acadia%',
  '%bar harbor%',
  '%mount desert%',
  '%cadillac%',
  '%camden%',
  '%penobscot%',
  '%pemaquid%',
  '%portland head%',
  '%lighthouse%',
  '%coastal%',
  '%state park%',
  '%national park%',
  '%maine%'
];

loadDotEnv();
const options = parseOptions(process.argv.slice(2));
const config = databaseConfig();

if (!options.quiet) printDatabaseTarget(config);

const db = createDatabaseClient(config);

try {
  const rows = await loadRows(db, options);
  const rendered = options.format === 'json' ? JSON.stringify(rows, null, 2) + '\n' : toCsv(rows);

  if (options.out) {
    await mkdir(dirname(options.out), { recursive: true });
    await writeFile(options.out, rendered, 'utf8');
    console.log(`Exported ${rows.length} Candidate Highlight review row(s) to ${options.out}.`);
  } else {
    process.stdout.write(rendered);
  }
} finally {
  await db.close();
}

function parseOptions(args) {
  const options = {
    mode: 'shortlist',
    format: 'csv',
    out: '',
    limit: 200,
    categories: [],
    patterns: [],
    quiet: false
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    if (arg === '--quiet') options.quiet = true;
    else if (arg === '--all') options.mode = 'all';
    else if (arg === '--duplicates') options.mode = 'duplicates';
    else if (arg.startsWith('--mode=')) options.mode = arg.slice('--mode='.length);
    else if (arg.startsWith('--format=')) options.format = arg.slice('--format='.length);
    else if (arg.startsWith('--out=')) options.out = arg.slice('--out='.length);
    else if (arg.startsWith('--limit=')) options.limit = Number(arg.slice('--limit='.length));
    else if (arg.startsWith('--category=')) options.categories.push(...splitList(arg.slice('--category='.length)));
    else if (arg.startsWith('--pattern=')) options.patterns.push(...splitList(arg.slice('--pattern='.length)).map((pattern) => `%${pattern}%`));
    else throw new Error(`Unknown option: ${arg}`);
  }

  if (!['shortlist', 'duplicates', 'all'].includes(options.mode)) throw new Error(`Unsupported mode: ${options.mode}`);
  if (!['csv', 'json'].includes(options.format)) throw new Error(`Unsupported format: ${options.format}`);
  if (!Number.isInteger(options.limit) || options.limit < 1) throw new Error('--limit must be a positive integer.');

  return options;
}

function splitList(value) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

async function loadRows(db, options) {
  if (options.mode === 'duplicates') return loadDuplicateRows(db, options);
  if (options.mode === 'all') return loadCandidateRows(db, options, '1 = 1', []);

  const patterns = options.patterns.length > 0 ? options.patterns : DEFAULT_PATTERNS;
  const where = patterns.map(() => 'lower(name) LIKE lower(?)').join(' OR ');
  return loadCandidateRows(db, options, `(${where})`, patterns);
}

async function loadCandidateRows(db, options, whereSql, args) {
  const categoryArgs = options.categories;
  const categorySql = categoryArgs.length > 0 ? `AND proposed_category IN (${categoryArgs.map(() => '?').join(', ')})` : '';
  const result = await db.execute({
    sql: `
      SELECT id, name, proposed_category, source_category, latitude, longitude, status,
        source_system, source_database, source_record_id, source_url, description, evidence_json
      FROM candidate_highlights
      WHERE ${whereSql}
        ${categorySql}
      ORDER BY proposed_category, name, source_record_id
      LIMIT ?
    `,
    args: [...args, ...categoryArgs, options.limit]
  });

  return result.rows.map((row) => ({
    review_action: '',
    promote_highlight_id: '',
    promote_strength: '',
    promote_visit_effort: '',
    review_notes: '',
    id: String(row.id),
    name: String(row.name),
    proposed_category: String(row.proposed_category),
    source_category: nullable(row.source_category),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    status: String(row.status),
    source_system: String(row.source_system),
    source_database: String(row.source_database),
    source_record_id: String(row.source_record_id),
    source_url: nullable(row.source_url),
    description: String(row.description ?? ''),
    evidence_json: String(row.evidence_json ?? '{}')
  }));
}

async function loadDuplicateRows(db, options) {
  const result = await db.execute({
    sql: `
      SELECT lower(name) AS normalized_name, name, proposed_category, COUNT(*) AS duplicate_count,
        group_concat(source_record_id, '|') AS source_record_ids
      FROM candidate_highlights
      GROUP BY lower(name), proposed_category
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC, name
      LIMIT ?
    `,
    args: [options.limit]
  });

  return result.rows.map((row) => ({
    review_action: '',
    review_notes: '',
    name: String(row.name),
    proposed_category: String(row.proposed_category),
    duplicate_count: Number(row.duplicate_count),
    source_record_ids: String(row.source_record_ids ?? '')
  }));
}

function toCsv(rows) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvCell(row[header])).join(','));
  }
  return lines.join('\n') + '\n';
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function nullable(value) {
  return value === null || value === undefined ? '' : String(value);
}

function printHelp() {
  console.log(`Export Candidate Highlights for human review.

Usage:
  npm run db:review:candidate-highlights -- [options]

Options:
  --mode=shortlist|duplicates|all  Export shortlist rows, duplicate-name summary, or all candidates. Default: shortlist.
  --all                           Shortcut for --mode=all.
  --duplicates                    Shortcut for --mode=duplicates.
  --format=csv|json               Output format. Default: csv.
  --out=path                      Write to a file instead of stdout.
  --limit=N                       Maximum rows. Default: 200.
  --category=a,b                  Restrict to proposed categories, e.g. nature,landmark.
  --pattern=text                  Add shortlist name pattern. Can be repeated or comma-separated.
  --quiet                         Suppress database target summary when writing to stdout.

Examples:
  npm run db:review:candidate-highlights -- --out=data/review/candidate-highlights.csv
  npm run db:review:candidate-highlights -- --duplicates --out=data/review/duplicate-candidates.csv
  npm run db:review:candidate-highlights -- --all --format=json --out=data/review/all-candidates.json
`);
}

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const REQUIRED_PROMOTE_FIELDS = [
  'review_action',
  'promote_highlight_id',
  'promote_strength',
  'promote_visit_effort',
  'review_notes',
  'id',
  'name',
  'proposed_category',
  'latitude',
  'longitude'
];

const ALLOWED_VISIT_EFFORTS = new Set(['Quick Stop', 'Short Visit', 'Half Day', 'Full Day+']);
const ALLOWED_CATEGORIES = new Set(['nature', 'landmark', 'scenic_segment', 'food']);

const options = parseOptions(process.argv.slice(2));
const csv = await readFile(options.input, 'utf8');
const rows = parseCsv(csv);
const promotions = rows.filter((row) => row.review_action.trim().toLowerCase() === 'promote').map((row, index) => promotionFromRow(row, index + 2, options.reviewedBy));

if (promotions.length === 0) {
  throw new Error(`No rows with review_action=promote found in ${options.input}.`);
}

const outputJson = JSON.stringify(promotions, null, 2) + '\n';

if (options.output) {
  await mkdir(dirname(options.output), { recursive: true });
  await writeFile(options.output, outputJson, 'utf8');
  console.log(`Wrote ${promotions.length} reviewed Highlight promotion(s) to ${options.output}.`);
} else {
  process.stdout.write(outputJson);
}

function parseOptions(args) {
  const options = {
    input: 'data/routing-places/review_pois.csv',
    output: 'data/highlight-promotions/reviewed-candidate-highlights.json',
    reviewedBy: process.env.USER || 'maintainer'
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    if (arg.startsWith('--in=')) options.input = arg.slice('--in='.length);
    else if (arg.startsWith('--out=')) options.output = arg.slice('--out='.length);
    else if (arg === '--stdout') options.output = '';
    else if (arg.startsWith('--reviewed-by=')) options.reviewedBy = arg.slice('--reviewed-by='.length);
    else throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function promotionFromRow(row, lineNumber, reviewedBy) {
  for (const field of REQUIRED_PROMOTE_FIELDS) {
    if (!String(row[field] ?? '').trim()) {
      throw new Error(`Line ${lineNumber}: promoted row is missing ${field}.`);
    }
  }

  const category = row.proposed_category.trim();
  if (!ALLOWED_CATEGORIES.has(category)) {
    throw new Error(`Line ${lineNumber}: unsupported proposed_category for promotion: ${category}.`);
  }

  if (category === 'food') {
    throw new Error(`Line ${lineNumber}: Food Highlights are deferred from TB16 and cannot be promoted here.`);
  }

  const strength = Number(row.promote_strength);
  if (!Number.isInteger(strength) || strength < 1 || strength > 100) {
    throw new Error(`Line ${lineNumber}: promote_strength must be an integer from 1 to 100.`);
  }

  const visitEffort = row.promote_visit_effort.trim();
  if (!ALLOWED_VISIT_EFFORTS.has(visitEffort)) {
    throw new Error(`Line ${lineNumber}: promote_visit_effort must be one of ${[...ALLOWED_VISIT_EFFORTS].join(', ')}.`);
  }

  const reviewNotes = row.review_notes.trim();
  const name = row.name.trim();
  const coordinates = `${row.latitude}, ${row.longitude}`;

  return {
    candidateHighlightId: row.id.trim(),
    review: {
      highlightId: row.promote_highlight_id.trim(),
      category,
      strength,
      visitEffort,
      description: reviewNotes,
      reviewedBy,
      evidence: {
        travelRelevance: reviewNotes,
        stableIdentity: `Reviewed as ${name}; source record ${row.source_record_id || row.id} provides a stable Candidate Highlight identity.`,
        coordinateCheck: `Reviewed coordinates from source import: ${coordinates}.`,
        categoryRationale: `${category === 'scenic_segment' ? 'Scenic Segment' : 'Highlight'} category accepted during Candidate Highlight review from proposed category ${category}.`,
        routeInfluence: `Promoted with strength ${strength}; reviewer judged this Candidate Highlight strong enough to influence Route Option comparison.`
      }
    }
  };
}

function parseCsv(csv) {
  const records = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      records.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell);
    records.push(row);
  }

  const [headers, ...dataRows] = records.filter((record) => record.some((value) => value.trim() !== ''));
  if (!headers) return [];

  return dataRows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function printHelp() {
  console.log(`Convert reviewed Candidate Highlight CSV rows into promotion JSON.

Usage:
  npm run db:prepare:highlight-promotions -- [options]

Options:
  --in=path          Reviewed CSV input. Default: data/routing-places/review_pois.csv
  --out=path         Promotion JSON output. Default: data/highlight-promotions/reviewed-candidate-highlights.json
  --stdout           Print JSON to stdout instead of writing a file.
  --reviewed-by=name Human reviewer recorded in promotion evidence. Default: USER env var or maintainer.

Only rows with review_action=promote are converted. Blank, skip, duplicate, and fix_later rows are ignored.
`);
}

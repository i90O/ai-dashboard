import postgres from 'postgres';
import { readFileSync } from 'fs';

const sql = postgres('postgresql://postgres.hlumwrbidlxepmcvsswe:8jlXcAZQN0L7bkMC@aws-0-us-east-1.pooler.supabase.com:5432/postgres');

const migration = readFileSync('./supabase/voxyz-complete.sql', 'utf8');

// Split by semicolons and execute each statement
const statements = migration.split(';').filter(s => s.trim());
console.log(`Running ${statements.length} statements...`);

let success = 0;
let errors = [];

for (const stmt of statements) {
  if (!stmt.trim()) continue;
  try {
    await sql.unsafe(stmt);
    success++;
    if (success % 20 === 0) console.log(`Progress: ${success}/${statements.length}`);
  } catch (e) {
    errors.push({ stmt: stmt.substring(0, 80), error: e.message });
  }
}

console.log(`\n✅ Success: ${success}`);
if (errors.length) {
  console.log(`❌ Errors: ${errors.length}`);
  errors.slice(0, 5).forEach(e => console.log(`  - ${e.stmt}... : ${e.error}`));
}

await sql.end();

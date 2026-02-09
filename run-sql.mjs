import postgres from 'postgres';
import fs from 'fs';

const DATABASE_URL = 'postgresql://postgres.hlumwrbidlxepmcvsswe:8jlXcAZQN0L7bkMC@aws-0-us-east-1.pooler.supabase.com:5432/postgres';

const sql = postgres(DATABASE_URL);

async function run() {
  const sqlContent = fs.readFileSync('./supabase/voxyz-complete.sql', 'utf8');
  
  // Split by semicolons, keeping only actual statements
  const statements = sqlContent.split(/;[\s]*\n/).map(s => s.trim()).filter(s => {
    const clean = s.replace(/--[^\n]*/g, '').trim();
    return clean.length > 10;
  });
  
  console.log(`Found ${statements.length} SQL statements`);
  
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';';
    
    try {
      await sql.unsafe(stmt);
      success++;
      if (success % 10 === 0) console.log(`Progress: ${success} succeeded`);
    } catch (e) {
      if (e.message.includes('already exists') || e.message.includes('duplicate')) {
        success++;
      } else {
        console.error(`[${i}] Failed: ${e.message.slice(0, 80)}`);
        failed++;
      }
    }
  }
  
  console.log(`\n✅ Done: ${success} succeeded, ${failed} failed`);
  await sql.end();
}

run().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});

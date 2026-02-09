import postgres from 'postgres';
import { readFileSync } from 'fs';

// Use direct connection (not pooler) for DDL operations
const sql = postgres('postgresql://postgres:8jlXcAZQN0L7bkMC@db.hlumwrbidlxepmcvsswe.supabase.co:5432/postgres');

async function runMigration() {
  try {
    const migration = readFileSync('./supabase/voxyz-upgrade.sql', 'utf-8');
    
    // Split by semicolons but be careful with functions
    const statements = migration
      .split(/;\s*$/gm)
      .filter(s => s.trim())
      .map(s => s.trim() + ';');
    
    console.log(`Running ${statements.length} statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (!stmt.trim() || stmt.trim() === ';') continue;
      
      try {
        await sql.unsafe(stmt);
        console.log(`✓ Statement ${i + 1}/${statements.length}`);
      } catch (e) {
        // Skip "already exists" errors
        if (e.message.includes('already exists') || e.message.includes('duplicate key')) {
          console.log(`⊘ Statement ${i + 1} skipped (already exists)`);
        } else {
          console.error(`✗ Statement ${i + 1} failed:`, e.message);
          console.error('SQL:', stmt.substring(0, 100) + '...');
        }
      }
    }
    
    console.log('\n✅ Migration complete!');
    
    // Verify tables
    const tables = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE 'ops_%'
      ORDER BY table_name
    `;
    console.log('\nOps tables created:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));
    
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    await sql.end();
  }
}

runMigration();

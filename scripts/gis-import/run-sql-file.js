const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function executeSQLFile(filename) {
  const sql = fs.readFileSync(filename, 'utf8');

  console.log(`Executing SQL from ${filename}...`);

  // Split by semicolon but preserve multi-line statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement.trim()) {
      try {
        // Use raw query execution
        const { data, error } = await supabase.rpc('exec', { query: statement });
        if (error) {
          console.log(`Statement ${i + 1}: ${error.message.substring(0, 100)}`);
        } else {
          console.log(`✓ Statement ${i + 1} executed`);
        }
      } catch (err) {
        console.log(`Statement ${i + 1}: ${err.message.substring(0, 100)}`);
      }
    }
  }

  console.log('Done!');
}

const filename = process.argv[2] || 'scripts/add-ca-utilities.sql';
executeSQLFile(filename);

#!/usr/bin/env node

/**
 * Batch migration script for API routes
 * Updates simple routes to use new SSR utilities
 */

const fs = require('fs');
const path = require('path');

// Routes to migrate with their specific patterns
const routesToMigrate = [
  {
    path: 'app/api/funding/process-next-source/route.js',
    importPattern: /import\s+{\s*createSupabaseClient[^}]*}\s+from\s+['"]@\/lib\/supabase['"]/,
    clientPattern: /const\s+supabase\s*=\s*createSupabaseClient\(\)/,
    needsRequest: true
  },
  {
    path: 'app/api/funding/raw-responses/[id]/route.js',
    importPattern: /import\s+{\s*createSupabaseClient[^}]*}\s+from\s+['"]@\/lib\/supabase['"]/,
    clientPattern: /const\s+supabase\s*=\s*createSupabaseClient\(\)/,
    needsRequest: true
  },
  {
    path: 'app/api/funding/raw-responses/latest/route.js',
    importPattern: /import\s+{\s*createSupabaseClient[^}]*}\s+from\s+['"]@\/lib\/supabase['"]/,
    clientPattern: /const\s+supabase\s*=\s*createSupabaseClient\(\)/,
    needsRequest: true
  },
  {
    path: 'app/api/funding/sources/[id]/route.js',
    importPattern: /import\s+{\s*createSupabaseClient[^}]*}\s+from\s+['"]@\/lib\/supabase['"]/,
    clientPattern: /const\s+supabase\s*=\s*createSupabaseClient\(\)/,
    needsRequest: true
  },
  {
    path: 'app/api/funding/sources/[id]/manager/route.js',
    importPattern: /import\s+{\s*createSupabaseClient[^}]*}\s+from\s+['"]@\/lib\/supabase['"]/,
    clientPattern: /const\s+supabase\s*=\s*createSupabaseClient\(\)/,
    needsRequest: true
  },
  {
    path: 'app/api/funding/sources/[id]/process/route.js',
    importPattern: /import\s+{\s*createSupabaseClient[^}]*}\s+from\s+['"]@\/lib\/supabase['"]/,
    clientPattern: /const\s+supabase\s*=\s*createSupabaseClient\(\)/,
    needsRequest: true
  },
  {
    path: 'app/api/funding/sources/process-next/route.js',
    importPattern: /import\s+{\s*createSupabaseClient[^}]*}\s+from\s+['"]@\/lib\/supabase['"]/,
    clientPattern: /const\s+supabase\s*=\s*createSupabaseClient\(\)/,
    needsRequest: true
  },
  {
    path: 'app/api/funding/verify/grants-gov/route.js',
    importPattern: /import\s+{\s*createSupabaseClient[^}]*}\s+from\s+['"]@\/lib\/supabase['"]/,
    clientPattern: /const\s+supabase\s*=\s*createSupabaseClient\(\)/,
    needsRequest: true
  },
  {
    path: 'app/api/funding/category-summary/route.js',
    importPattern: /import\s+{\s*supabase[^}]*}\s+from\s+['"]@\/lib\/supabase['"]/,
    clientPattern: null,
    needsRequest: true,
    isGlobalSupabase: true
  },
  {
    path: 'app/api/debug/funding-values/route.js',
    importPattern: /import\s+{\s*createSupabaseClient[^}]*}\s+from\s+['"]@\/lib\/supabase['"]/,
    clientPattern: /const\s+supabase\s*=\s*createSupabaseClient\(\)/,
    needsRequest: true
  },
  {
    path: 'app/api/map/funding-by-state/route.js',
    importPattern: /import\s+{\s*supabase[^}]*}\s+from\s+['"]@\/lib\/supabase['"]/,
    clientPattern: null,
    needsRequest: true,
    isGlobalSupabase: true
  },
  {
    path: 'app/api/map/opportunities/[stateCode]/route.js',
    importPattern: /import\s+{\s*supabase[^}]*}\s+from\s+['"]@\/lib\/supabase['"]/,
    clientPattern: null,
    needsRequest: true,
    isGlobalSupabase: true
  }
];

function migrateRoute(route) {
  const filePath = path.join(process.cwd(), route.path);
  
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${route.path} - file not found`);
    return false;
  }
  
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  
  // Replace import
  if (route.importPattern && route.importPattern.test(content)) {
    content = content.replace(
      route.importPattern,
      "import { createClient } from '@/utils/supabase/api'"
    );
    modified = true;
  }
  
  // Handle global supabase usage
  if (route.isGlobalSupabase) {
    // Find the first function that uses request
    const functionMatch = content.match(/export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(([^)]*)\)/);
    if (functionMatch) {
      const hasRequest = functionMatch[2].includes('request');
      
      if (!hasRequest) {
        // Add request parameter to functions that don't have it
        content = content.replace(
          /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(\s*\)/g,
          'export async function $1(request)'
        );
      }
      
      // Add supabase client creation at the beginning of each function
      const functions = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      for (const fn of functions) {
        const fnPattern = new RegExp(`export\\s+async\\s+function\\s+${fn}\\s*\\([^)]*\\)\\s*{\\s*try\\s*{`, 'g');
        if (fnPattern.test(content)) {
          content = content.replace(
            fnPattern,
            `export async function ${fn}(request) {\n\ttry {\n\t\t// Create Supabase client with request context\n\t\tconst { supabase } = createClient(request);\n\t\t`
          );
        }
      }
      
      // Replace supabase. with supabase. (no change needed, just ensure it's scoped correctly)
      modified = true;
    }
  } else if (route.clientPattern) {
    // Replace client creation pattern
    content = content.replace(
      route.clientPattern,
      '{ supabase } = createClient(request)'
    );
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✓ Migrated ${route.path}`);
    return true;
  } else {
    console.log(`- No changes needed for ${route.path}`);
    return false;
  }
}

// Main execution
console.log('Starting batch migration of API routes...\n');

let migratedCount = 0;
let skippedCount = 0;

for (const route of routesToMigrate) {
  if (migrateRoute(route)) {
    migratedCount++;
  } else {
    skippedCount++;
  }
}

console.log(`\nMigration complete:`);
console.log(`✓ Migrated: ${migratedCount} files`);
console.log(`- Skipped: ${skippedCount} files`);
console.log('\nNote: Please review the changes and test each route.');
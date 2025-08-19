#!/usr/bin/env node

/**
 * Script to help identify API routes that need migration to new SSR utilities
 * This script analyzes API routes and provides a report of migration needs
 */

const fs = require('fs');
const path = require('path');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Patterns to check for
const patterns = {
  oldImports: [
    /import\s+{\s*supabase[^}]*}\s+from\s+['"]@\/lib\/supabase['"]/,
    /import\s+{\s*createSupabaseClient[^}]*}\s+from\s+['"]@\/lib\/supabase['"]/,
    /import\s+{\s*createAdminSupabaseClient[^}]*}\s+from\s+['"]@\/lib\/supabase['"]/,
    /import\s+{\s*fundingApi[^}]*}\s+from\s+['"]@\/lib\/supabase['"]/,
    /createClient\s+from\s+['"]@supabase\/supabase-js['"]/,
  ],
  directClientCreation: [
    /createClient\s*\(/,
    /new\s+createClient\s*\(/,
  ],
  needsRequest: [
    /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/,
  ],
};

// Find all route.js files in app/api
function findApiRoutes(dir) {
  const routes = [];
  
  function traverse(currentDir) {
    const files = fs.readdirSync(currentDir);
    
    for (const file of files) {
      const filePath = path.join(currentDir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        traverse(filePath);
      } else if (file === 'route.js' || file === 'route.ts') {
        routes.push(filePath);
      }
    }
  }
  
  traverse(dir);
  return routes;
}

// Analyze a single route file
function analyzeRoute(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = [];
  
  // Check for old imports
  for (const pattern of patterns.oldImports) {
    if (pattern.test(content)) {
      issues.push({
        type: 'old-import',
        pattern: pattern.toString(),
        line: content.split('\n').findIndex(line => pattern.test(line)) + 1,
      });
    }
  }
  
  // Check for direct client creation
  for (const pattern of patterns.directClientCreation) {
    if (pattern.test(content)) {
      // Exclude our new utilities
      if (!content.includes('@/utils/supabase/')) {
        issues.push({
          type: 'direct-client',
          pattern: pattern.toString(),
          line: content.split('\n').findIndex(line => pattern.test(line)) + 1,
        });
      }
    }
  }
  
  // Check if it's an API route handler
  const isApiRoute = patterns.needsRequest.some(p => p.test(content));
  
  // Check if it imports fundingApi
  const usesFundingApi = /fundingApi/.test(content);
  
  return {
    path: filePath,
    issues,
    isApiRoute,
    usesFundingApi,
    needsMigration: issues.length > 0,
  };
}

// Generate migration suggestions
function getMigrationSuggestion(analysis) {
  const suggestions = [];
  
  if (analysis.issues.some(i => i.type === 'old-import')) {
    suggestions.push('Replace imports from @/lib/supabase with @/utils/supabase/api');
  }
  
  if (analysis.issues.some(i => i.type === 'direct-client')) {
    suggestions.push('Use createClient from @/utils/supabase/api instead of direct instantiation');
  }
  
  if (analysis.isApiRoute) {
    suggestions.push('Update to use createClient(request) pattern for proper SSR handling');
  }
  
  if (analysis.usesFundingApi) {
    suggestions.push('Consider moving fundingApi to a separate service file or updating its implementation');
  }
  
  return suggestions;
}

// Main execution
function main() {
  const apiDir = path.join(process.cwd(), 'app', 'api');
  
  if (!fs.existsSync(apiDir)) {
    console.error(`${colors.red}Error: app/api directory not found${colors.reset}`);
    process.exit(1);
  }
  
  console.log(`${colors.cyan}Analyzing API routes for migration needs...${colors.reset}\n`);
  
  const routes = findApiRoutes(apiDir);
  console.log(`Found ${colors.blue}${routes.length}${colors.reset} API route files\n`);
  
  const analyses = routes.map(analyzeRoute);
  const needsMigration = analyses.filter(a => a.needsMigration);
  
  // Group by status
  const migrationNeeded = [];
  const clean = [];
  
  for (const analysis of analyses) {
    if (analysis.needsMigration) {
      migrationNeeded.push(analysis);
    } else {
      clean.push(analysis);
    }
  }
  
  // Display results
  console.log(`${colors.yellow}=== Migration Status ===${colors.reset}\n`);
  console.log(`${colors.green}✓ Clean:${colors.reset} ${clean.length} files`);
  console.log(`${colors.red}✗ Needs Migration:${colors.reset} ${migrationNeeded.length} files\n`);
  
  if (migrationNeeded.length > 0) {
    console.log(`${colors.yellow}=== Files Needing Migration ===${colors.reset}\n`);
    
    for (const analysis of migrationNeeded) {
      const relativePath = path.relative(process.cwd(), analysis.path);
      console.log(`${colors.red}${relativePath}${colors.reset}`);
      
      // Show issues
      for (const issue of analysis.issues) {
        console.log(`  - Line ${issue.line}: ${issue.type}`);
      }
      
      // Show suggestions
      const suggestions = getMigrationSuggestion(analysis);
      if (suggestions.length > 0) {
        console.log(`  ${colors.cyan}Suggestions:${colors.reset}`);
        for (const suggestion of suggestions) {
          console.log(`    • ${suggestion}`);
        }
      }
      
      console.log();
    }
  }
  
  // Summary
  console.log(`${colors.cyan}=== Summary ===${colors.reset}\n`);
  console.log(`Total API routes: ${routes.length}`);
  console.log(`Routes needing migration: ${migrationNeeded.length}`);
  console.log(`Routes using fundingApi: ${analyses.filter(a => a.usesFundingApi).length}`);
  
  if (migrationNeeded.length > 0) {
    console.log(`\n${colors.yellow}Next steps:${colors.reset}`);
    console.log('1. Update imports to use @/utils/supabase/api');
    console.log('2. Pass request object to createClient()');
    console.log('3. Consider extracting fundingApi to a separate service');
    console.log('4. Test each migrated route thoroughly');
  } else {
    console.log(`\n${colors.green}All API routes are already using the new SSR utilities!${colors.reset}`);
  }
}

// Run the script
main();
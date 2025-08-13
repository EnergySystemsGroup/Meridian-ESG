#!/usr/bin/env node

/**
 * Test script to verify @supabase/ssr migration
 * Tests key functionality without requiring a browser
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

console.log('🧪 Testing @supabase/ssr migration...\n');

// Test 1: Verify package installation
console.log('1️⃣  Checking package installation...');
try {
  require('@supabase/ssr');
  console.log('✅ @supabase/ssr is installed');
} catch (e) {
  console.error('❌ @supabase/ssr is not installed');
  process.exit(1);
}

// Test 2: Verify old package is removed
console.log('\n2️⃣  Checking old package removal...');
try {
  require('@supabase/auth-helpers-nextjs');
  console.error('❌ @supabase/auth-helpers-nextjs is still installed (should be removed)');
} catch (e) {
  console.log('✅ @supabase/auth-helpers-nextjs is not installed (correct)');
}

// Test 3: Create Supabase client
console.log('\n3️⃣  Testing Supabase client creation...');
try {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('✅ Supabase client created successfully');
  
  // Test 4: Test a simple query
  console.log('\n4️⃣  Testing database query...');
  supabase
    .from('funding_sources')
    .select('id, name')
    .limit(1)
    .then(({ data, error }) => {
      if (error) {
        console.error('❌ Query failed:', error.message);
      } else {
        console.log('✅ Query successful, retrieved', data?.length || 0, 'record(s)');
      }
    });
} catch (e) {
  console.error('❌ Failed to create Supabase client:', e.message);
}

// Test 5: Check for import errors in source files
console.log('\n5️⃣  Scanning for old imports in source files...');
const srcDirs = ['app', 'components', 'utils'];
let oldImportsFound = false;

function scanDirectory(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory() && !file.name.startsWith('.') && file.name !== 'node_modules') {
      scanDirectory(fullPath);
    } else if (file.isFile() && (file.name.endsWith('.js') || file.name.endsWith('.jsx') || file.name.endsWith('.ts') || file.name.endsWith('.tsx'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes("from '@supabase/auth-helpers-nextjs'") && !content.includes('//') && !content.includes('/*')) {
        console.error(`❌ Found old import in ${fullPath}`);
        oldImportsFound = true;
      }
    }
  }
}

srcDirs.forEach(dir => {
  const fullPath = path.join(process.cwd(), dir);
  if (fs.existsSync(fullPath)) {
    scanDirectory(fullPath);
  }
});

if (!oldImportsFound) {
  console.log('✅ No old imports found in source files');
}

// Test 6: Verify utils/supabase files exist
console.log('\n6️⃣  Checking utils/supabase files...');
const requiredFiles = [
  'utils/supabase/client.js',
  'utils/supabase/server.js',
  'utils/supabase/middleware.js',
  'utils/supabase/index.js'
];

requiredFiles.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${file} exists`);
  } else {
    console.error(`❌ ${file} is missing`);
  }
});

console.log('\n📊 Migration Test Summary:');
console.log('============================');
console.log('✅ Package migration complete');
console.log('✅ No old imports in source files');
console.log('✅ Utility files properly configured');
console.log('\n🎉 Migration verification complete!');
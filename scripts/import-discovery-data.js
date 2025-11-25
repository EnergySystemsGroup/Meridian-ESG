#!/usr/bin/env node
/**
 * Import pruned discovery data into manual_funding_opportunities_staging table
 *
 * This script:
 * 1. Looks up or creates the funding source in funding_sources table
 * 2. Inserts the program into the staging table with source_id FK
 *
 * Usage: node scripts/import-discovery-data.js
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('Missing Supabase key. Set SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const DISCOVERY_DIR = './temp/utility-discovery/01-discovery-pruned';

// Cache for funding source IDs to avoid repeated lookups
const sourceIdCache = new Map();

/**
 * Get or create a funding source, returning its ID
 * @param {string} sourceName - The utility name (may include parenthetical suffix)
 * @returns {Promise<string>} - The funding source UUID
 */
async function getOrCreateFundingSource(sourceName) {
  // Strip parenthetical suffix to get clean name
  const cleanName = sourceName.split(' (')[0];

  // Check cache first
  if (sourceIdCache.has(cleanName)) {
    return sourceIdCache.get(cleanName);
  }

  // Look up existing source
  const { data: existing } = await supabase
    .from('funding_sources')
    .select('id')
    .eq('name', cleanName)
    .single();

  if (existing) {
    sourceIdCache.set(cleanName, existing.id);
    return existing.id;
  }

  // Create new source
  const { data: created, error } = await supabase
    .from('funding_sources')
    .insert({ name: cleanName, type: 'Utility' })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create funding source "${cleanName}": ${error.message}`);
  }

  sourceIdCache.set(cleanName, created.id);
  return created.id;
}

async function importDiscoveryData() {
  console.log('Starting discovery data import...\n');

  // Get all batch files
  const files = fs.readdirSync(DISCOVERY_DIR)
    .filter(f => f.startsWith('discovery-batch-') && f.endsWith('.json'))
    .sort();

  console.log(`Found ${files.length} batch files to import\n`);

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const file of files) {
    const filePath = path.join(DISCOVERY_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    console.log(`\nProcessing ${file} (Batch ${data.batch_number})...`);

    for (const utility of data.utilities) {
      if (!utility.programs_discovered || utility.programs_discovered.length === 0) {
        continue;
      }

      // Get or create the funding source for this utility
      let sourceId;
      try {
        sourceId = await getOrCreateFundingSource(utility.utility);
      } catch (err) {
        console.error(`  ERROR getting source for ${utility.utility}: ${err.message}`);
        totalErrors += utility.programs_discovered.length;
        continue;
      }

      for (const program of utility.programs_discovered) {
        // Skip if pruning_reason starts with anything other than "KEEP"
        if (!program.pruning_reason || !program.pruning_reason.startsWith('KEEP')) {
          continue;
        }

        const record = {
          source_id: sourceId,
          title: program.title,
          url: program.url,
          content_type: program.content_type || 'html',
          discovery_method: 'cc_agent',
          discovered_by: 'ai_discovery',
          extraction_status: 'pending',
          analysis_status: 'pending',
          storage_status: 'pending'
        };

        try {
          const { data: inserted, error } = await supabase
            .from('manual_funding_opportunities_staging')
            .insert(record)
            .select()
            .single();

          if (error) {
            if (error.code === '23505') {
              // Duplicate - URL or source+title already exists
              console.log(`  SKIP (duplicate): ${program.title}`);
              totalSkipped++;
            } else {
              console.error(`  ERROR: ${program.title} - ${error.message}`);
              totalErrors++;
            }
          } else {
            console.log(`  OK: ${program.title}`);
            totalInserted++;
          }
        } catch (err) {
          console.error(`  ERROR: ${program.title} - ${err.message}`);
          totalErrors++;
        }
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(50));
  console.log(`Inserted: ${totalInserted}`);
  console.log(`Skipped (duplicates): ${totalSkipped}`);
  console.log(`Errors: ${totalErrors}`);
  console.log(`Total processed: ${totalInserted + totalSkipped + totalErrors}`);
}

importDiscoveryData().catch(console.error);

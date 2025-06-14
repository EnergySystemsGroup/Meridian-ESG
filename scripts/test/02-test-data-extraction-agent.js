#!/usr/bin/env node

/**
 * Stage 2: DataExtractionAgent Testing with Real Data
 * 
 * Uses the results from Stage 1 (SourceOrchestrator) to test the DataExtractionAgent:
 * 1. California Grants Portal (single-api workflow)
 * 2. Grants.gov (two-step API workflow)
 * 
 * This tests actual API calls, field mapping, and opportunity extraction.
 */

import dotenv from 'dotenv';

// Load environment variables FIRST before any imports that depend on them
dotenv.config({ path: '.env.local' });

import { extractFromSource } from '../../app/lib/agents-v2/core/dataExtractionAgent.js';

// Stage 1 results (from SourceOrchestrator test)
const STAGE_1_RESULTS = {
  "timestamp": "2025-06-13T21:48:13.993Z",
  "results": {
    "california": {
      "analysis": {
        "workflow": "single_api",
        "apiEndpoint": "https://data.ca.gov/api/3/action/datastore_search",
        "requestConfig": {
          "method": "GET",
          "headers": {
            "Content-Type": "application/json"
          }
        },
        "queryParameters": {
          "q": "energy | building | mobility | solar | battery | modernization | hvac | lighting | water | climate | carbon | school | infrastructure | roof | transportation | construction",
          "limit": "10",
          "plain": "false",
          "offset": "0",
          "filters": "{\"Status\":[\"active\",\"forecasted\"]}",
          "resource_id": "111c8c88-21f6-453c-ae2c-b4785a0624f5"
        },
        "requestBody": null,
        "responseConfig": {
          "totalCountPath": "result.total",
          "responseDataPath": "result.records"
        },
        "paginationConfig": {
          "type": "offset",
          "inBody": false,
          "enabled": true,
          "maxPages": 2,
          "pageSize": 5,
          "limitParam": "limit",
          "offsetParam": "offset"
        },
        "detailConfig": {
          "enabled": false
        },
        "responseMapping": {
          "maxAward": "EstAmounts",
          "totalFunding": "EstAvailFunds"
        },
        "authMethod": "none",
        "authDetails": {},
        "handlerType": "standard",
        "apiNotes": "This is a single stage api. we will using sql to filter our key words. ",
        "processingNotes": [
          "Analysis completed for California Grants Portal "
        ],
        "executionTime": 1
      },
      "source": {
        "id": "68000a0d-02f3-4bc8-93a5-53fcf2fb09b1",
        "name": "California Grants Portal ",
        "organization": "California State Library",
        "type": "state",
        "url": "https://data.ca.gov/dataset/california-grants-portal/resource/111c8c88-21f6-453c-ae2c-b4785a0624f5",
        "api_endpoint": "https://data.ca.gov/api/3/action/datastore_search",
        "api_documentation_url": "https://data.ca.gov/dataset/california-grants-portal",
        "auth_type": "none",
        "auth_details": {},
        "update_frequency": "daily",
        "last_checked": "2025-05-02T04:32:16.559+00:00",
        "active": true,
        "priority": 5,
        "notes": "This is a single stage api. we will using sql to filter our key words. ",
        "handler_type": "standard",
        "created_at": "2025-03-31T05:35:53.680776+00:00",
        "updated_at": "2025-06-13T21:40:21.064288+00:00"
      }
    },
    "grantsGov": {
      "analysis": {
        "workflow": "two_step_api",
        "apiEndpoint": "https://api.grants.gov/v1/api/search2",
        "requestConfig": {
          "method": "POST",
          "headers": {
            "Content-Type": "application/json"
          }
        },
        "queryParameters": {},
        "requestBody": {
          "keyword": "energy; building; mobility; solar; battery; modernization; hvac; lighting; water; climate; carbon; school; infrastructure; roof; transportation; construction",
          "oppStatuses": "forecasted|posted"
        },
        "responseConfig": {
          "totalCountPath": "data.hitCount",
          "responseDataPath": "data.oppHits"
        },
        "paginationConfig": {
          "type": "offset",
          "inBody": true,
          "enabled": true,
          "maxPages": 2,
          "pageSize": 5,
          "limitParam": "rows",
          "offsetParam": "startRecordNum"
        },
        "detailConfig": {
          "method": "POST",
          "enabled": true,
          "headers": {
            "Content-Type": "application/json"
          },
          "idField": "id",
          "idParam": "opportunityId",
          "endpoint": "https://api.grants.gov/v1/api/fetchOpportunity",
          "detailResponseDataPath": "data"
        },
        "responseMapping": {
          "maxAward": "synopsis.awardCeiling",
          "minAward": "synopsis.awardFloor",
          "totalFunding": "synopsis.estimatedFunding"
        },
        "authMethod": "none",
        "authDetails": {},
        "handlerType": "standard",
        "apiNotes": "Two-stage API system: 1) Search API for opportunity listings 2) Detail API requires separate calls using opportunity IDs for full details",
        "processingNotes": [
          "Analysis completed for Grants.gov"
        ],
        "executionTime": 1
      },
      "source": {
        "id": "7767eedc-8a09-4058-8837-fc8df8e437cb",
        "name": "Grants.gov",
        "organization": "General Services Administration (GSA)",
        "type": "federal",
        "url": "https://www.grants.gov/search-grants",
        "api_endpoint": "https://api.grants.gov/v1/api/search2",
        "api_documentation_url": "https://www.grants.gov/api",
        "auth_type": "none",
        "auth_details": {},
        "update_frequency": "daily",
        "last_checked": "2025-04-30T01:18:56.329+00:00",
        "active": true,
        "priority": 5,
        "notes": "Two-stage API system: 1) Search API for opportunity listings 2) Detail API requires separate calls using opportunity IDs for full details",
        "handler_type": "standard",
        "created_at": "2025-03-29T21:21:19.251067+00:00",
        "updated_at": "2025-06-13T21:47:16.70188+00:00"
      }
    }
  }
};

/**
 * Simple function to print raw data alongside processed data for funding comparison
 */
function printRawDataComparison(rawApiData, opportunities, sourceKey, testData) {
  console.log(`\n🔍 RAW vs PROCESSED COMPARISON - ${sourceKey.toUpperCase()}`);
  console.log('═'.repeat(80));
  
  // Get the raw opportunities data
  let rawOpportunities = [];
  if (sourceKey === 'california') {
    // For California, the raw data is already an array of records
    rawOpportunities = Array.isArray(rawApiData) ? rawApiData : [];
  } else if (sourceKey === 'grantsGov') {
    // For Grants.gov, the raw data is now an array of raw detail API responses
    if (Array.isArray(rawApiData)) {
      rawOpportunities = rawApiData.filter(item => item); // Raw detail responses
    } else {
      rawOpportunities = [];
    }
  }
  
  // Compare first 10 opportunities (or all if less than 10)
  for (let i = 0; i < Math.min(10, opportunities.length); i++) {
    const opportunity = opportunities[i];
    const rawOpp = rawOpportunities[i];
    
    console.log(`\n📊 OPPORTUNITY ${i + 1}: ${opportunity.title}`);
    console.log('─'.repeat(60));
    
    if (rawOpp) {
      console.log('🔸 RAW DATA FIELD NAMES:');
      if (sourceKey === 'california') {
        console.log('\n🔸 FUNDING FIELDS:');
        console.log(`   EstAvailFunds: ${rawOpp['EstAvailFunds'] || 'N/A'}`);
        console.log(`   EstAwards: ${rawOpp['EstAwards'] || 'N/A'}`);
        console.log(`   EstAmounts: ${rawOpp['EstAmounts'] || 'N/A'}`);
      } else if (sourceKey === 'grantsGov') {
        // Use response mapping to show raw values dynamically
        const responseMapping = testData.analysis.responseMapping;
        const getNestedValue = (obj, path) => {
          return path.split('.').reduce((current, key) => current?.[key], obj);
        };
        
        console.log(`   awardCeiling (${responseMapping.maxAward}): ${getNestedValue(rawOpp.data, responseMapping.maxAward) || 'N/A'}`);
        console.log(`   awardFloor (${responseMapping.minAward}): ${getNestedValue(rawOpp.data, responseMapping.minAward) || 'N/A'}`);
        console.log(`   estimatedFunding (${responseMapping.totalFunding}): ${getNestedValue(rawOpp.data, responseMapping.totalFunding) || 'N/A'}`);
        
        // DEBUG: Show all field names in the raw response
        if (i === 0) { // Only show for first opportunity to avoid spam
          console.log('\n🔍 DEBUG - ALL RAW FIELD NAMES:');
          console.log('   Top-level fields:', Object.keys(rawOpp).slice(0, 20).join(', '));
          if (rawOpp.data) {
            console.log('   Data fields:', Object.keys(rawOpp.data).slice(0, 20).join(', '));
            if (rawOpp.data.synopsis) {
              console.log('   Synopsis fields:', Object.keys(rawOpp.data.synopsis).slice(0, 20).join(', '));
            }
            
            // Show a few sample values from the synopsis object
            if (rawOpp.data.synopsis) {
              console.log('\n🔍 DEBUG - SAMPLE SYNOPSIS VALUES:');
              const synopsisKeys = Object.keys(rawOpp.data.synopsis).slice(0, 10);
              synopsisKeys.forEach(key => {
                const value = rawOpp.data.synopsis[key];
                const displayValue = typeof value === 'string' ? 
                  (value.length > 100 ? value.substring(0, 100) + '...' : value) : 
                  value;
                console.log(`   ${key}: ${displayValue}`);
              });
            }
          }
          
          // Show which fields the response mapping is targeting
          console.log('\n🔍 RESPONSE MAPPING TARGETS:');
          Object.entries(responseMapping).forEach(([field, path]) => {
            const value = getNestedValue(rawOpp.data, path);
            console.log(`   ${field} → ${path}: ${value || 'N/A'}`);
          });
        }
      }
      
      console.log('\n🔸 PROCESSED DATA:');
      console.log(`   Total Funding: ${opportunity.totalFundingAvailable ? '$' + opportunity.totalFundingAvailable.toLocaleString() : 'N/A'}`);
      console.log(`   Min Award: ${opportunity.minimumAward ? '$' + opportunity.minimumAward.toLocaleString() : 'N/A'}`);
      console.log(`   Max Award: ${opportunity.maximumAward ? '$' + opportunity.maximumAward.toLocaleString() : 'N/A'}`);
      
      // Check if LLM is following response mapping correctly
      let mappingValidation = true;
      let mappingDetails = '';
      
      if (sourceKey === 'california') {
        const responseMapping = testData.analysis.responseMapping;
        mappingDetails += `\n🔍 RESPONSE MAPPING VALIDATION:`;
        
        // Check totalFunding mapping
        if (responseMapping.totalFunding && rawOpp[responseMapping.totalFunding]) {
          const rawValue = rawOpp[responseMapping.totalFunding];
          const expectedValue = parseFloat(rawValue.replace(/[$,]/g, ''));
          const actualValue = opportunity.totalFundingAvailable;
          const matches = actualValue && Math.abs(actualValue - expectedValue) < 1;
          mappingDetails += `\n   totalFunding (${responseMapping.totalFunding}): ${rawValue} → ${actualValue ? '$' + actualValue.toLocaleString() : 'N/A'} ${matches ? '✅' : '❌'}`;
        }
        
        // Check maxAward mapping
        if (responseMapping.maxAward && rawOpp[responseMapping.maxAward]) {
          const rawValue = rawOpp[responseMapping.maxAward];
          // Parse ranges like "Between $750,000 and $1,500,000"
          const match = rawValue.match(/\$?([\d,]+).*?\$?([\d,]+)/);
          if (match) {
            const expectedMax = parseFloat(match[2].replace(/,/g, ''));
            const actualValue = opportunity.maximumAward;
            const matches = actualValue && Math.abs(actualValue - expectedMax) < 1;
            mappingDetails += `\n   maxAward (${responseMapping.maxAward}): ${rawValue} → ${actualValue ? '$' + actualValue.toLocaleString() : 'N/A'} ${matches ? '✅' : '❌'}`;
          }
        }
      } else if (sourceKey === 'grantsGov') {
        const responseMapping = testData.analysis.responseMapping;
        mappingDetails += `\n🔍 RESPONSE MAPPING VALIDATION:`;
        
        // Helper function to get nested value from the raw response
        const getNestedValue = (obj, path) => {
          return path.split('.').reduce((current, key) => current?.[key], obj);
        };
        
        // Check totalFunding mapping
        if (responseMapping.totalFunding) {
          const rawValue = getNestedValue(rawOpp.data, responseMapping.totalFunding);
          const actualValue = opportunity.totalFundingAvailable;
          const matches = rawValue && actualValue && parseFloat(rawValue) === actualValue;
          mappingDetails += `\n   totalFunding (${responseMapping.totalFunding}): ${rawValue || 'N/A'} → ${actualValue ? '$' + actualValue.toLocaleString() : 'N/A'} ${matches ? '✅' : '❌'}`;
        }
        
        // Check maxAward mapping
        if (responseMapping.maxAward) {
          const rawValue = getNestedValue(rawOpp.data, responseMapping.maxAward);
          const actualValue = opportunity.maximumAward;
          const matches = rawValue && actualValue && parseFloat(rawValue) === actualValue;
          mappingDetails += `\n   maxAward (${responseMapping.maxAward}): ${rawValue || 'N/A'} → ${actualValue ? '$' + actualValue.toLocaleString() : 'N/A'} ${matches ? '✅' : '❌'}`;
        }
        
        // Check minAward mapping
        if (responseMapping.minAward) {
          const rawValue = getNestedValue(rawOpp.data, responseMapping.minAward);
          const actualValue = opportunity.minimumAward;
          const matches = rawValue && actualValue && parseFloat(rawValue) === actualValue;
          mappingDetails += `\n   minAward (${responseMapping.minAward}): ${rawValue || 'N/A'} → ${actualValue ? '$' + actualValue.toLocaleString() : 'N/A'} ${matches ? '✅' : '❌'}`;
        }
      }
      
      console.log(mappingDetails);
    } else {
      console.log('❌ No corresponding raw data found');
    }
  }
}

async function testDataExtractionAgent(sourceKey, testData) {
  const { source, analysis } = testData;
  
  console.log(`\n🎯 TESTING: ${source.name} (${analysis.workflow})`);
  console.log('=' .repeat(60));
  
  try {
    // Call DataExtractionAgent with the correct parameters
    console.log(`\n🔄 Running DataExtractionAgent...`);
    const startTime = Date.now();
    
    const result = await extractFromSource(source, analysis);
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    console.log(`⏱️  Execution time: ${executionTime}ms`);
    console.log(`✅ Extraction completed successfully!\n`);
    
    // Display results
    console.log('📋 EXTRACTION RESULTS:');
    console.log('─'.repeat(40));
    
    console.log('🔢 Metrics:');
    console.log(`   Total Found: ${result.extractionMetrics.totalFound}`);
    console.log(`   Successfully Extracted: ${result.extractionMetrics.successfullyExtracted}`);
    console.log(`   Workflow: ${result.extractionMetrics.workflow}`);
    console.log(`   API Calls: ${result.extractionMetrics.apiCalls}`);
    
    if (result.opportunities && result.opportunities.length > 0) {
      console.log('\n💼 DETAILED OPPORTUNITIES:');
      result.opportunities.forEach((opp, index) => {
        console.log(`\n   📄 Opportunity ${index + 1}:`);
        console.log(`      ID: ${opp.id || 'N/A'}`);
        console.log(`      Title: ${opp.title || 'N/A'}`);
        console.log(`      Description: ${(opp.description || 'N/A').substring(0, 200)}...`);
        console.log(`      Funding Type: ${opp.fundingType || 'N/A'}`);
        console.log(`      Status: ${opp.status || 'N/A'}`);
        console.log(`      Total Funding: ${opp.totalFundingAvailable ? '$' + opp.totalFundingAvailable.toLocaleString() : 'N/A'}`);
        console.log(`      Min Award: ${opp.minimumAward ? '$' + opp.minimumAward.toLocaleString() : 'N/A'}`);
        console.log(`      Max Award: ${opp.maximumAward ? '$' + opp.maximumAward.toLocaleString() : 'N/A'}`);
        console.log(`      Open Date: ${opp.openDate || 'N/A'}`);
        console.log(`      Close Date: ${opp.closeDate || 'N/A'}`);
        console.log(`      Eligible Applicants: ${JSON.stringify(opp.eligibleApplicants || [])}`);
        console.log(`      Eligible Project Types: ${JSON.stringify(opp.eligibleProjectTypes || [])}`);
        console.log(`      Eligible Locations: ${JSON.stringify(opp.eligibleLocations || [])}`);
        console.log(`      Categories: ${JSON.stringify(opp.categories || [])}`);
        console.log(`      Is National: ${opp.isNational}`);
        console.log(`      URL: ${opp.url || 'N/A'}`);
        console.log(`      Source: ${opp.sourceName} (${opp.sourceId})`);
      });
    }
    
    // NEW: Compare raw data with processed data
    if (result.rawApiData) {
      console.log('\n🔍 DEBUG - RAW API RESPONSE STRUCTURE:');
      console.log('─'.repeat(60));
      
      // Debug the actual structure for both sources
      console.log(`Raw data type: ${typeof result.rawApiData}`);
      console.log(`Is array: ${Array.isArray(result.rawApiData)}`);
      
      if (Array.isArray(result.rawApiData)) {
        console.log(`Array length: ${result.rawApiData.length}`);
        console.log('First few items keys:', result.rawApiData.slice(0, 3).map((item, i) => `Item ${i}: ${Object.keys(item).slice(0, 5).join(', ')}`));
      } else if (typeof result.rawApiData === 'object') {
        console.log('Object keys:', Object.keys(result.rawApiData).slice(0, 10));
        if (result.rawApiData.result) {
          console.log('result keys:', Object.keys(result.rawApiData.result || {}));
          if (result.rawApiData.result.records) {
            console.log('records length:', result.rawApiData.result.records?.length);
          }
        }
        if (result.rawApiData.data) {
          console.log('data keys:', Object.keys(result.rawApiData.data || {}));
        }
      }
      
      printRawDataComparison(result.rawApiData, result.opportunities, sourceKey, testData);
    }
    
    console.log('\n🎯 VALIDATION:');
    console.log('─'.repeat(40));
    
    // Validate essential aspects
    const validations = {
      'Has Opportunities': result.opportunities && result.opportunities.length > 0,
      'Has Metrics': !!result.extractionMetrics,
      'Correct Workflow': result.extractionMetrics.workflow === analysis.workflow,
      'API Calls Made': result.extractionMetrics.totalFound > 0,
      'Execution Time < 60s': executionTime < 60000,
      'Opportunities Have IDs': result.opportunities.every(opp => !!opp.id),
      'Opportunities Have Titles': result.opportunities.every(opp => !!opp.title)
    };
    
    Object.entries(validations).forEach(([check, passed]) => {
      const status = passed ? '✅' : '❌';
      console.log(`   ${status} ${check}`);
    });
    
    const allPassed = Object.values(validations).every(v => v);
    console.log(`\n🎯 Overall: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
    
    return {
      success: allPassed,
      result,
      executionTime,
      source
    };
    
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    console.log(`📍 Stack: ${error.stack}`);
    
    return {
      success: false,
      error: error.message,
      source: source
    };
  }
}

async function runDataExtractionTests() {
  console.log('🧪 STAGE 2: DataExtractionAgent Testing with Real Data');
  console.log('=' .repeat(80));
  console.log('Testing API data extraction and standardization with Stage 1 results\n');
  
  const results = {};
  
  // Test 1: California Grants Portal (single API) - SKIP FOR NOW
  // results.california = await testDataExtractionAgent('california', STAGE_1_RESULTS.results.california);
  
  // Test 2: Grants.gov (two-step API)  
  console.log('\n🔄 Starting Grants.gov test...\n');
  results.grantsGov = await testDataExtractionAgent('grantsGov', STAGE_1_RESULTS.results.grantsGov);
  
  // Summary
  console.log('\n📊 STAGE 2 SUMMARY');
  console.log('=' .repeat(50));
  
  Object.entries(results).forEach(([sourceKey, result]) => {
    const sourceInfo = sourceKey === 'california' ? 'California Grants Portal' : 'Grants.gov';
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const time = result.executionTime ? `(${result.executionTime}ms)` : '';
    const oppCount = result.result?.opportunities?.length || 0;
    console.log(`${sourceInfo}: ${status} ${time} - ${oppCount} opportunities`);
  });
  
  const successCount = Object.values(results).filter(r => r.success).length;
  console.log(`\n🎯 Overall: ${successCount}/1 sources extracted successfully`);
  
  if (successCount === 1) {
    console.log('\n🎉 Stage 2 Complete! Ready for Stage 3 (AnalysisAgent)');
    console.log('\n💾 Saving results for next stage...');
    
    // Save results for Stage 3
    const stage2Results = {
      timestamp: new Date().toISOString(),
      results: Object.fromEntries(
        Object.entries(results)
          .filter(([_, result]) => result.success)
          .map(([key, result]) => [key, {
            opportunities: result.result.opportunities,
            extractionMetrics: result.result.extractionMetrics,
            source: result.source
          }])
      )
    };
    
    console.log('\n📄 Sample Results for Stage 3:');
    Object.entries(stage2Results.results).forEach(([key, data]) => {
      console.log(`${key}: ${data.opportunities.length} opportunities extracted`);
    });
    
  } else {
    console.log('\n⚠️  Some extractions failed - fix issues before proceeding to Stage 3');
  }
  
  return results;
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runDataExtractionTests().catch(console.error);
}

export { runDataExtractionTests };
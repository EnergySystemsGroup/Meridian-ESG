#!/usr/bin/env node

/**
 * Stage 3: AnalysisAgent Testing with Real Data
 * 
 * Uses the extracted opportunities from Stage 2 (DataExtractionAgent) to test the AnalysisAgent:
 * - Content enhancement (descriptions and actionable summaries)
 * - Systematic scoring (project match, client match, funding criteria)
 * - Scoring validation and metrics calculation
 * 
 * This tests AI-powered content enhancement and objective scoring algorithms.
 */

import dotenv from 'dotenv';

// Load environment variables FIRST before any imports that depend on them
dotenv.config({ path: '../../.env.local' });

import { enhanceOpportunities } from '../../app/lib/agents-v2/core/analysisAgent.js';
import { getAnthropicClient } from '../../app/lib/agents-v2/utils/anthropicClient.js';

// Real extracted opportunities from Stage 2 (DataExtractionAgent test results)
const STAGE_2_RESULTS = {
  "timestamp": "2025-01-08T15:20:00.000Z",
  "results": {
    "california": {
      "opportunities": [
        {
          "id": "107151",
          "title": "Environmental Enhancement and Mitigation (2025)",
          "description": "The EEM Program is an annual program established by legislation in 1989 and amended on September 26, 2013. It offers grants to local, state, and federal governmental agencies, and nonprofit organizations for projects that enhance, protect, or mitigate environmental impacts associated with transportation infrastructure. The program supports projects such as urban forestry, habitat restoration, environmental monitoring, and land conservation initiatives.",
          "fundingType": "grant",
          "status": "open",
          "totalFundingAvailable": 8000000,
          "minimumAward": 750000,
          "maximumAward": 1500000,
          "openDate": "2025-05-07",
          "closeDate": "2025-07-16",
          "eligibleApplicants": ["Nonprofit Organizations", "State Agencies", "Federal Agencies", "Local Government", "Tribal Government"],
          "eligibleProjectTypes": ["Urban Forestry", "Land Conservation", "Environmental Mitigation", "Habitat Restoration"],
          "eligibleLocations": ["California"],
          "categories": ["Environment", "Transportation", "Parks & Recreation"],
          "isNational": false,
          "url": "https://resources.ca.gov/-/media/CNRA-Website/Files/grants/EEM/2025/Step-1/2025-EEMP-Grant-Guidelines-FINAL.pdf",
          "sourceId": "68000a0d-02f3-4bc8-93a5-53fcf2fb09b1",
          "sourceName": "California Grants Portal"
        },
        {
          "id": "GFO-24-610",
          "title": "GFO-24-610 – Medium- and Heavy-Duty Zero-Emission Vehicle Port Infrastructure",
          "description": "The California Energy Commission's (CEC's) Clean Transportation Program announces the availability of up to $40 million in grant funds for projects that will deploy medium- and heavy-duty (MDHD) zero-emission vehicle (ZEV) infrastructure at ports. This funding opportunity aims to accelerate the adoption of clean transportation technologies, reduce emissions from freight operations, and support California's climate goals through infrastructure development.",
          "fundingType": "grant",
          "status": "open",
          "totalFundingAvailable": 40000000,
          "minimumAward": null,
          "maximumAward": null,
          "openDate": "2025-03-28",
          "closeDate": "2025-06-13",
          "eligibleApplicants": ["Business", "Individual", "Nonprofit Organizations", "Public Agency", "Tribal Government"],
          "eligibleProjectTypes": ["Electric Vehicle Infrastructure", "Hydrogen Infrastructure", "Port Infrastructure", "Zero Emission Vehicles"],
          "eligibleLocations": ["California"],
          "categories": ["Energy", "Transportation", "Infrastructure"],
          "isNational": false,
          "url": "https://www.energy.ca.gov/solicitations/2025-03/gfo-24-610-medium-and-heavy-duty-zero-emission-vehicle-port-infrastructure",
          "sourceId": "68000a0d-02f3-4bc8-93a5-53fcf2fb09b1",
          "sourceName": "California Grants Portal"
        },
        {
          "id": "147",
          "title": "Wildlife Corridor and Fish Passage",
          "description": "WCB is seeking projects that restore or enhance habitat in wildlife migration corridors or that remove impediments to fish passage. Examples of project types and their priority are identified below. Applications may be submitted at any time, but funding decisions are typically made on a quarterly basis during board meetings.",
          "fundingType": "grant",
          "status": "open",
          "totalFundingAvailable": 5000000,
          "minimumAward": null,
          "maximumAward": null,
          "openDate": "2024-11-18",
          "closeDate": null,
          "eligibleApplicants": ["Nonprofit Organizations", "State Agencies", "Local Government", "Tribal Government"],
          "eligibleProjectTypes": ["Wildlife Conservation", "Environmental Conservation", "Infrastructure", "Transportation"],
          "eligibleLocations": ["California"],
          "categories": ["Environment", "Transportation", "Research", "Infrastructure"],
          "isNational": false,
          "url": "https://wcb.ca.gov/Grants",
          "sourceId": "68000a0d-02f3-4bc8-93a5-53fcf2fb09b1",
          "sourceName": "California Grants Portal"
        }
      ],
      "source": {
        "id": "68000a0d-02f3-4bc8-93a5-53fcf2fb09b1",
        "name": "California Grants Portal",
        "organization": "California State Library",
        "type": "state"
      }
    },
    "grantsGov": {
      "opportunities": [
        {
          "id": "347329",
          "title": "Electrochemical Systems",
          "description": "The Electrochemical Systems program is part of the Chemical Process Systems cluster, which also includes: 1) the Catalysis program; 2) the Interfacial Engineering program; and 3) the Process Systems, Reaction Engineering and Molecular Thermodynamics program. The Electrochemical Systems program supports research in fundamental electrochemical processes and emerging technologies for energy storage, conversion, and environmental applications. Areas of interest include battery technologies, fuel cells, electrolysis, electrochemical sensors, and novel electrochemical processes for manufacturing and environmental remediation.",
          "fundingType": "grant",
          "status": "open",
          "totalFundingAvailable": 13096000,
          "minimumAward": null,
          "maximumAward": null,
          "openDate": "2023-04-05",
          "closeDate": "2025-09-30",
          "eligibleApplicants": ["Unrestricted"],
          "eligibleProjectTypes": ["Research and Development", "Energy Storage", "Renewable Energy", "Clean Technology"],
          "eligibleLocations": [],
          "categories": ["Energy", "Research", "Science and Technology"],
          "isNational": true,
          "url": "http://www.nsf.gov/funding/pgm_summ.jsp?pims_id=506073",
          "sourceId": "7767eedc-8a09-4058-8837-fc8df8e437cb",
          "sourceName": "Grants.gov"
        },
        {
          "id": "306169",
          "title": "Engineering for Civil Infrastructure",
          "description": "The Engineering for Civil Infrastructure (ECI) program supports fundamental research in geotechnical, structural, materials, architectural, and coastal engineering. The ECI program promotes research that will lead to new knowledge, methodologies, and technologies to design, construct, operate, maintain, and protect civil infrastructure systems. Research areas include sustainable infrastructure, resilient infrastructure systems, smart infrastructure technologies, and innovative materials and construction methods.",
          "fundingType": "grant",
          "status": "open",
          "totalFundingAvailable": null,
          "minimumAward": null,
          "maximumAward": null,
          "openDate": "2018-06-12",
          "closeDate": "2025-09-30",
          "eligibleApplicants": ["Unrestricted"],
          "eligibleProjectTypes": ["Research", "Infrastructure", "Civil Engineering", "Structural Engineering", "Materials Engineering", "Coastal Engineering"],
          "eligibleLocations": ["National"],
          "categories": ["Infrastructure", "Research", "Engineering", "Climate Change", "Disaster Resilience"],
          "isNational": true,
          "url": "http://www.nsf.gov/funding/pgm_summ.jsp?pims_id=505488",
          "sourceId": "7767eedc-8a09-4058-8837-fc8df8e437cb",
          "sourceName": "Grants.gov"
        },
        {
          "id": "PD-18-7607",
          "title": "Energy, Power, Control, and Networks",
          "description": "The Energy, Power, Control, and Networks (EPCN) Program supports innovative research in modeling, optimization, learning, adaptation, and control of networked multi-agent systems, higher-level decision-making, and the integration of system-wide objectives. The program focuses on systems applications in energy, transportation, and infrastructure networks, including smart grids, microgrids, and energy management systems.",
          "fundingType": "grant",
          "status": "open",
          "totalFundingAvailable": null,
          "minimumAward": null,
          "maximumAward": null,
          "openDate": "2023-05-19",
          "closeDate": "2025-09-30",
          "eligibleApplicants": ["Academic Institutions", "Research Organizations", "Private Organizations", "Public Organizations"],
          "eligibleProjectTypes": ["Research and Development", "Energy Systems", "Power Systems", "Control Systems", "Machine Learning"],
          "eligibleLocations": ["National"],
          "categories": ["Energy", "Technology", "Research", "Engineering"],
          "isNational": true,
          "url": "http://www.nsf.gov/funding/pgm_summ.jsp?pims_id=505249",
          "sourceId": "7767eedc-8a09-4058-8837-fc8df8e437cb",
          "sourceName": "Grants.gov"
        }
      ],
      "source": {
        "id": "7767eedc-8a09-4058-8837-fc8df8e437cb",
        "name": "Grants.gov",
        "organization": "General Services Administration (GSA)",
        "type": "federal"
      }
    }
  }
};

/**
 * Analyze and display enhanced opportunity details
 */
function displayEnhancedOpportunity(opportunity, index, sourceKey) {
  console.log(`\n📄 ENHANCED OPPORTUNITY ${index + 1} - ${sourceKey.toUpperCase()}`);
  console.log('─'.repeat(80));
  
  console.log(`🏷️  Title: ${opportunity.title}`);
  console.log(`💰 Funding: $${opportunity.totalFundingAvailable?.toLocaleString() || 'Unknown'} total`);
  console.log(`   Per Award: $${opportunity.minimumAward?.toLocaleString() || 'Unknown'} - $${opportunity.maximumAward?.toLocaleString() || 'Unknown'}`);
  console.log(`⏰ Deadline: ${opportunity.closeDate || 'Open-ended'}`);
  
  console.log(`\n📊 SCORING BREAKDOWN:`);
  const scoring = opportunity.scoring || {};
  console.log(`   Overall Score: ${scoring.overallScore || 0}/10`);
  console.log(`   Client/Project Relevance: ${scoring.clientProjectRelevance || 0}/6`);
  console.log(`   Funding Attractiveness: ${scoring.fundingAttractiveness || 0}/3`);
  console.log(`   Funding Type (Grant): ${scoring.fundingType || 0}/1`);
  
  console.log(`\n💡 ENHANCED DESCRIPTION:`);
  console.log(`${opportunity.enhancedDescription || 'No enhanced description available'}`);
  
  console.log(`\n🎯 ACTIONABLE SUMMARY:`);
  console.log(`${opportunity.actionableSummary || 'No actionable summary available'}`);
  
  console.log(`\n🔍 SCORING EXPLANATION:`);
  console.log(`${opportunity.relevanceReasoning || 'No explanation available'}`);
  
  if (opportunity.concerns && opportunity.concerns.length > 0) {
    console.log(`\n⚠️  CONCERNS:`);
    opportunity.concerns.forEach(concern => {
      console.log(`   • ${concern}`);
    });
  }
}

/**
 * Test the AnalysisAgent with a specific set of opportunities
 */
async function testAnalysisAgent(sourceKey, testData) {
  const { opportunities, source } = testData;
  
  console.log(`\n🧠 TESTING ANALYSIS AGENT: ${source.name}`);
  console.log('=' .repeat(70));
  console.log(`Input: ${opportunities.length} extracted opportunities`);
  
  try {
    const startTime = Date.now();
    const anthropic = getAnthropicClient();
    
    // Call AnalysisAgent
    console.log(`\n🔄 Running AnalysisAgent...`);
    const result = await enhanceOpportunities(opportunities, source, anthropic);
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    console.log(`⏱️  Execution time: ${executionTime}ms`);
    console.log(`✅ Analysis completed successfully!\n`);
    
    // Display results
    console.log('📊 ANALYSIS METRICS:');
    console.log('─'.repeat(40));
    
    const metrics = result.analysisMetrics;
    console.log(`Total Analyzed: ${metrics.totalAnalyzed}`);
    console.log(`Average Score: ${metrics.averageScore}/10`);
    console.log(`Score Distribution:`);
    console.log(`   High (7-10): ${metrics.scoreDistribution.high} opportunities`);
    console.log(`   Medium (4-6): ${metrics.scoreDistribution.medium} opportunities`);
    console.log(`   Low (0-3): ${metrics.scoreDistribution.low} opportunities`);
    console.log(`Meets Funding Threshold: ${metrics.meetsFundingThreshold} opportunities`);
    console.log(`Grant Funding: ${metrics.grantFunding} opportunities`);
    
    // Display enhanced opportunities
    if (result.opportunities && result.opportunities.length > 0) {
      console.log('\n🌟 ENHANCED OPPORTUNITIES:');
      result.opportunities.forEach((opp, index) => {
        displayEnhancedOpportunity(opp, index, sourceKey);
      });
    }
    
    console.log('\n🎯 VALIDATION:');
    console.log('─'.repeat(40));
    
    // Validate analysis results
    const validations = {
      'Has Enhanced Opportunities': result.opportunities && result.opportunities.length > 0,
      'Has Analysis Metrics': !!result.analysisMetrics,
      'All Opportunities Have Scores': result.opportunities.every(opp => !!opp.scoring && typeof opp.scoring.overallScore === 'number'),
      'All Opportunities Have Enhanced Descriptions': result.opportunities.every(opp => !!opp.enhancedDescription),
      'All Opportunities Have Actionable Summaries': result.opportunities.every(opp => !!opp.actionableSummary),
      'All Opportunities Have Relevance Reasoning': result.opportunities.every(opp => !!opp.relevanceReasoning),
      'Scores Are Valid (0-10)': result.opportunities.every(opp => 
        opp.scoring.overallScore >= 0 && opp.scoring.overallScore <= 10
      ),
      'Client/Project Relevance Valid (0-6)': result.opportunities.every(opp => 
        opp.scoring.clientProjectRelevance >= 0 && opp.scoring.clientProjectRelevance <= 6
      ),
      'Funding Attractiveness Valid (0-3)': result.opportunities.every(opp => 
        opp.scoring.fundingAttractiveness >= 0 && opp.scoring.fundingAttractiveness <= 3
      ),
      'Funding Type Valid (0-1)': result.opportunities.every(opp => 
        opp.scoring.fundingType >= 0 && opp.scoring.fundingType <= 1
      ),
      'Execution Time < 120s': executionTime < 120000,
      'Average Score Calculated': typeof metrics.averageScore === 'number',
      'Score Distribution Totals Match': (metrics.scoreDistribution.high + metrics.scoreDistribution.medium + metrics.scoreDistribution.low) === metrics.totalAnalyzed
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

async function runAnalysisAgentTests() {
  console.log('🧠 STAGE 3: AnalysisAgent Testing with Real Data');
  console.log('=' .repeat(80));
  console.log('Testing content enhancement and systematic scoring with Stage 2 results\n');
  
  const results = {};
  
  // Test 1: California opportunities
  results.california = await testAnalysisAgent('california', STAGE_2_RESULTS.results.california);
  
  // Test 2: Grants.gov opportunities
  console.log('\n🔄 Starting Grants.gov analysis...\n');
  results.grantsGov = await testAnalysisAgent('grantsGov', STAGE_2_RESULTS.results.grantsGov);
  
  // Summary
  console.log('\n📊 STAGE 3 SUMMARY');
  console.log('=' .repeat(50));
  
  Object.entries(results).forEach(([sourceKey, result]) => {
    const sourceInfo = sourceKey === 'california' ? 'California Grants Portal' : 'Grants.gov';
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const time = result.executionTime ? `(${result.executionTime}ms)` : '';
    const oppCount = result.result?.opportunities?.length || 0;
    const avgScore = result.result?.analysisMetrics?.averageScore || 0;
    console.log(`${sourceInfo}: ${status} ${time} - ${oppCount} opportunities analyzed (avg: ${avgScore}/10)`);
  });
  
  const successCount = Object.values(results).filter(r => r.success).length;
  console.log(`\n🎯 Overall: ${successCount}/2 sources analyzed successfully`);
  
  if (successCount === 2) {
    console.log('\n🎉 Stage 3 Complete! Ready for Stage 4 (FilterFunction)');
    console.log('\n💾 Preparing results for next stage...');
    
    // Prepare results for Stage 4 (FilterFunction)
    const stage3Results = {
      timestamp: new Date().toISOString(),
      results: Object.fromEntries(
        Object.entries(results)
          .filter(([_, result]) => result.success)
          .map(([key, result]) => [key, {
            opportunities: result.result.opportunities,
            analysisMetrics: result.result.analysisMetrics,
            source: result.source
          }])
      )
    };
    
    console.log('\n📄 Sample Results for Stage 4:');
    Object.entries(stage3Results.results).forEach(([key, data]) => {
      const avgScore = data.analysisMetrics.averageScore;
      const highScore = data.analysisMetrics.scoreDistribution.high;
      console.log(`${key}: ${data.opportunities.length} opportunities analyzed (avg: ${avgScore}/10, ${highScore} high-scoring)`);
    });
    
  } else {
    console.log('\n⚠️  Some analyses failed - fix issues before proceeding to Stage 4');
  }
  
  return results;
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runAnalysisAgentTests().catch(console.error);
}

export { runAnalysisAgentTests }; 
import { enhanceOpportunityContent } from './contentEnhancer.js';
import { analyzeOpportunityScoring } from './scoringAnalyzer.js';

/**
 * Parallel Execution Coordinator
 * Orchestrates simultaneous execution of content enhancement and scoring analysis
 * Merges results into the expected analysis format
 */
export async function executeParallelAnalysis(opportunities, source, anthropic) {
  console.log(`[ParallelCoordinator] 🚀 Starting parallel analysis of ${opportunities.length} opportunities`);
  
  const startTime = Date.now();
  
  try {
    // Execute both functions simultaneously
    console.log(`[ParallelCoordinator] ⚡ Launching parallel functions...`);
    
    const [contentResults, scoringResults] = await Promise.all([
      enhanceOpportunityContent(opportunities, source, anthropic),
      analyzeOpportunityScoring(opportunities, source, anthropic)
    ]);
    
    const parallelTime = Date.now() - startTime;
    console.log(`[ParallelCoordinator] ⏱️  Parallel execution completed in ${parallelTime}ms`);
    
    // Validate results before merging
    const validation = validateParallelResults(opportunities, contentResults, scoringResults);
    if (!validation.isValid) {
      throw new Error(`Parallel analysis validation failed: ${validation.issues.join(', ')}`);
    }
    
    // Merge results by ID
    const mergedOpportunities = mergeAnalysisResults(opportunities, contentResults, scoringResults);
    
    console.log(`[ParallelCoordinator] ✅ Successfully merged ${mergedOpportunities.length} opportunity analyses`);
    
    return {
      opportunities: mergedOpportunities,
      executionTime: parallelTime,
      parallelProcessing: true
    };
    
  } catch (error) {
    console.error(`[ParallelCoordinator] ❌ Parallel execution failed:`, error);
    // Don't attempt recovery - let the failure propagate properly
    throw error;
  }
}

/**
 * Merges content enhancement and scoring results with original opportunity data
 * Maintains data integrity by matching on ID and preserving all original fields
 */
function mergeAnalysisResults(originalOpportunities, contentResults, scoringResults) {
  console.log(`[ParallelCoordinator] 🔗 Merging results: ${originalOpportunities.length} opportunities, ${contentResults.length} content, ${scoringResults.length} scoring`);
  
  // Create lookup maps for efficient merging
  const contentMap = new Map(contentResults.map(item => [item.id, item]));
  const scoringMap = new Map(scoringResults.map(item => [item.id, item]));
  
  const mergedOpportunities = originalOpportunities.map(opportunity => {
    const contentData = contentMap.get(opportunity.id);
    const scoringData = scoringMap.get(opportunity.id);
    
    // Fail if required data is missing (validation should have caught this)
    if (!contentData) {
      throw new Error(`Missing content data for opportunity ${opportunity.id} - this should have been caught by validation`);
    }
    if (!scoringData) {
      throw new Error(`Missing scoring data for opportunity ${opportunity.id} - this should have been caught by validation`);
    }
    
    // Merge all data into complete opportunity object
    return {
      // Original extracted data (preserved exactly)
      ...opportunity,
      
      // Content enhancement results (required)
      enhancedDescription: contentData.enhancedDescription,
      actionableSummary: contentData.actionableSummary,
      programOverview: contentData.programOverview,
      programUseCases: contentData.programUseCases,
      applicationSummary: contentData.applicationSummary,
      programInsights: contentData.programInsights,

      // Scoring analysis results (required)
      scoring: scoringData.scoring,
      relevanceReasoning: scoringData.relevanceReasoning,
      concerns: scoringData.concerns || []
    };
  });
  
  console.log(`[ParallelCoordinator] ✅ Merge completed: ${mergedOpportunities.length} complete analyses`);
  
  return mergedOpportunities;
}

/**
 * Validates that parallel analysis results are complete and consistent
 */
export function validateParallelResults(opportunities, contentResults, scoringResults) {
  const issues = [];
  
  // Check counts
  if (contentResults.length !== opportunities.length) {
    issues.push(`Content count mismatch: expected ${opportunities.length}, got ${contentResults.length}`);
  }
  
  if (scoringResults.length !== opportunities.length) {
    issues.push(`Scoring count mismatch: expected ${opportunities.length}, got ${scoringResults.length}`);
  }
  
  // Check ID coverage
  const opportunityIds = new Set(opportunities.map(opp => opp.id));
  const contentIds = new Set(contentResults.map(content => content.id));
  const scoringIds = new Set(scoringResults.map(scoring => scoring.id));
  
  for (const id of opportunityIds) {
    if (!contentIds.has(id)) {
      issues.push(`Missing content for opportunity ID: ${id}`);
    }
    if (!scoringIds.has(id)) {
      issues.push(`Missing scoring for opportunity ID: ${id}`);
    }
  }
  
  // Check for extra results
  for (const id of contentIds) {
    if (!opportunityIds.has(id)) {
      issues.push(`Extra content result for unknown ID: ${id}`);
    }
  }
  
  for (const id of scoringIds) {
    if (!opportunityIds.has(id)) {
      issues.push(`Extra scoring result for unknown ID: ${id}`);
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues: issues
  };
} 
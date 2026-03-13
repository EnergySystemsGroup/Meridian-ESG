import { enhanceOpportunityContent } from './contentEnhancer.js';
import { analyzeOpportunityScoring } from './scoringAnalyzer.js';

/**
 * Analysis Coordinator
 * Orchestrates sequential execution: deterministic scoring first (~1ms),
 * then LLM content enhancement with scoring context.
 * Merges results into the expected analysis format.
 */
export async function executeParallelAnalysis(opportunities, source, anthropic) {
  console.log(`[AnalysisCoordinator] Starting analysis of ${opportunities.length} opportunities`);

  const startTime = Date.now();

  try {
    // Step 1: Deterministic scoring (~1ms, no API calls)
    const scoringResults = await analyzeOpportunityScoring(opportunities, source);
    const scoringTime = Date.now() - startTime;
    console.log(`[AnalysisCoordinator] Deterministic scoring completed in ${scoringTime}ms`);

    // Step 2: LLM content enhancement WITH scoring context
    const contentResults = await enhanceOpportunityContent(opportunities, source, anthropic, scoringResults);
    const totalTime = Date.now() - startTime;
    console.log(`[AnalysisCoordinator] LLM enhancement completed in ${totalTime - scoringTime}ms (total: ${totalTime}ms)`);

    // Validate results before merging
    const validation = validateParallelResults(opportunities, contentResults, scoringResults);
    if (!validation.isValid) {
      throw new Error(`Analysis validation failed: ${validation.issues.join(', ')}`);
    }

    // Merge results by ID (includes adjustedScore computation)
    const mergedOpportunities = mergeAnalysisResults(opportunities, contentResults, scoringResults);

    console.log(`[AnalysisCoordinator] Successfully merged ${mergedOpportunities.length} opportunity analyses`);

    return {
      opportunities: mergedOpportunities,
      executionTime: totalTime,
      parallelProcessing: false
    };

  } catch (error) {
    console.error(`[AnalysisCoordinator] Analysis failed:`, error);
    // Don't attempt recovery - let the failure propagate properly
    throw error;
  }
}

/**
 * Merges content enhancement and scoring results with original opportunity data.
 * Computes adjustedScore = clamp(finalScore + llmAdjustment, 0, 10).
 * Maintains data integrity by matching on ID and preserving all original fields.
 */
function mergeAnalysisResults(originalOpportunities, contentResults, scoringResults) {
  console.log(`[AnalysisCoordinator] Merging results: ${originalOpportunities.length} opportunities, ${contentResults.length} content, ${scoringResults.length} scoring`);

  // Create lookup maps for efficient merging
  const contentMap = new Map(contentResults.map(item => [item.id, item]));
  const scoringMap = new Map(scoringResults.map(item => [item.id, item]));

  const mergedOpportunities = originalOpportunities.map(opportunity => {
    const contentData = contentMap.get(opportunity.id);
    const scoringData = scoringMap.get(opportunity.id);

    // Debug: warn if rawResponseId is missing (helps trace data lineage issues)
    if (!opportunity.rawResponseId) {
      console.warn(`[AnalysisCoordinator] Missing rawResponseId for opportunity ${opportunity.id} - data lineage will be incomplete`);
    }

    // Fail if required data is missing (validation should have caught this)
    if (!contentData) {
      throw new Error(`Missing content data for opportunity ${opportunity.id} - this should have been caught by validation`);
    }
    if (!scoringData) {
      throw new Error(`Missing scoring data for opportunity ${opportunity.id} - this should have been caught by validation`);
    }

    // Compute LLM-adjusted score
    const llmAdjustment = contentData.scoreAdjustment || 0;
    const adjustedScore = Math.round(
      Math.max(0, Math.min(10, scoringData.scoring.finalScore + llmAdjustment)) * 10
    ) / 10;

    // Merge all data into complete opportunity object
    return {
      // Original extracted data (preserved exactly)
      ...opportunity,

      // Explicitly preserve tracking metadata (belt-and-suspenders)
      rawResponseId: opportunity.rawResponseId,
      sourceId: opportunity.sourceId,
      sourceName: opportunity.sourceName,

      // Content enhancement results (required)
      enhancedDescription: contentData.enhancedDescription,
      actionableSummary: contentData.actionableSummary,
      programOverview: contentData.programOverview,
      programUseCases: contentData.programUseCases,
      applicationSummary: contentData.applicationSummary,
      programInsights: contentData.programInsights,

      // Scoring analysis results with LLM adjustment
      scoring: {
        ...scoringData.scoring,
        llmAdjustment,
        adjustedScore
      },
      relevanceReasoning: contentData.adjustmentReasoning || scoringData.relevanceReasoning,
      concerns: scoringData.concerns || []
    };
  });

  console.log(`[AnalysisCoordinator] Merge completed: ${mergedOpportunities.length} complete analyses`);

  return mergedOpportunities;
}

/**
 * Validates that analysis results are complete and consistent
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

/**
 * AnalysisAgent V2 - Parallel Processing Architecture
 * 
 * Uses parallel execution of content enhancement and scoring analysis for improved speed and reliability.
 * Replaces monolithic approach with modular parallel processing.
 * 
 * Exports: enhanceOpportunities(opportunities, source, anthropic)
 */

import { createSupabaseClient, logAgentExecution } from '../../../../utils/supabase.js';
import { executeParallelAnalysis } from './parallelCoordinator.js';
import { AnalysisConfig } from '../../config/analysis.config.js';

/**
 * Enhances opportunities with better content and systematic scoring using parallel processing
 * @param {Array} opportunities - Standardized opportunities from DataExtractionAgent
 * @param {Object} source - The source object for context
 * @param {Object} anthropic - Anthropic client instance
 * @returns {Promise<Object>} - Enhanced opportunities with scores
 */
export async function enhanceOpportunities(opportunities, source, anthropic) {
  const startTime = Date.now();
  
  try {
    // Input validation
    if (!opportunities || !Array.isArray(opportunities)) {
      throw new Error('Opportunities must be an array');
    }
    
    if (opportunities.length === 0) {
      return {
        opportunities: [],
        analysisMetrics: {
          totalAnalyzed: 0,
          averageScore: 0,
          scoreDistribution: { high: 0, medium: 0, low: 0 },
          categoryBreakdown: {},
          fundingMetrics: {
            totalFunding: 0,
            averageFunding: 0,
            grantCount: 0,
            loanCount: 0
          }
        },
        executionTime: Math.max(1, Date.now() - startTime),
        processingMode: 'parallel'
      };
    }

    console.log(`[AnalysisAgent] 🚀 Starting parallel analysis of ${opportunities.length} opportunities from ${source.name}`);
    
    // Dynamic batch sizing based on model capabilities and content complexity
    const avgDescriptionLength = opportunities.reduce((sum, opp) => 
      sum + (opp.description?.length || 0), 0) / opportunities.length;
    
    // Get optimal batch configuration from the anthropic client
    const batchConfig = anthropic.calculateOptimalBatchSize(avgDescriptionLength);
    const batchSize = batchConfig.batchSize;
    
    // Log the dynamic batch sizing decision
    console.log(`[AnalysisAgent] 🎯 Dynamic batch sizing for ${batchConfig.modelName}:`);
    console.log(`[AnalysisAgent] 📏 Content complexity: ${Math.round(avgDescriptionLength)} chars avg (${batchConfig.reason})`);
    console.log(`[AnalysisAgent] 🚀 Optimal batch size: ${batchSize} (model capacity: ${batchConfig.modelCapacity} tokens)`);
    console.log(`[AnalysisAgent] 🎯 Allocated tokens: ${batchConfig.maxTokens} (${batchConfig.tokensPerOpportunity}/opp + ${batchConfig.baseTokens} base)`);

    const enhancedOpportunities = [];
    
    for (let i = 0; i < opportunities.length; i += batchSize) {
      const batch = opportunities.slice(i, i + batchSize);
      console.log(`[AnalysisAgent] 🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(opportunities.length/batchSize)} (${batch.length} opportunities)`);
      
      let enhancedBatch;
      let actualBatchTime = 0; // Track actual batch execution time
      
      try {
        // Use parallel processing architecture
        const parallelResult = await executeParallelAnalysis(batch, source, anthropic);
        enhancedBatch = parallelResult.opportunities;
        actualBatchTime = parallelResult.executionTime; // Get actual batch execution time
        
        console.log(`[AnalysisAgent] ✅ Parallel processing ${parallelResult.parallelProcessing ? 'succeeded' : 'used fallback'} in ${parallelResult.executionTime}ms`);
        
      } catch (parallelError) {
        console.error(`[AnalysisAgent] ❌ Parallel processing failed:`, parallelError);
        
        // For JSON parsing errors and validation issues, fail immediately
        if (parallelError.message.includes('JSON') || 
            parallelError.message.includes('validation') || 
            parallelError.message.includes('parse') ||
            parallelError.message.includes('Invalid response structure')) {
          console.log(`[AnalysisAgent] 💥 Content enhancement failure detected - failing fast`);
          throw parallelError;
        }
        
        // For network/rate limit errors, try individual processing
        console.log(`[AnalysisAgent] 🔄 Falling back to individual processing for network/rate limit error...`);
        const fallbackStartTime = Date.now();
        enhancedBatch = [];
        
        for (const singleOpp of batch) {
          try {
            const singleResult = await executeParallelAnalysis([singleOpp], source, anthropic);
            enhancedBatch.push(...singleResult.opportunities);
            await new Promise(resolve => setTimeout(resolve, AnalysisConfig.RETRY_DELAY)); // Small delay between individual calls
          } catch (singleError) {
            console.error(`[AnalysisAgent] ❌ Individual processing failed for ${singleOpp.id}:`, singleError);
            // Don't use fallback - let the error propagate
            throw singleError;
          }
        }
        
        actualBatchTime = Date.now() - fallbackStartTime; // Calculate fallback batch time
      }
      
      enhancedOpportunities.push(...enhancedBatch);
      
      // Performance tracking and rate limiting - use ACTUAL batch time
      console.log(`[AnalysisAgent] ⏱️  Batch ${Math.floor(i/batchSize) + 1} completed in ${actualBatchTime}ms (${Math.round(actualBatchTime/enhancedBatch.length)}ms per opportunity)`);
      
      if (i + batchSize < opportunities.length) {
        await new Promise(resolve => setTimeout(resolve, AnalysisConfig.BATCH_DELAY));
      }
    }
    
    // Calculate analysis metrics
    const analysisMetrics = calculateAnalysisMetrics(enhancedOpportunities);
    
    // Get token metrics from anthropic client
    const clientMetrics = anthropic.getPerformanceMetrics();
    analysisMetrics.totalTokens = clientMetrics.totalTokens || 0;
    analysisMetrics.totalApiCalls = clientMetrics.totalCalls || 0;
    analysisMetrics.totalExecutionTime = Math.max(1, Date.now() - startTime);
    
    const executionTime = Math.max(1, Date.now() - startTime);
    console.log(`[AnalysisAgent] ✅ Parallel analysis completed in ${executionTime}ms`);
    console.log(`[AnalysisAgent] 📊 Average score: ${analysisMetrics.averageScore}/10`);
    console.log(`[AnalysisAgent] 🎯 High relevance: ${analysisMetrics.scoreDistribution.high} opportunities`);
    console.log(`[AnalysisAgent] 🔢 Tokens used: ${analysisMetrics.totalTokens}`);
    
    const result = {
      opportunities: enhancedOpportunities,
      analysisMetrics,
      executionTime,
      processingMode: 'parallel'
    };
    
    // Log agent execution for tracking
    try {
      const supabase = createSupabaseClient();
      await logAgentExecution(
        supabase,
        'analysis_v2_parallel',
        { 
          source: { id: source.id, name: source.name },
          opportunityCount: opportunities.length,
          batchSize: batchSize,
          avgDescriptionLength: Math.round(avgDescriptionLength)
        },
        result,
        executionTime,
        { 
          tokensUsed: analysisMetrics.totalTokens || 0,
          apiCalls: analysisMetrics.totalApiCalls || 0,
          cost: (analysisMetrics.totalTokens || 0) * AnalysisConfig.COST_PER_TOKEN // Approximate cost per token
        }
      );
    } catch (logError) {
      console.error('[AnalysisAgent] ❌ Failed to log execution:', logError);
      // Don't throw - logging failure shouldn't break the pipeline
    }
    
    return result;
    
  } catch (error) {
    console.error(`[AnalysisAgent] ❌ Error enhancing opportunities:`, error);
    
    // Enhance error with context
    const enhancedError = new Error(`AnalysisAgent failed: ${error.message}`);
    enhancedError.cause = error;
    enhancedError.stack = error.stack;
    enhancedError.context = {
      source: { id: source.id, name: source.name },
      opportunityCount: opportunities.length,
      stage: 'analysis_v2_parallel',
      elapsedTime: Date.now() - startTime
    };
    
    // Log failed execution
    try {
      const supabase = createSupabaseClient();
      const executionTime = Math.max(1, Date.now() - startTime);
      await logAgentExecution(
        supabase,
        'analysis_v2_parallel',
        { 
          source: { id: source.id, name: source.name },
          opportunityCount: opportunities.length
        },
        null,
        executionTime,
        null,
        enhancedError
      );
    } catch (logError) {
      console.error('[AnalysisAgent] ❌ Failed to log error execution:', logError);
    }
    
    throw enhancedError;
  }
}

/**
 * Calculates comprehensive analysis metrics from enhanced opportunities
 * @private
 * @param {Array} opportunities - Array of enhanced opportunities
 * @returns {Object} Analysis metrics including scores, categories, and funding data
 */
function calculateAnalysisMetrics(opportunities) {
  if (!opportunities || opportunities.length === 0) {
    return {
      totalAnalyzed: 0,
      averageScore: 0,
      scoreDistribution: { high: 0, medium: 0, low: 0 },
      categoryBreakdown: {},
      fundingMetrics: {
        totalFunding: 0,
        averageFunding: 0,
        grantCount: 0,
        loanCount: 0
      }
    };
  }
  
  const scores = opportunities.map(opp => opp.scoring?.overallScore || 0);
  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  
  const scoreDistribution = {
    high: scores.filter(score => score >= AnalysisConfig.HIGH_SCORE_THRESHOLD).length,
    medium: scores.filter(score => score >= AnalysisConfig.MEDIUM_SCORE_THRESHOLD && score < AnalysisConfig.HIGH_SCORE_THRESHOLD).length,
    low: scores.filter(score => score < AnalysisConfig.MEDIUM_SCORE_THRESHOLD).length
  };

  // Category breakdown
  const categoryBreakdown = {};
  opportunities.forEach(opp => {
    if (opp.categories && Array.isArray(opp.categories)) {
      opp.categories.forEach(category => {
        categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
      });
    }
  });

  // Funding metrics
  const fundingAmounts = opportunities
    .map(opp => opp.totalFundingAvailable || 0)
    .filter(amount => amount > 0);
  
  const totalFunding = fundingAmounts.reduce((sum, amount) => sum + amount, 0);
  const averageFunding = fundingAmounts.length > 0 ? totalFunding / fundingAmounts.length : 0;

  const grantCount = opportunities.filter(opp => 
    opp.fundingType === 'grant' || opp.scoring?.fundingType === 1
  ).length;
  
  const loanCount = opportunities.filter(opp => 
    opp.fundingType === 'loan' || (opp.fundingType && opp.fundingType !== 'grant')
  ).length;
  
  return {
    totalAnalyzed: opportunities.length, // Changed from totalOpportunities to match test validation
    averageScore: Math.round(averageScore * 100) / 100,
    scoreDistribution,
    categoryBreakdown,
    fundingMetrics: {
      totalFunding,
      averageFunding: Math.round(averageFunding),
      grantCount,
      loanCount
    }
  };
} 
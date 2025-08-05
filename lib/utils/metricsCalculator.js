/**
 * Enhanced metrics calculator for V2 pipeline performance tracking
 * Provides realistic success rates and meaningful SLA compliance scoring
 */

// SLA Target Definitions
export const SLA_TARGETS = {
  maxProcessingTimeMinutes: 30,     // Complete within 30 minutes
  minSuccessRate: 95,               // 95% opportunities processed successfully
  maxCostPerOpportunity: 0.05,      // Keep costs under $0.05 per opportunity
  minThroughput: 10,                // Process at least 10 opportunities/minute
  maxErrorRate: 5                   // Allow up to 5% error rate
};

// Failure Category Definitions
export const FAILURE_CATEGORIES = {
  API_ERRORS: 'apiErrors',
  VALIDATION_ERRORS: 'validationErrors',
  DUPLICATE_REJECTIONS: 'duplicateRejections',
  PROCESSING_ERRORS: 'processingErrors',
  STORAGE_ERRORS: 'storageErrors',
  TIMEOUT_ERRORS: 'timeoutErrors'
};

/**
 * Calculate enhanced success rate based on actual failure tracking
 * @param {Object} metrics - Pipeline execution metrics
 * @param {number} metrics.totalOpportunities - Total opportunities processed
 * @param {Object} metrics.failures - Failure breakdown by category
 * @returns {number} Success rate percentage (0-100)
 */
export function calculateSuccessRate(metrics) {
  // Comprehensive input validation
  if (!metrics || typeof metrics !== 'object') {
    console.warn('[MetricsCalculator] Invalid metrics object, defaulting to 0% success rate');
    return 0;
  }
  
  const { totalOpportunities = 0, failures = {} } = metrics;
  
  // Validate totalOpportunities is a non-negative number
  if (typeof totalOpportunities !== 'number' || totalOpportunities < 0 || !isFinite(totalOpportunities)) {
    console.warn('[MetricsCalculator] Invalid totalOpportunities, defaulting to 0% success rate');
    return 0;
  }
  
  if (totalOpportunities === 0) {
    return 0;
  }
  
  // Validate failures object
  if (typeof failures !== 'object' || Array.isArray(failures) || failures === null) {
    console.warn('[MetricsCalculator] Invalid failures object, treating as no failures');
    return 100; // If we can't read failures but have opportunities, assume success
  }
  
  // Calculate total failures across all categories with robust error handling
  const totalFailures = Object.values(failures).reduce((sum, count) => {
    const numericCount = parseInt(count) || 0;
    return sum + (isFinite(numericCount) && numericCount >= 0 ? numericCount : 0);
  }, 0);
  
  const successfulOpportunities = Math.max(0, totalOpportunities - totalFailures);
  
  // Additional division by zero protection (defensive programming)
  if (totalOpportunities === 0) {
    return 0;
  }
  
  const successRate = (successfulOpportunities / totalOpportunities) * 100;
  
  // Ensure result is within valid range and finite
  const clampedRate = Math.max(0, Math.min(100, successRate));
  return isFinite(clampedRate) ? Math.round(clampedRate * 100) / 100 : 0;
}

/**
 * Calculate weighted SLA compliance score
 * @param {Object} metrics - Pipeline execution metrics
 * @param {Object} targets - SLA targets (defaults to SLA_TARGETS)
 * @returns {Object} SLA compliance details
 */
export function calculateSLACompliance(metrics, targets = SLA_TARGETS) {
  // Input validation
  if (!metrics || typeof metrics !== 'object') {
    console.warn('[MetricsCalculator] Invalid metrics object for SLA calculation');
    return {
      overall: 0,
      breakdown: {
        timeCompliance: 0,
        successCompliance: 0,
        costCompliance: 0,
        throughputCompliance: 0
      },
      grade: 'F'
    };
  }
  
  if (!targets || typeof targets !== 'object') {
    console.warn('[MetricsCalculator] Invalid targets object, using defaults');
    targets = SLA_TARGETS;
  }
  
  const {
    totalExecutionTime = 0,
    successRate = 0,
    costPerOpportunity = 0,
    throughput = 0
  } = metrics;
  
  // Validate numeric inputs
  const validExecutionTime = isFinite(totalExecutionTime) && totalExecutionTime >= 0 ? totalExecutionTime : 0;
  const validSuccessRate = isFinite(successRate) && successRate >= 0 ? Math.min(100, successRate) : 0;
  const validCostPerOpportunity = isFinite(costPerOpportunity) && costPerOpportunity >= 0 ? costPerOpportunity : 0;
  const validThroughput = isFinite(throughput) && throughput >= 0 ? throughput : 0;
  
  const compliance = {
    overall: 0,
    breakdown: {},
    grade: 'F'
  };
  
  const scores = [];
  
  // 1. Time Compliance (25% weight)
  const actualMinutes = validExecutionTime / (1000 * 60);
  let timeCompliance = 100;
  if (actualMinutes > targets.maxProcessingTimeMinutes && targets.maxProcessingTimeMinutes > 0) {
    const overrun = (actualMinutes - targets.maxProcessingTimeMinutes) / targets.maxProcessingTimeMinutes;
    timeCompliance = Math.max(0, 100 - (overrun * 50)); // 50% penalty per 100% overrun
  }
  compliance.breakdown.timeCompliance = Math.round(timeCompliance);
  scores.push({ score: timeCompliance, weight: 0.25 });
  
  // 2. Success Rate Compliance (35% weight)
  const successCompliance = targets.minSuccessRate > 0 
    ? Math.min(100, (validSuccessRate / targets.minSuccessRate) * 100)
    : 100; // If no success rate target, assume compliance
  compliance.breakdown.successCompliance = Math.round(successCompliance);
  scores.push({ score: successCompliance, weight: 0.35 });
  
  // 3. Cost Compliance (20% weight)
  let costCompliance = 100;
  if (validCostPerOpportunity > targets.maxCostPerOpportunity && targets.maxCostPerOpportunity > 0) {
    const overrun = (validCostPerOpportunity - targets.maxCostPerOpportunity) / targets.maxCostPerOpportunity;
    costCompliance = Math.max(0, 100 - (overrun * 30)); // 30% penalty per 100% overrun
  }
  compliance.breakdown.costCompliance = Math.round(costCompliance);
  scores.push({ score: costCompliance, weight: 0.20 });
  
  // 4. Throughput Compliance (20% weight)
  const throughputCompliance = targets.minThroughput > 0 
    ? Math.min(100, (validThroughput / targets.minThroughput) * 100)
    : 100; // If no throughput target, assume compliance
  compliance.breakdown.throughputCompliance = Math.round(throughputCompliance);
  scores.push({ score: throughputCompliance, weight: 0.20 });
  
  // Calculate weighted overall score
  const weightedScore = scores.reduce((sum, item) => sum + (item.score * item.weight), 0);
  compliance.overall = Math.round(weightedScore);
  
  // Assign letter grade
  if (compliance.overall >= 90) compliance.grade = 'A';
  else if (compliance.overall >= 80) compliance.grade = 'B';
  else if (compliance.overall >= 70) compliance.grade = 'C';
  else if (compliance.overall >= 60) compliance.grade = 'D';
  else compliance.grade = 'F';
  
  return compliance;
}

/**
 * Initialize failure tracking structure
 * @returns {Object} Empty failure tracking object
 */
export function initializeFailureTracking() {
  return Object.values(FAILURE_CATEGORIES).reduce((acc, category) => {
    acc[category] = 0;
    return acc;
  }, {});
}

/**
 * Add failure to tracking
 * @param {Object} failures - Current failure tracking object
 * @param {string} category - Failure category from FAILURE_CATEGORIES
 * @param {number} count - Number of failures to add (default: 1)
 * @returns {Object} Updated failure tracking object
 */
export function recordFailure(failures, category, count = 1) {
  if (!Object.values(FAILURE_CATEGORIES).includes(category)) {
    console.warn(`[MetricsCalculator] Unknown failure category: ${category}`);
    return failures;
  }
  
  const updated = { ...failures };
  updated[category] = (updated[category] || 0) + count;
  return updated;
}

/**
 * Get SLA compliance color for UI display
 * @param {number} compliancePercentage - SLA compliance percentage
 * @returns {string} Tailwind CSS color class
 */
export function getSLAComplianceColor(compliancePercentage) {
  if (compliancePercentage >= 90) return 'text-green-600';
  if (compliancePercentage >= 70) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * Get SLA compliance background color for badges
 * @param {number} compliancePercentage - SLA compliance percentage
 * @returns {string} Tailwind CSS background color class
 */
export function getSLAComplianceBadgeColor(compliancePercentage) {
  if (compliancePercentage >= 90) return 'bg-green-100 text-green-800';
  if (compliancePercentage >= 70) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}